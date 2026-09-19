import { INTERESTS, LOCALES, getDisplayName, interestKey, type Locale } from '@bsocial/shared';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { Screen } from '@/components/auth-form';
import { LanguageSheet } from '@/components/language-sheet';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card, ChipGroup, Divider, IconTile, ListRow } from '@/components/ui/controls';
import { Icon } from '@/components/ui/icon';
import { FontFamily, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { apiFetch } from '@/lib/api';
import { authClient } from '@/lib/auth-client';
import { useT } from '@/lib/i18n';

/** The chosen language, named in itself — that's the word someone recognises. */
const languageName = (code: Locale) => LOCALES.find((l) => l.code === code)?.endonym ?? code;

/**
 * You — not your pet.
 *
 * This used to hold both, which meant two subjects in one tab and a pet split
 * across two. The pet has its own tab now, so this is identity and settings: who
 * you are, what you're interested in, and the switches.
 */
export default function ProfileTab() {
  const theme = useTheme();
  const { t, locale, chosen } = useT();
  const { data: session } = authClient.useSession();
  const [showSensitive, setShowSensitive] = useState(false);
  const [savingSensitive, setSavingSensitive] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);

  const user = session?.user;
  // Session is the source of truth; local state only covers the in-flight toggle.
  const sensitiveOn = savingSensitive ? showSensitive : (user?.showSensitiveContent ?? false);

  const toggleSensitive = async (next: boolean) => {
    setShowSensitive(next);
    setSavingSensitive(true);
    try {
      await apiFetch('/api/me/account', {
        method: 'PATCH',
        body: JSON.stringify({ showSensitiveContent: next }),
      });
      // Re-read the session so the feed and map see the new preference.
      await authClient.getSession({ query: { disableCookieCache: true } });
    } catch {
      setShowSensitive(!next);
    }
    setSavingSensitive(false);
  };

  const interests = user?.interests ?? [];

  return (
    <Screen underTabBar>
      <View style={styles.profile}>
        {user?.image ? (
          <Image source={{ uri: user.image }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
            <ThemedText style={{ fontFamily: FontFamily.display, fontSize: 30, color: theme.onPrimary }}>
              {(user?.name?.trim() || user?.username || '?').slice(0, 1).toUpperCase()}
            </ThemedText>
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <ThemedText type="subtitle" numberOfLines={1}>
            {user ? getDisplayName(user) : ''}
          </ThemedText>
          {user?.name?.trim() && user.username ? (
            <ThemedText type="small" themeColor="textSecondary">
              @{user.username}
            </ThemedText>
          ) : null}
        </View>
      </View>

      {interests.length > 0 && (
        <ChipGroup gap={8}>
          {interests.map((value) => {
            const interest = INTERESTS.find((i) => i.value === value);
            return (
              <View key={value} style={[styles.interest, { backgroundColor: theme.primarySoft }]}>
                <ThemedText type="small" style={{ color: theme.primaryInk, fontFamily: FontFamily.bodyBold }}>
                  {interest ? `${interest.emoji} ${t(interestKey(interest.value))}` : value}
                </ThemedText>
              </View>
            );
          })}
        </ChipGroup>
      )}

      <Card>
        <ListRow
          icon={
            <IconTile>
              <Icon name="person" />
            </IconTile>
          }
          title={t('profile.account')}
          subtitle={t('profile.accountBody')}
          trailing={<Icon name="chevron" size={20} color={theme.textSecondary} />}
          onPress={() => router.push('/account')}
        />
        <Divider />
        <ListRow
          icon={
            <IconTile>
              <Icon name="laptop" />
            </IconTile>
          }
          title={t('profile.devices')}
          trailing={<Icon name="chevron" size={20} color={theme.textSecondary} />}
          onPress={() => router.push('/devices')}
        />
        <Divider />
        <ListRow
          icon={
            <IconTile>
              <Icon name="globe" />
            </IconTile>
          }
          title={t('profile.language')}
          subtitle={chosen ? languageName(locale) : t('profile.languageSystem')}
          trailing={<Icon name="chevron" size={20} color={theme.textSecondary} />}
          onPress={() => setLanguageOpen(true)}
        />
        <Divider />
        <ListRow
          icon={
            <IconTile>
              <Icon name="eye" />
            </IconTile>
          }
          title={t('profile.showSensitive')}
          subtitle={t('profile.showSensitiveBody')}
          trailing={
            <Switch
              value={sensitiveOn}
              onValueChange={toggleSensitive}
              disabled={savingSensitive}
              trackColor={{ true: theme.primary, false: theme.backgroundElement }}
              accessibilityLabel={t('profile.showSensitive')}
            />
          }
        />
      </Card>

      <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
        {t('profile.sensitiveNote')}
      </ThemedText>

      <Button
        variant="danger"
        label={t('profile.signOut')}
        icon={<Icon name="logout" size={20} color={theme.red} />}
        onPress={() => authClient.signOut()}
      />

      <LanguageSheet open={languageOpen} onClose={() => setLanguageOpen(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  interest: { paddingHorizontal: 12, height: 32, borderRadius: Radius.pill, justifyContent: 'center' },
  note: { paddingHorizontal: 4 },
});
