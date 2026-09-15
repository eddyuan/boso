import { Link } from 'expo-router';
import { useState } from 'react';

import { AuthScreen, ErrorText, Field, PrimaryButton } from '@/components/auth-form';
import { SocialSignIn } from '@/components/social-sign-in';
import { ThemedText } from '@/components/themed-text';
import { authClient } from '@/lib/auth-client';

export default function SignInScreen() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    setLoading(true);
    const id = identifier.trim();
    // Accept either an email address or a username.
    const { error } = id.includes('@')
      ? await authClient.signIn.email({ email: id, password })
      : await authClient.signIn.username({ username: id, password });
    setLoading(false);
    // On success, useSession() updates and the root layout swaps to the app.
    if (error) setError(error.message ?? 'Sign in failed');
  }

  return (
    <AuthScreen title="Sign in">
      <SocialSignIn onError={setError} />
      <Field
        placeholder="Email or username"
        value={identifier}
        onChangeText={setIdentifier}
        autoComplete="username"
        textContentType="username"
      />
      <Field
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
      />
      <ErrorText message={error} />
      <PrimaryButton label="Sign in" onPress={onSubmit} loading={loading} />
      <Link href="/sign-up" replace>
        <ThemedText type="link">No account? Sign up</ThemedText>
      </Link>
    </AuthScreen>
  );
}
