import { getContactStatus } from '@bsocial/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { ErrorText, Field, Screen, TitleBlock } from '@/components/auth-form';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { AuthBackHeader, HeroIcon, VerifyCodeScreen } from '@/components/verify-code';
import { useT } from '@/lib/i18n';
import { useTheme } from '@/hooks/use-theme';
import { authClient, refreshSession } from '@/lib/auth-client';

// mode=verify: confirm the account's current (real) email with a code.
// mode=change: add or replace the email (Apple relay / phone-only accounts, or
//              a typo at sign-up). The code goes to the new address.
export default function EmailScreen() {
  const theme = useTheme();
  const { t } = useT();
  const { mode } = useLocalSearchParams<{ mode?: 'verify' | 'change' }>();
  const { data: session } = authClient.useSession();
  const currentEmail = session && getContactStatus(session.user).hasRealEmail ? session.user.email : null;
  const changing = mode === 'change' || !currentEmail;

  const [email, setEmail] = useState(changing ? '' : (currentEmail ?? ''));
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function requestCode(address: string): Promise<string | null> {
    const { error } = changing
      ? await authClient.emailOtp.requestEmailChange({ newEmail: address })
      : await authClient.emailOtp.sendVerificationOtp({ email: address, type: 'email-verification' });
    return error ? (error.message ?? t('contact.error.send')) : null;
  }

  async function sendCode() {
    const address = email.trim().toLowerCase() || currentEmail;
    if (!address) return setError(t('contact.email.enter'));
    setError(null);
    setLoading(true);
    const message = await requestCode(address);
    setLoading(false);
    if (message) return setError(message);
    setEmail(address);
    setCodeSent(true);
  }

  // Verifying the current email: send the code as soon as the screen opens.
  useEffect(() => {
    if (!changing && currentEmail) sendCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function verify(otp: string): Promise<string | null> {
    const { error } = changing
      ? await authClient.emailOtp.changeEmail({ newEmail: email, otp })
      : await authClient.emailOtp.verifyEmail({ email, otp });
    // An address that belongs to another account silently gets no code, and
    // the change fails here.
    if (error) return error.message ?? t('contact.error.code');
    refreshSession();
    if (router.canGoBack()) router.back();
    return null;
  }

  if (codeSent) {
    return (
      <VerifyCodeScreen
        icon="mail"
        destination={email}
        onVerify={verify}
        onResend={() => requestCode(email)}
        onChangeDestination={() => (changing ? setCodeSent(false) : router.setParams({ mode: 'change' }))}
        changeLabel={t(changing ? 'contact.email.changeShort' : 'contact.email.useDifferent')}
      />
    );
  }

  return (
    <Screen
      header={<AuthBackHeader />}
      footer={
        <>
          <ErrorText message={error} />
          <Button label={t('contact.code.send')} onPress={sendCode} loading={loading} disabled={!email.includes('@')} />
        </>
      }>
      <HeroIcon name="mail" />
      <TitleBlock
        title={t(
          changing ? (currentEmail ? 'contact.email.change' : 'contact.email.add') : 'contact.email.verify',
        )}
        subtitle={t('contact.email.subtitle')}
      />
      <Field
        placeholder="you@example.com"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
        editable={changing}
        autoFocus={changing}
        onSubmitEditing={sendCode}
        leading={<Icon name="mail" size={20} color={theme.textSecondary} />}
      />
    </Screen>
  );
}
