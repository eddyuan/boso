import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Platform, Pressable, RefreshControl, StyleSheet } from 'react-native';

import { PrimaryButton } from '@/components/auth-form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
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

export default function DevicesScreen() {
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ sessions: DeviceSession[] }>('/api/me/sessions');
      setSessions(data.sessions);
    } finally {
      setLoading(false);
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

  const others = sessions.filter((s) => !s.current).length;

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={sessions}
        keyExtractor={(s) => s.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        renderItem={({ item }) => (
          <ThemedView type="backgroundElement" style={styles.row}>
            <ThemedView type="backgroundElement" style={styles.rowText}>
              <ThemedText type="smallBold">
                {item.deviceName ?? 'Unknown device'}
                {item.current ? '  (this device)' : ''}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Last active{' '}
                {item.lastActiveAt ? new Date(item.lastActiveAt).toLocaleString() : 'unknown'}
                {item.lastActiveIp ? ` · ${item.lastActiveIp}` : ''}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Signed in {new Date(item.createdAt).toLocaleDateString()}
              </ThemedText>
            </ThemedView>
            <Pressable
              onPress={() =>
                confirm(
                  item.current ? 'Sign out of this device?' : `Sign out ${item.deviceName ?? 'this device'}?`,
                  () => revoke(item),
                )
              }>
              <ThemedText type="link">Sign out</ThemedText>
            </Pressable>
          </ThemedView>
        )}
        ListFooterComponent={
          others > 0 ? (
            <PrimaryButton
              label={`Sign out ${others} other device${others === 1 ? '' : 's'}`}
              onPress={() => confirm('Sign out all other devices?', revokeOthers)}
            />
          ) : null
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: Spacing.three, gap: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  rowText: { flex: 1, gap: Spacing.half },
});
