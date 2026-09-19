import { getDisplayName, type TranslationKey, type Translator } from '@bsocial/shared';
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
import { useT } from '@/lib/i18n';
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

/** Server error codes worth a better sentence than the raw message. */
const ERROR_MESSAGES: Record<string, TranslationKey> = {
  last_sign_in_method: 'account.error.lastMethod',
};

function confirm(
  t: Translator['t'],
  title: string,
  message: string,
  action: string,
  onConfirm: () => void,
) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: t('dialog.cancel'), style: 'cancel' },
    { text: action, style: 'destructive', onPress: onConfirm },
  ]);
}

export default function AccountScreen() {
  const theme = useTheme();
  const { t } = useT();
  const { data: session } = authClient.useSession();
  const [account, setAccount] = useState<AccountOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setAccount(await apiFetch<AccountOverview>('/api/me/account'));
    } catch {
      setError(t('account.error.load'));
    }
  }, [t]);

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
      setError(e instanceof Error ? e.message : t('account.error.link'));
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
      const known = code ? ERROR_MESSAGES[code] : undefined;
      setError(known ? t(known) : e instanceof Error ? e.message : t('account.error.unlink'));
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
        subtitle={t(linked ? 'account.linked' : 'account.notLinked')}
        trailing={
          linked ? (
            <RowAction
              tone="danger"
              label={t('account.unlink')}
              onPress={() =>
                confirm(
                  t,
                  t('account.unlinkConfirm.title', { provider: label }),
                  t('account.unlinkConfirm.body', { provider: label }),
                  t('account.unlink'),
                  () => unlink(provider),
                )
              }
            />
          ) : (
            <RowAction label={t('account.link')} onPress={() => link(provider)} />
          )
        }
      />
    );
  };

  return (
    <Screen header={<PageHeader title={t('account.title')} />}>
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
        <SectionTitle>{t('account.contact')}</SectionTitle>
        <Card>
          <ListRow
            icon={
              <IconTile>
                <Icon name="mail" />
              </IconTile>
            }
            title={t('auth.email')}
            subtitle={account?.email ?? t('account.notAdded')}
            trailing={
              account?.email && account.emailVerified ? (
                <Badge label={t('account.verified')} tone="success" icon={<Icon name="check" size={12} color={theme.green} strokeWidth={3} />} />
              ) : account?.email ? (
                <RowAction label={t('account.verify')} onPress={() => router.push({ pathname: '/email', params: { mode: 'verify' } })} />
              ) : (
                <RowAction label={t('account.add')} onPress={() => router.push({ pathname: '/email', params: { mode: 'change' } })} />
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
            title={t('account.phone')}
            subtitle={account?.phoneNumber ?? t('account.notAdded')}
            trailing={
              account?.phoneNumber && account.phoneVerified ? (
                <Badge label={t('account.verified')} tone="success" icon={<Icon name="check" size={12} color={theme.green} strokeWidth={3} />} />
              ) : (
                <RowAction label={t(account?.phoneNumber ? 'account.change' : 'account.add')} onPress={() => router.push('/phone')} />
              )
            }
            onPress={account?.phoneNumber ? () => router.push('/phone') : undefined}
          />
        </Card>
      </View>

      <View style={styles.section}>
        <SectionTitle>{t('account.signInMethods')}</SectionTitle>
        <Card>
          {account?.methods.includes('password') && (
            <>
              <ListRow
                icon={
                  <IconTile>
                    <Icon name="key" />
                  </IconTile>
                }
                title={t('auth.password')}
                subtitle={t('account.enabled')}
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
          title={t('devices.title')}
          subtitle={t('devices.subtitle')}
          trailing={<Icon name="chevron" size={20} color={theme.textSecondary} />}
          onPress={() => router.push('/devices')}
        />
      </Card>

      <View style={styles.bottom}>
        <Button
          variant="danger"
          label={t('dialog.signOut')}
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
