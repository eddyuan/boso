import { getContactStatus } from '@bsocial/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { AuthScreen, ErrorText, Field, PrimaryButton } from '@/components/auth-form';
import { ThemedText } from '@/components/themed-text';
import { authClient, refreshSession } from '@/lib/auth-client';

// mode=verify: confirm the account's current (real) email with a code.
// mode=change: add or replace the email (Apple relay / phone-only accounts, or
//              a typo at sign-up). The code goes to the new address.
export default function EmailScreen() {
  const { mode } = useLocalSearchParams<{ mode?: 'verify' | 'change' }>();
  const { data: session } = authClient.useSession();
  const currentEmail =
    session && getContactStatus(session.user).hasRealEmail ? session.user.email : null;
  const changing = mode === 'change' || !currentEmail;

  const [email, setEmail] = useState(changing ? '' : (currentEmail ?? ''));
  const [otp, setOtp] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Verifying the current email: send the code as soon as the screen opens.
  useEffect(() => {
    if (!changing && currentEmail) sendCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendCode() {
    const address = email.trim().toLowerCase() || currentEmail;
    if (!address) return setError('Enter your email');
    setError(null);
    setLoading(true);
    const { error } = changing
      ? await authClient.emailOtp.requestEmailChange({ newEmail: address })
      : await authClient.emailOtp.sendVerificationOtp({ email: address, type: 'email-verification' });
    setLoading(false);
    if (error) return setError(error.message ?? 'Could not send code');
    setEmail(address);
    setCodeSent(true);
  }

  async function verify() {
    setError(null);
    setLoading(true);
    const { error } = changing
      ? await authClient.emailOtp.changeEmail({ newEmail: email, otp })
      : await authClient.emailOtp.verifyEmail({ email, otp });
    setLoading(false);
    if (error) {
      // An address that belongs to another account silently gets no code, and
      // the change fails here.
      return setError(error.message ?? 'Invalid code');
    }
    refreshSession();
    if (router.canGoBack()) router.back();
  }

  return (
    <AuthScreen title={changing ? (currentEmail ? 'Change email' : 'Add email') : 'Verify email'}>
      {!codeSent ? (
        <>
          <Field
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            editable={changing}
          />
          <ErrorText message={error} />
          <PrimaryButton label="Send code" onPress={sendCode} loading={loading} />
        </>
      ) : (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            Enter the 6-digit code sent to {email}
          </ThemedText>
          <Field
            placeholder="123456"
            value={otp}
            onChangeText={setOtp}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={6}
          />
          <ErrorText message={error} />
          <PrimaryButton label="Verify" onPress={verify} loading={loading} />
          <ThemedText type="link" onPress={sendCode}>
            Resend code
          </ThemedText>
        </>
      )}
    </AuthScreen>
  );
}
