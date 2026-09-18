import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ErrorText, Field, Screen } from '@/components/auth-form';
import { Mascot } from '@/components/mascot/mascot';
import { OrDivider, SocialSignIn } from '@/components/social-sign-in';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { authClient } from '@/lib/auth-client';

export default function SignInScreen() {
  const theme = useTheme();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    setLoading(true);
    const id = identifier.trim();
    // Accept either an email address or a nickname.
    const { error } = id.includes('@')
      ? await authClient.signIn.email({ email: id, password })
      : await authClient.signIn.username({ username: id.replace(/^@/, ''), password });
    setLoading(false);
    // On success, useSession() updates and the root layout swaps to the app.
    if (error) setError(error.message ?? 'Sign in failed');
  }

  return (
    <Screen
      footer={
        <>
          <ErrorText message={error} />
          <Button label="Sign in" onPress={onSubmit} loading={loading} disabled={!identifier || !password} />
          <Pressable onPress={() => router.replace('/sign-up')} accessibilityRole="link" style={styles.footerLink}>
            <ThemedText type="small" themeColor="textSecondary" style={{ fontFamily: 'Nunito_700Bold' }}>
              New here? <ThemedText type="linkPrimary">Create an account</ThemedText>
            </ThemedText>
          </Pressable>
        </>
      }>
      <View style={styles.brand}>
        <Mascot mood="waving" size={104} />
        <ThemedText type="hero" style={{ color: theme.primaryInk, fontSize: 36 }}>
          Tielo
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.center}>
          Your pet keeps your social life going.
        </ThemedText>
      </View>

      <SocialSignIn onError={setError} />
      <OrDivider />

      <Field
        placeholder="Email or nickname"
        value={identifier}
        onChangeText={setIdentifier}
        autoComplete="username"
        textContentType="username"
        leading={<Icon name="mail" size={20} color={theme.textSecondary} />}
      />
      <Field
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry={!showPassword}
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={onSubmit}
        leading={<Icon name="lock" size={20} color={theme.textSecondary} />}
        trailing={
          <Pressable
            onPress={() => setShowPassword((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            hitSlop={10}>
            <Icon name="eye" size={20} color={showPassword ? theme.primaryInk : theme.textSecondary} />
          </Pressable>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.sm },
  center: { textAlign: 'center' },
  footerLink: { alignItems: 'center', paddingVertical: Spacing.sm },
});
