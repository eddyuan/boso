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
import { useTheme } from '@/hooks/use-theme';
import { authClient } from '@/lib/auth-client';

export default function SignUpScreen() {
  const theme = useTheme();
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
    if (error) setError(error.message ?? 'Sign up failed');
  }

  return (
    <Screen
      header={<BackButton onPress={() => router.replace('/sign-in')} />}
      footer={
        <>
          <ErrorText message={error} />
          <Button label="Create account" onPress={onSubmit} loading={loading} disabled={!email || password.length < 8} />
          <Pressable onPress={() => router.replace('/sign-in')} accessibilityRole="link" style={styles.footerLink}>
            <ThemedText type="small" themeColor="textSecondary" style={{ fontFamily: 'Nunito_700Bold' }}>
              Already have an account? <ThemedText type="linkPrimary">Sign in</ThemedText>
            </ThemedText>
          </Pressable>
        </>
      }>
      <TitleBlock
        title="Create your account"
        subtitle="Start with Apple, Google or your phone. You'll set up your profile and pet next."
      />
      <SocialSignIn onError={setError} />
      <OrDivider label="or use email" />
      <Field
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
        leading={<Icon name="mail" size={20} color={theme.textSecondary} />}
      />
      <Field
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        onSubmitEditing={onSubmit}
        leading={<Icon name="lock" size={20} color={theme.textSecondary} />}
      />
      <ThemedText type="small" themeColor="textSecondary" style={{ paddingLeft: 4, marginTop: -Spacing.sm }}>
        At least 8 characters
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  footerLink: { alignItems: 'center', paddingVertical: Spacing.sm },
});
