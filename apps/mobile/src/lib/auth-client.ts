import { createAuthClient } from 'better-auth/react';
import { emailOTPClient, phoneNumberClient, usernameClient } from 'better-auth/client/plugins';
import { expoClient } from '@better-auth/expo/client';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

// Shown in the "signed-in devices" list, e.g. "Edward's iPhone".
const deviceName = Device.deviceName ?? Device.modelName ?? 'Unknown device';

export const authClient = createAuthClient({
  baseURL: API_URL,
  fetchOptions: {
    headers: { 'x-device-name': deviceName },
  },
  plugins: [
    usernameClient(),
    emailOTPClient(),
    phoneNumberClient(),
    // Persists the (1-year) session in the Keychain/Keystore via SecureStore.
    expoClient({
      scheme: 'bsocial',
      storagePrefix: 'bsocial',
      storage: SecureStore,
    }),
  ],
});

// Re-fetch the session so screens gated on user fields (e.g. contact
// verification) update after an email/phone change.
export function refreshSession() {
  authClient.$store.notify('$sessionSignal');
}
