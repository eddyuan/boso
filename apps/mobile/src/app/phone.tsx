import { E164_REGEX } from '@bsocial/shared';
import { router } from 'expo-router';
import { useState } from 'react';

import { AuthScreen, ErrorText, Field, PrimaryButton } from '@/components/auth-form';
import { ThemedText } from '@/components/themed-text';
import { authClient, refreshSession } from '@/lib/auth-client';

// Signed out: sign in or sign up with an SMS code.
// Signed in: add or replace the account's phone number.
export default function PhoneScreen() {
  const { data: session } = authClient.useSession();
  const signedIn = !!session;

  const [phoneNumber, setPhoneNumber] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function sendCode() {
    const phone = phoneNumber.replace(/[\s()-]/g, '');
    if (!E164_REGEX.test(phone)) {
      setError('Enter your number with country code, e.g. +14165550123');
      return;
    }
    setError(null);
    setLoading(true);
    const { error } = await authClient.phoneNumber.sendOtp({ phoneNumber: phone });
    setLoading(false);
    if (error) return setError(error.message ?? 'Could not send code');
    setPhoneNumber(phone);
    setCodeSent(true);
  }

  async function verify() {
    setError(null);
    setLoading(true);
    const { error } = await authClient.phoneNumber.verify(
      signedIn
        ? { phoneNumber, code, updatePhoneNumber: true, disableSession: true }
        : { phoneNumber, code },
    );
    setLoading(false);
    if (error) return setError(error.message ?? 'Invalid code');

    refreshSession();
    if (signedIn && router.canGoBack()) router.back();
  }

  return (
    <AuthScreen title={signedIn ? 'Add phone number' : 'Continue with phone'}>
      {!codeSent ? (
        <>
          <Field
            placeholder="+1 416 555 0123"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
          />
          <ErrorText message={error} />
          <PrimaryButton label="Send code" onPress={sendCode} loading={loading} />
        </>
      ) : (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            Enter the 6-digit code sent to {phoneNumber}
          </ThemedText>
          <Field
            placeholder="123456"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={6}
          />
          <ErrorText message={error} />
          <PrimaryButton label="Verify" onPress={verify} loading={loading} />
          <ThemedText type="link" onPress={() => setCodeSent(false)}>
            Use a different number
          </ThemedText>
        </>
      )}
    </AuthScreen>
  );
}
