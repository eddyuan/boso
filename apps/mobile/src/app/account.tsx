import { getDisplayName } from '@bsocial/shared';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/auth-form';
import { PageHeader } from '@/components/page-header';
import { RestartProfileButton } from '@/components/restart-profile-button';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Badge, Card, Divider, ErrorText, IconTile, ListRow, RowAction, SectionTitle } from '@/components/ui/controls';
import { AppleLogo, GoogleLogo, Icon } from '@/components/ui/icon';
import { FontFamily, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError, apiFetch } from '@/lib/api';
import { authClient, refreshSession } from '@/lib/auth-client';
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

const ERROR_MESSAGES: Record<string, string> = {
  last_sign_in_method: 'This is your only way to sign in. Add a phone number or link another account first.',
};

function confirm(title: string, message: string, action: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: action, style: 'destructive', onPress: onConfirm },
  ]);
}

export default function AccountScreen() {
  const theme = useTheme();
  const { data: session } = authClient.useSession();
  const [account, setAccount] = useState<AccountOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setAccount(await apiFetch<AccountOverview>('/api/me/account'));
    } catch {
      setError("Couldn't load your account.");
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
      setAccount(await apiFetch<AccountOverview>(`/api/me/account/providers/${provider}`, { method: 'DELETE' }));
      refreshSession();
    } catch (e) {
      const code = e instanceof ApiError ? e.code : undefined;
      setError((code && ERROR_MESSAGES[code]) ?? (e instanceof Error ? e.message : 'Unlink failed'));
    }
  }

  const user = session?.user;
  const displayName = user ? getDisplayName(user) : '';
  const isLinked = (p: SocialProvider) => account?.linked.some((l) => l.providerId === p) ?? false;

  const providerRow = (provider: SocialProvider, label: string, logo: React.ReactNode) => {
    const linked = isLinked(provider);
    return (
      <ListRow
        icon={<IconTile>{logo}</IconTile>}
        title={label}
        subtitle={linked ? 'Linked' : 'Not linked'}
        trailing={
          linked ? (
            <RowAction
              tone="danger"
              label="Unlink"
              onPress={() => confirm(`Unlink ${label}?`, `You won't be able to sign in with ${label} anymore.`, 'Unlink', () => unlink(provider))}
            />
          ) : (
            <RowAction label="Link" onPress={() => link(provider)} />
          )
        }
      />
    );
  };

  return (
    <Screen header={<PageHeader title="Account" />}>
      {user && (
        <View style={styles.profile}>
          {user.image ? (
            <Image source={{ uri: user.image }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
              <ThemedText style={{ fontFamily: FontFamily.display, fontSize: 26, color: theme.onPrimary }}>
                {(user.name?.trim() || user.username || '?').slice(0, 1).toUpperCase()}
              </ThemedText>
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <ThemedText type="subtitle" numberOfLines={1}>
              {displayName}
            </ThemedText>
            {user.name?.trim() && user.username ? (
              <ThemedText type="small" themeColor="textSecondary">
                @{user.username}
              </ThemedText>
            ) : null}
          </View>
        </View>
      )}

      <ErrorText message={error} />

      <View style={styles.section}>
        <SectionTitle>Contact</SectionTitle>
        <Card>
          <ListRow
            icon={
              <IconTile>
                <Icon name="mail" />
              </IconTile>
            }
            title="Email"
            subtitle={account?.email ?? 'Not added'}
            trailing={
              account?.email && account.emailVerified ? (
                <Badge label="Verified" tone="success" icon={<Icon name="check" size={12} color={theme.green} strokeWidth={3} />} />
              ) : account?.email ? (
                <RowAction label="Verify" onPress={() => router.push({ pathname: '/email', params: { mode: 'verify' } })} />
              ) : (
                <RowAction label="Add" onPress={() => router.push({ pathname: '/email', params: { mode: 'change' } })} />
              )
            }
            onPress={account?.email ? () => router.push({ pathname: '/email', params: { mode: 'change' } }) : undefined}
          />
          <Divider />
          <ListRow
            icon={
              <IconTile>
                <Icon name="phone" />
              </IconTile>
            }
            title="Phone"
            subtitle={account?.phoneNumber ?? 'Not added'}
            trailing={
              account?.phoneNumber && account.phoneVerified ? (
                <Badge label="Verified" tone="success" icon={<Icon name="check" size={12} color={theme.green} strokeWidth={3} />} />
              ) : (
                <RowAction label={account?.phoneNumber ? 'Change' : 'Add'} onPress={() => router.push('/phone')} />
              )
            }
            onPress={account?.phoneNumber ? () => router.push('/phone') : undefined}
          />
        </Card>
      </View>

      <View style={styles.section}>
        <SectionTitle>Sign-in methods</SectionTitle>
        <Card>
          {account?.methods.includes('password') && (
            <>
              <ListRow
                icon={
                  <IconTile>
                    <Icon name="key" />
                  </IconTile>
                }
                title="Password"
                subtitle="Enabled"
              />
              <Divider />
            </>
          )}
          {providerRow('google', 'Google', <GoogleLogo />)}
          <Divider />
          {providerRow('apple', 'Apple', <AppleLogo />)}
        </Card>
      </View>

      <Card>
        <ListRow
          icon={
            <IconTile>
              <Icon name="laptop" />
            </IconTile>
          }
          title="Signed-in devices"
          subtitle="Manage where you're signed in"
          trailing={<Icon name="chevron" size={20} color={theme.textSecondary} />}
          onPress={() => router.push('/devices')}
        />
      </Card>

      <View style={styles.bottom}>
        <Button
          variant="danger"
          label="Sign out"
          icon={<Icon name="logout" size={20} color={theme.red} />}
          onPress={() => authClient.signOut()}
        />
        <RestartProfileButton />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  section: { gap: Spacing.sm },
  bottom: { marginTop: Spacing.lg, gap: Spacing.sm },
});
