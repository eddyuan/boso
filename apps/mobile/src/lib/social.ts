import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

import { authClient } from '@/lib/auth-client';

export type SocialProvider = 'google' | 'apple';

// Where the OAuth flow lands afterwards. On native, expoClient turns a relative
// path into a bsocial:// deep link. On web the API is another origin, so the
// path must be absolute or the browser ends up on the API server.
function callbackURL(path: string): string {
  return Platform.OS === 'web' ? `${window.location.origin}${path}` : path;
}

export async function isNativeAppleAvailable(): Promise<boolean> {
  return Platform.OS === 'ios' && (await AppleAuthentication.isAvailableAsync());
}

type NativeAppleResult =
  | { canceled: true }
  | {
      canceled: false;
      token: string;
      nonce: string;
      name?: { firstName?: string; lastName?: string };
    };

// Shows Apple's native sheet and returns the identity token for the server.
async function getNativeAppleToken(): Promise<NativeAppleResult> {
  const nonce = Crypto.randomUUID();
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce,
    });
    if (!credential.identityToken) throw new Error('Apple did not return an identity token');
    return {
      canceled: false,
      token: credential.identityToken,
      nonce,
      // Apple only shares the user's name on the very first authorization.
      name: credential.fullName?.givenName
        ? {
            firstName: credential.fullName.givenName ?? undefined,
            lastName: credential.fullName.familyName ?? undefined,
          }
        : undefined,
    };
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return { canceled: true };
    throw e;
  }
}

// Returns an error message, or null on success/cancel.
export async function signInWithProvider(provider: SocialProvider): Promise<string | null> {
  if (provider === 'apple' && (await isNativeAppleAvailable())) {
    const apple = await getNativeAppleToken();
    if (apple.canceled) return null;
    const { error } = await authClient.signIn.social({
      provider: 'apple',
      idToken: {
        token: apple.token,
        nonce: apple.nonce,
        user: apple.name ? { name: apple.name } : undefined,
      },
    });
    return error ? (error.message ?? 'Sign in with Apple failed') : null;
  }

  // Browser flow; on native, expoClient opens an auth session and returns via bsocial://.
  const { error } = await authClient.signIn.social({ provider, callbackURL: callbackURL('/') });
  return error ? (error.message ?? `Sign in with ${provider} failed`) : null;
}

// Links a provider to the signed-in account. Returns an error message, or null.
export async function linkProvider(provider: SocialProvider): Promise<string | null> {
  if (provider === 'apple' && (await isNativeAppleAvailable())) {
    const apple = await getNativeAppleToken();
    if (apple.canceled) return null;
    const { error } = await authClient.linkSocial({
      provider: 'apple',
      idToken: { token: apple.token, nonce: apple.nonce },
    });
    return error ? (error.message ?? 'Linking Apple failed') : null;
  }

  const { error } = await authClient.linkSocial({ provider, callbackURL: callbackURL('/account') });
  return error ? (error.message ?? `Linking ${provider} failed`) : null;
}
