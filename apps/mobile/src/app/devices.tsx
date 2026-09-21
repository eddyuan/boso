import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/auth-form';
import { useConfirm } from '@/components/confirm-dialog';
import { PageHeader } from '@/components/page-header';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Badge, Card, ErrorText, IconTile } from '@/components/ui/controls';
import { Icon } from '@/components/ui/icon';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { apiFetch } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { authClient } from '@/lib/auth-client';

type DeviceSession = {
  id: string;
  deviceName: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  lastActiveAt: string | null;
  lastActiveIp: string | null;
  createdAt: string;
  current: boolean;
};

const looksLikeComputer = (s: DeviceSession) => /mac|windows|linux|chrome os/i.test(`${s.deviceName} ${s.userAgent}`);

export default function DevicesScreen() {
  const theme = useTheme();
  const { t, n, timeAgo, day } = useT();
  const confirm = useConfirm();
  const [sessions, setSessions] = useState<DeviceSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ sessions: DeviceSession[] }>('/api/me/sessions');
      setSessions(data.sessions);
    } catch {
      setError(t('devices.error.load'));
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  async function revoke(s: DeviceSession) {
    if (s.current) {
      await authClient.signOut();
      return;
    }
    setError(null);
    try {
      await apiFetch(`/api/me/sessions/${s.id}`, { method: 'DELETE' });
    } catch {
      // Previously silent: the row stayed put and nothing said why.
      setError(t('devices.error.signOut'));
    }
    await load();
  }

  async function revokeOthers() {
    setError(null);
    try {
      await apiFetch('/api/me/sessions', { method: 'DELETE' });
    } catch {
      setError(t('devices.error.signOut'));
    }
    await load();
  }

  const others = sessions?.filter((s) => !s.current).length ?? 0;

  return (
    <Screen
      header={<PageHeader title={t('devices.title')} />}
      footer={
        others > 0 ? (
          <Button
            variant="danger"
            label={n('devices.signOutOtherCount', others)}
            onPress={async () => {
              const ok = await confirm({
                title: t('devices.signOutOthers'),
                action: t('dialog.signOut'),
                destructive: true,
              });
              if (ok) revokeOthers();
            }}
          />
        ) : undefined
      }>
      <ThemedText themeColor="textSecondary">
        {t('devices.note')}
      </ThemedText>
      <ErrorText message={error} />
      {!sessions && !error && <ActivityIndicator color={theme.primaryPress} />}
      {sessions?.map((s) => (
        <Card key={s.id} style={styles.card}>
          <IconTile tone={s.current ? 'brand' : 'muted'}>
            <Icon name={looksLikeComputer(s) ? 'laptop' : 'phone'} color={s.current ? theme.primaryInk : theme.text} />
          </IconTile>
          <View style={styles.cardText}>
            <View style={styles.titleRow}>
              <ThemedText type="label" style={{ fontSize: 16, flexShrink: 1 }} numberOfLines={1}>
                {s.deviceName ?? t('devices.unknown')}
              </ThemedText>
              {s.current && <Badge label={t('devices.thisDevice')} tone="brand" />}
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {[
                t('devices.active', { when: s.lastActiveAt ? timeAgo(s.lastActiveAt) : t('common.never') }),
                s.lastActiveIp,
              ]
                .filter(Boolean)
                .join(' · ')}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('devices.signedInOn', { date: day(s.createdAt) })}
            </ThemedText>
          </View>
          <Pressable
            onPress={async () => {
              const ok = await confirm({
                title: s.current
                  ? t('devices.signOutThis')
                  : t('devices.signOutNamed', { name: s.deviceName ?? t('devices.unknown') }),
                action: t('dialog.signOut'),
                destructive: true,
              });
              if (ok) revoke(s);
            }}
            accessibilityRole="button"
            hitSlop={10}>
            <ThemedText type="linkPrimary" style={{ color: theme.red, fontSize: 15 }}>
              {t('dialog.signOut')}
            </ThemedText>
          </Pressable>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, padding: Spacing.lg },
  cardText: { flex: 1, minWidth: 0, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
});
