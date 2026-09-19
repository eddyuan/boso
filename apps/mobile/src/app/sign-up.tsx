import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { ErrorText, Field, Screen, TitleBlock } from '@/components/auth-form';
import { OrDivider, SocialSignIn } from '@/components/social-sign-in';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { BackButton } from '@/components/ui/controls';
import { Icon } from '@/components/ui/icon';
import { Spacing } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { useTheme } from '@/hooks/use-theme';
import { authClient } from '@/lib/auth-client';

export default function SignUpScreen() {
  const theme = useTheme();
  const { t } = useT();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    setLoading(true);
    // Nickname and display name are collected during onboarding.
    const { error } = await authClient.signUp.email({ name: '', email: email.trim(), password });
    setLoading(false);
    if (error) setError(error.message ?? t('auth.error.signUp'));
  }

  return (
    <Screen
      header={<BackButton onPress={() => router.replace('/sign-in')} />}
      footer={
        <>
          <ErrorText message={error} />
          <Button label={t('auth.createAccount')} onPress={onSubmit} loading={loading} disabled={!email || password.length < 8} />
          <Pressable onPress={() => router.replace('/sign-in')} accessibilityRole="link" style={styles.footerLink}>
            <ThemedText type="small" themeColor="textSecondary" style={{ fontFamily: 'Nunito_700Bold' }}>
              {t('auth.haveAccount')} <ThemedText type="linkPrimary">{t('auth.signIn')}</ThemedText>
            </ThemedText>
          </Pressable>
        </>
      }>
      <TitleBlock
        title={t('auth.signUpTitle')}
        subtitle={t('auth.signUpSubtitle')}
      />
      <SocialSignIn onError={setError} />
      <OrDivider label={t('auth.orUseEmail')} />
      <Field
        placeholder={t('auth.email')}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
        leading={<Icon name="mail" size={20} color={theme.textSecondary} />}
      />
      <Field
        placeholder={t('auth.password')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        onSubmitEditing={onSubmit}
        leading={<Icon name="lock" size={20} color={theme.textSecondary} />}
      />
      <ThemedText type="small" themeColor="textSecondary" style={{ paddingLeft: 4, marginTop: -Spacing.sm }}>
        {t('auth.passwordHint')}
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  footerLink: { alignItems: 'center', paddingVertical: Spacing.sm },
});
