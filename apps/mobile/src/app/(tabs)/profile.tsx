import { INTERESTS, getDisplayName } from '@bsocial/shared';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { Screen } from '@/components/auth-form';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card, ChipGroup, Divider, IconTile, ListRow } from '@/components/ui/controls';
import { Icon } from '@/components/ui/icon';
import { FontFamily, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { apiFetch } from '@/lib/api';
import { authClient } from '@/lib/auth-client';

/**
 * You — not your pet.
 *
 * This used to hold both, which meant two subjects in one tab and a pet split
 * across two. The pet has its own tab now, so this is identity and settings: who
 * you are, what you're interested in, and the switches.
 */
export default function ProfileTab() {
  const theme = useTheme();
  const { data: session } = authClient.useSession();
  const [showSensitive, setShowSensitive] = useState(false);
  const [savingSensitive, setSavingSensitive] = useState(false);

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
                  {interest ? `${interest.emoji} ${interest.label}` : value}
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
          title="Account"
          subtitle="Contact, sign-in methods"
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
          title="Signed-in devices"
          trailing={<Icon name="chevron" size={20} color={theme.textSecondary} />}
          onPress={() => router.push('/devices')}
        />
        <Divider />
        <ListRow
          icon={
            <IconTile>
              <Icon name="eye" />
            </IconTile>
          }
          title="Show sensitive content"
          subtitle="Skip the cover on posts marked sensitive"
          trailing={
            <Switch
              value={sensitiveOn}
              onValueChange={toggleSensitive}
              disabled={savingSensitive}
              trackColor={{ true: theme.primary, false: theme.backgroundElement }}
              accessibilityLabel="Show sensitive content"
            />
          }
        />
      </Card>

      <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
        Sensitive content is off by default and never suggested. It sits here for the people who go
        looking for it.
      </ThemedText>

      <Button
        variant="danger"
        label="Sign out"
        icon={<Icon name="logout" size={20} color={theme.red} />}
        onPress={() => authClient.signOut()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  interest: { paddingHorizontal: 12, height: 32, borderRadius: Radius.pill, justifyContent: 'center' },
  note: { paddingHorizontal: 4 },
});
