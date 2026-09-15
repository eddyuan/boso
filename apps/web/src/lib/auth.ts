import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { emailOTP, phoneNumber, username } from "better-auth/plugins";
import { expo } from "@better-auth/expo";
import {
  db,
  users,
  sessions,
  accounts,
  verifications,
  rateLimits,
  authEvents,
} from "@bsocial/db";
import { E164_REGEX, placeholderEmailForPhone } from "@bsocial/shared";
import { getDeviceName } from "@/lib/request-meta";
import { createAppleClientSecret } from "@/lib/apple-client-secret";
import { sendEmail } from "@/lib/mailer";
import { sendSms } from "@/lib/sms";
import { webAppOrigins } from "@/lib/web-origins";

const DAY = 60 * 60 * 24;
const OTP_TTL_SECONDS = 5 * 60;
const env = process.env;

// Providers are enabled only when their credentials are configured, so local
// dev works without them.
const google =
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? {
        // First ID is the web client (used for the browser OAuth flow); the
        // others are accepted as ID-token audiences for native sign-in.
        clientId: [env.GOOGLE_CLIENT_ID, env.GOOGLE_IOS_CLIENT_ID, env.GOOGLE_ANDROID_CLIENT_ID].filter(
          (id): id is string => !!id,
        ),
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        prompt: "select_account" as const,
      }
    : undefined;

const apple =
  env.APPLE_SERVICES_ID && env.APPLE_TEAM_ID && env.APPLE_KEY_ID && env.APPLE_PRIVATE_KEY
    ? {
        clientId: env.APPLE_SERVICES_ID,
        clientSecret: await createAppleClientSecret({
          teamId: env.APPLE_TEAM_ID,
          keyId: env.APPLE_KEY_ID,
          clientId: env.APPLE_SERVICES_ID,
          privateKey: env.APPLE_PRIVATE_KEY,
        }),
        // Web flow tokens are issued to the Services ID; native iOS tokens to
        // the app's bundle ID. Accept both.
        audience: [env.APPLE_SERVICES_ID, env.APPLE_APP_BUNDLE_ID].filter((a): a is string => !!a),
      }
    : undefined;

// Session-create hooks can't tell a first login (which creates the user) from
// a returning one by path alone, so user creation tags the request context.
const signUpRequests = new WeakSet<object>();

const OTP_EMAIL_SUBJECTS = {
  "email-verification": "Verify your email",
  "change-email": "Confirm your new email",
  "sign-in": "Your sign-in code",
  "forget-password": "Reset your password",
} as const;

export const auth = betterAuth({
  // BETTER_AUTH_SECRET and BETTER_AUTH_URL are read from env automatically.
  database: drizzleAdapter(db, {
    provider: "pg",
    usePlural: true,
    schema: { users, sessions, accounts, verifications, rateLimits },
  }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // Accounts can sign in before verifying, but the API and app gate every
    // feature on having a verified email or phone (see @bsocial/shared).
    requireEmailVerification: false,
  },

  socialProviders: {
    ...(google ? { google } : {}),
    ...(apple ? { apple } : {}),
  },

  account: {
    accountLinking: {
      enabled: true,
      // Signing in with Google/Apple using an email that matches an existing
      // account links to it — but only if that account's email is verified
      // (Better Auth's requireLocalEmailVerified default), which blocks
      // pre-registering someone else's email to hijack their later login.
      trustedProviders: ["google", "apple"],
      // Explicit "Link Google/Apple" from settings may use a different email
      // (Apple relay addresses always differ).
      allowDifferentEmails: true,
    },
  },

  session: {
    // Long-lived sessions: valid for 1 year, and the expiry slides forward
    // (at most once a day) while the device keeps using the app.
    expiresIn: 365 * DAY,
    updateAge: DAY,
    // Keep the cookie cache off so a revoked session stops working immediately
    // instead of surviving until a cached cookie expires.
    cookieCache: { enabled: false },
    additionalFields: {
      deviceName: { type: "string", required: false, input: false },
      lastActiveAt: { type: "date", required: false, input: false },
      lastActiveIp: { type: "string", required: false, input: false },
    },
  },

  user: {
    additionalFields: {
      lastActiveAt: { type: "date", required: false, input: false },
    },
  },

  rateLimit: {
    // On by default only in production; the database store works across
    // serverless instances.
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      // Every code costs money (SMS) or reputation (email) — keep sends tight.
      "/phone-number/send-otp": { window: 60, max: 3 },
      "/email-otp/send-verification-otp": { window: 60, max: 3 },
      "/email-otp/request-email-change": { window: 60, max: 3 },
      "/phone-number/verify": { window: 60, max: 10 },
      "/sign-in/*": { window: 60, max: 10 },
      "/sign-up/*": { window: 60, max: 5 },
    },
  },

  databaseHooks: {
    user: {
      create: {
        after: async (_user, ctx) => {
          if (ctx) signUpRequests.add(ctx);
        },
      },
    },
    account: {
      create: {
        after: async (account, ctx) => {
          // Accounts created as part of sign-up aren't "links".
          if (account.providerId === "credential" || (ctx && signUpRequests.has(ctx))) return;
          await db.insert(authEvents).values({
            userId: account.userId,
            type: "account_linked",
            ipAddress: null,
            userAgent: ctx?.headers?.get("user-agent") ?? null,
            deviceName: getDeviceName(ctx?.headers),
            metadata: { providerId: account.providerId },
          });
        },
      },
    },
    session: {
      create: {
        before: async (session, ctx) => ({
          data: {
            ...session,
            deviceName: getDeviceName(ctx?.headers ?? ctx?.request?.headers),
            lastActiveAt: new Date(),
            lastActiveIp: session.ipAddress ?? null,
          },
        }),
        after: async (session, ctx) => {
          await db.insert(authEvents).values({
            userId: session.userId,
            sessionId: session.id,
            type: ctx && signUpRequests.has(ctx) ? "sign_up" : "sign_in",
            ipAddress: session.ipAddress ?? null,
            userAgent: session.userAgent ?? null,
            deviceName: (session.deviceName as string | null) ?? null,
          });
        },
      },
      delete: {
        after: async (session, ctx) => {
          // Expired-session cleanup has no request path; don't log it.
          // Revokes from our own /api/me/sessions routes are logged there.
          const path = ctx?.path;
          if (!path) return;
          const type = path === "/sign-out" ? "sign_out" : path.startsWith("/revoke") ? "session_revoked" : null;
          if (!type) return;
          await db.insert(authEvents).values({
            userId: session.userId,
            sessionId: session.id,
            type,
            ipAddress: session.ipAddress ?? null,
            userAgent: session.userAgent ?? null,
            deviceName: (session.deviceName as string | null) ?? null,
          });
        },
      },
    },
  },

  // Mobile deep-link scheme (see apps/mobile/app.json). `expo()` also trusts
  // exp:// origins automatically in development. appleid.apple.com posts the
  // web OAuth callback (form_post) cross-origin.
  // Other web frontends (Expo web) are trusted too — see lib/web-origins.ts.
  trustedOrigins: ["bsocial://", "https://appleid.apple.com", ...webAppOrigins],

  plugins: [
    username(),

    // Email codes: verify the sign-up email, and add/replace an email
    // (Apple relay and phone-only users) via request-email-change → change-email.
    emailOTP({
      otpLength: 6,
      expiresIn: OTP_TTL_SECONDS,
      allowedAttempts: 5,
      sendVerificationOnSignUp: true,
      // Email-code login isn't offered; don't let it create accounts either.
      disableSignUp: true,
      changeEmail: { enabled: true },
      async sendVerificationOTP({ email, otp, type }) {
        await sendEmail({
          to: email,
          subject: OTP_EMAIL_SUBJECTS[type],
          text: `Your bsocial code is ${otp}. It expires in 5 minutes.\n\nIf you didn't request this, you can ignore this email.`,
        });
      },
    }),

    // Phone: full sign-up/sign-in by SMS code, and adding a phone to an
    // existing account (verify with updatePhoneNumber: true).
    phoneNumber({
      otpLength: 6,
      expiresIn: OTP_TTL_SECONDS,
      allowedAttempts: 5,
      phoneNumberValidator: (phone) => E164_REGEX.test(phone),
      async sendOTP({ phoneNumber, code }) {
        await sendSms({ to: phoneNumber, body: `Your bsocial code is ${code}` });
      },
      signUpOnVerification: {
        // Better Auth requires a unique email; phone users get a placeholder
        // that never counts as a verified contact.
        getTempEmail: placeholderEmailForPhone,
        getTempName: () => "",
      },
    }),

    expo(),
    nextCookies(), // must stay last
  ],
});

export type Session = typeof auth.$Infer.Session;
