import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/auth-form';
import { PageHeader } from '@/components/page-header';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Badge, Card, ErrorText, IconTile } from '@/components/ui/controls';
import { Icon } from '@/components/ui/icon';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { apiFetch } from '@/lib/api';
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

function confirm(message: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(message)) onConfirm();
    return;
  }
  Alert.alert('Are you sure?', message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Sign out', style: 'destructive', onPress: onConfirm },
  ]);
}

function relativeTime(iso: string | null): string {
  if (!iso) return 'unknown';
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 5) return 'now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

const looksLikeComputer = (s: DeviceSession) => /mac|windows|linux|chrome os/i.test(`${s.deviceName} ${s.userAgent}`);

export default function DevicesScreen() {
  const theme = useTheme();
  const [sessions, setSessions] = useState<DeviceSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ sessions: DeviceSession[] }>('/api/me/sessions');
      setSessions(data.sessions);
    } catch {
      setError("Couldn't load your devices.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function revoke(s: DeviceSession) {
    if (s.current) {
      await authClient.signOut();
      return;
    }
    await apiFetch(`/api/me/sessions/${s.id}`, { method: 'DELETE' });
    await load();
  }

  async function revokeOthers() {
    await apiFetch('/api/me/sessions', { method: 'DELETE' });
    await load();
  }

  const others = sessions?.filter((s) => !s.current).length ?? 0;

  return (
    <Screen
      header={<PageHeader title="Signed-in devices" />}
      footer={
        others > 0 ? (
          <Button
            variant="danger"
            label={`Sign out ${others} other device${others === 1 ? '' : 's'}`}
            onPress={() => confirm('Sign out all other devices?', revokeOthers)}
          />
        ) : undefined
      }>
      <ThemedText themeColor="textSecondary">
        You stay signed in on each device for up to a year. Sign out anything you don&apos;t recognize.
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
                {s.deviceName ?? 'Unknown device'}
              </ThemedText>
              {s.current && <Badge label="This device" tone="brand" />}
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              Active {relativeTime(s.lastActiveAt)}
              {s.lastActiveIp ? ` · ${s.lastActiveIp}` : ''}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Signed in {new Date(s.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </ThemedText>
          </View>
          <Pressable
            onPress={() => confirm(s.current ? 'Sign out of this device?' : `Sign out ${s.deviceName ?? 'this device'}?`, () => revoke(s))}
            accessibilityRole="button"
            hitSlop={10}>
            <ThemedText type="linkPrimary" style={{ color: theme.red, fontSize: 15 }}>
              Sign out
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
