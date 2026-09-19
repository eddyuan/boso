import { E164_REGEX } from '@bsocial/shared';
import { router } from 'expo-router';
import { useState } from 'react';

import { ErrorText, Field, Screen, TitleBlock } from '@/components/auth-form';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { AuthBackHeader, HeroIcon, VerifyCodeScreen } from '@/components/verify-code';
import { useT } from '@/lib/i18n';
import { useTheme } from '@/hooks/use-theme';
import { authClient, refreshSession } from '@/lib/auth-client';

// Signed out: sign in or sign up with an SMS code.
// Signed in: add or replace the account's phone number.
export default function PhoneScreen() {
  const theme = useTheme();
  const { t } = useT();
  const { data: session } = authClient.useSession();
  const signedIn = !!session;

  const [phoneNumber, setPhoneNumber] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function requestCode(phone: string): Promise<string | null> {
    const { error } = await authClient.phoneNumber.sendOtp({ phoneNumber: phone });
    return error ? (error.message ?? t('contact.error.send')) : null;
  }

  async function sendCode() {
    const phone = phoneNumber.replace(/[\s()-]/g, '');
    if (!E164_REGEX.test(phone)) {
      setError(t('contact.phone.hint'));
      return;
    }
    setError(null);
    setLoading(true);
    const message = await requestCode(phone);
    setLoading(false);
    if (message) return setError(message);
    setPhoneNumber(phone);
    setCodeSent(true);
  }

  async function verify(code: string): Promise<string | null> {
    const { error } = await authClient.phoneNumber.verify(
      signedIn ? { phoneNumber, code, updatePhoneNumber: true, disableSession: true } : { phoneNumber, code },
    );
    if (error) return error.message ?? t('contact.error.code');
    refreshSession();
    if (signedIn && router.canGoBack()) router.back();
    return null;
  }

  if (codeSent) {
    return (
      <VerifyCodeScreen
        icon="phone"
        destination={phoneNumber}
        onVerify={verify}
        onResend={() => requestCode(phoneNumber)}
        onChangeDestination={() => setCodeSent(false)}
        changeLabel={t('contact.phone.changeShort')}
      />
    );
  }

  return (
    <Screen
      header={<AuthBackHeader />}
      footer={
        <>
          <ErrorText message={error} />
          <Button label={t('contact.code.send')} onPress={sendCode} loading={loading} disabled={phoneNumber.length < 8} />
        </>
      }>
      <HeroIcon name="phone" />
      <TitleBlock
        title={t(signedIn ? 'contact.phone.add' : 'auth.continueWithPhone')}
        subtitle={t('contact.phone.subtitle')}
      />
      <Field
        placeholder="+1 416 555 0123"
        value={phoneNumber}
        onChangeText={setPhoneNumber}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        autoFocus
        onSubmitEditing={sendCode}
        leading={<Icon name="phone" size={20} color={theme.textSecondary} />}
      />
    </Screen>
  );
}
