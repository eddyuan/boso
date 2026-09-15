import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Platform, Pressable, RefreshControl, ScrollView, StyleSheet } from 'react-native';

import { ErrorText } from '@/components/auth-form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { ApiError, apiFetch } from '@/lib/api';
import { refreshSession } from '@/lib/auth-client';
import { linkProvider, type SocialProvider } from '@/lib/social';

type AccountOverview = {
  email: string | null;
  emailVerified: boolean;
  phoneNumber: string | null;
  phoneVerified: boolean;
  contactVerified: boolean;
  linked: { method: string; providerId: string; linkedAt: string }[];
  methods: string[];
};

const PROVIDERS: { id: SocialProvider; label: string }[] = [
  { id: 'google', label: 'Google' },
  { id: 'apple', label: 'Apple' },
];

const ERROR_MESSAGES: Record<string, string> = {
  last_sign_in_method:
    "This is your only way to sign in. Add a phone number or link another account first.",
};

function confirm(message: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(message)) onConfirm();
    return;
  }
  Alert.alert('Are you sure?', message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Unlink', style: 'destructive', onPress: onConfirm },
  ]);
}

export default function AccountScreen() {
  const [account, setAccount] = useState<AccountOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setAccount(await apiFetch<AccountOverview>('/api/me/account'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload when returning from the email/phone screens or a browser link flow.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function link(provider: SocialProvider) {
    setError(null);
    try {
      const message = await linkProvider(provider);
      if (message) setError(message);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Linking failed');
    }
    await load();
  }

  async function unlink(provider: SocialProvider) {
    setError(null);
    try {
      setAccount(
        await apiFetch<AccountOverview>(`/api/me/account/providers/${provider}`, { method: 'DELETE' }),
      );
      refreshSession();
    } catch (e) {
      const code = e instanceof ApiError ? e.code : undefined;
      setError((code && ERROR_MESSAGES[code]) ?? (e instanceof Error ? e.message : 'Unlink failed'));
    }
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
        <ErrorText message={error} />

        <Section title="Contact">
          <Row
            label="Email"
            value={account?.email ?? 'Not added'}
            status={account?.email ? (account.emailVerified ? 'Verified' : 'Not verified') : undefined}>
            {account?.email && !account.emailVerified && (
              <Link href={{ pathname: '/email', params: { mode: 'verify' } }}>
                <ThemedText type="link">Verify</ThemedText>
              </Link>
            )}
            <Link href={{ pathname: '/email', params: { mode: 'change' } }}>
              <ThemedText type="link">{account?.email ? 'Change' : 'Add'}</ThemedText>
            </Link>
          </Row>
          <Row
            label="Phone"
            value={account?.phoneNumber ?? 'Not added'}
            status={account?.phoneNumber ? (account.phoneVerified ? 'Verified' : 'Not verified') : undefined}>
            <Link href="/phone">
              <ThemedText type="link">{account?.phoneNumber ? 'Change' : 'Add'}</ThemedText>
            </Link>
          </Row>
        </Section>

        <Section title="Sign-in methods">
          {account?.methods.includes('password') && <Row label="Password" value="Enabled" />}
          {PROVIDERS.map(({ id, label }) => {
            const linked = account?.linked.some((l) => l.providerId === id);
            return (
              <Row key={id} label={label} value={linked ? 'Linked' : 'Not linked'}>
                <Pressable
                  onPress={() =>
                    linked ? confirm(`Unlink your ${label} account?`, () => unlink(id)) : link(id)
                  }>
                  <ThemedText type="link">{linked ? 'Unlink' : 'Link'}</ThemedText>
                </Pressable>
              </Row>
            );
          })}
        </Section>

        <Link href="/devices">
          <ThemedText type="link">Signed-in devices</ThemedText>
        </Link>
      </ScrollView>
    </ThemedView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <ThemedView style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {title.toUpperCase()}
      </ThemedText>
      <ThemedView type="backgroundElement" style={styles.card}>
        {children}
      </ThemedView>
    </ThemedView>
  );
}

function Row({
  label,
  value,
  status,
  children,
}: {
  label: string;
  value: string;
  status?: string;
  children?: React.ReactNode;
}) {
  return (
    <ThemedView type="backgroundElement" style={styles.row}>
      <ThemedView type="backgroundElement" style={styles.rowText}>
        <ThemedText type="smallBold">{label}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {value}
          {status ? ` · ${status}` : ''}
        </ThemedText>
      </ThemedView>
      <ThemedView type="backgroundElement" style={styles.actions}>
        {children}
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.three, gap: Spacing.four },
  section: { gap: Spacing.two },
  card: { borderRadius: Spacing.three, paddingHorizontal: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.three, gap: Spacing.three },
  rowText: { flex: 1, gap: Spacing.half },
  actions: { flexDirection: 'row', gap: Spacing.three },
});
