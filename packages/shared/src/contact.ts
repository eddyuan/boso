// Contact-verification rules shared by the API (enforcement) and the apps
// (routing to the "verify your contact" screen). Dependency-free so it can be
// bundled by both Next.js and Metro.

// Phone sign-ups have no email yet; Better Auth still needs a unique one, so
// they get a placeholder on this reserved (RFC 2606) domain.
export const PLACEHOLDER_EMAIL_DOMAIN = "phone.bsocial.invalid";

export function placeholderEmailForPhone(phoneNumber: string): string {
  return `${phoneNumber.replace(/\D/g, "")}@${PLACEHOLDER_EMAIL_DOMAIN}`;
}

export function isPlaceholderEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith(`@${PLACEHOLDER_EMAIL_DOMAIN}`);
}

// "Hide My Email" addresses from Sign in with Apple. They forward mail, but
// they aren't a contact the user chose, so they don't satisfy verification.
export function isAppleRelayEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith("@privaterelay.appleid.com");
}

export type ContactUser = {
  email: string;
  emailVerified: boolean;
  phoneNumber?: string | null;
  phoneNumberVerified?: boolean | null;
};

export type ContactStatus = {
  // The email is one the user actually owns (not a placeholder or Apple relay).
  hasRealEmail: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  // Every account needs a verified real email or a verified phone number.
  verified: boolean;
};

export function getContactStatus(user: ContactUser): ContactStatus {
  const hasRealEmail = !isPlaceholderEmail(user.email) && !isAppleRelayEmail(user.email);
  const emailVerified = hasRealEmail && user.emailVerified;
  const phoneVerified = !!user.phoneNumber && !!user.phoneNumberVerified;
  return { hasRealEmail, emailVerified, phoneVerified, verified: emailVerified || phoneVerified };
}

// E.164, e.g. +14165550123
export const E164_REGEX = /^\+[1-9]\d{7,14}$/;
