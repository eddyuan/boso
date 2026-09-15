import { Link } from 'expo-router';
import { useState } from 'react';

import { AuthScreen, ErrorText, Field, PrimaryButton } from '@/components/auth-form';
import { SocialSignIn } from '@/components/social-sign-in';
import { ThemedText } from '@/components/themed-text';
import { authClient } from '@/lib/auth-client';

export default function SignUpScreen() {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    setLoading(true);
    const { error } = await authClient.signUp.email({
      name: name.trim(),
      username: username.trim(),
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (error) setError(error.message ?? 'Sign up failed');
  }

  return (
    <AuthScreen title="Create account">
      <SocialSignIn onError={setError} />
      <Field
        placeholder="Name"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        autoComplete="name"
      />
      <Field
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
        autoComplete="username-new"
      />
      <Field
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
      />
      <Field
        placeholder="Password (8+ characters)"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <ErrorText message={error} />
      <PrimaryButton label="Sign up" onPress={onSubmit} loading={loading} />
      <Link href="/sign-in" replace>
        <ThemedText type="link">Already have an account? Sign in</ThemedText>
      </Link>
    </AuthScreen>
  );
}
