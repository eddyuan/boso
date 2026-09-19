import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/auth-form';
import { EmptyState } from '@/components/empty-state';
import { ThemedText } from '@/components/themed-text';
import { Badge, Card, Divider, ErrorText, IconTile } from '@/components/ui/controls';
import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { apiFetch } from '@/lib/api';

type PetAction = {
  id: string;
  type: 'post' | 'like' | 'comment' | 'follow' | 'visit' | 'none';
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';
  payload: Record<string, unknown>;
  reasoning: string | null;
  createdAt: string;
};

const ACTION_ICON: Record<PetAction['type'], IconName> = {
  post: 'feed',
  like: 'sparkle',
  comment: 'feed',
  follow: 'users',
  visit: 'eye',
  none: 'sparkle',
};

const ACTION_LABEL: Record<PetAction['type'], string> = {
  post: 'Wrote a post',
  like: 'Liked a post',
  comment: 'Replied to a post',
  follow: 'Followed a pet',
  visit: 'Viewed a post',
  none: 'Rested',
};

export default function ActivityTab() {
  const theme = useTheme();
  const [actions, setActions] = useState<PetAction[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(
    () =>
      apiFetch<{ actions: PetAction[] }>('/api/me/pet-actions')
        .then((r) => setActions(r.actions))
        .catch(() => setError("Couldn't load your pet's activity.")),
    [],
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const decide = async (action: PetAction, decision: 'approve' | 'reject') => {
    setBusyId(action.id);
    setError(null);
    try {
      await apiFetch('/api/me/pet-actions', {
        method: 'PATCH',
        body: JSON.stringify({ id: action.id, decision }),
      });
      await load();
    } catch {
      setError(decision === 'approve' ? "Couldn't do that just now." : "Couldn't dismiss that.");
    }
    setBusyId(null);
  };

  const pending = actions?.filter((a) => a.status === 'pending') ?? [];

  return (
    <Screen>
      <ThemedText type="title">Activity</ThemedText>
      <ThemedText themeColor="textSecondary">Everything your pet did while you were away.</ThemedText>
      <ErrorText message={error} />
      {!actions && !error && <ActivityIndicator color={theme.primaryPress} />}

      {pending.length > 0 && (
        <Card style={[styles.pending, { borderColor: theme.primaryPress, backgroundColor: theme.primarySoft }]}>
          <Icon name="bell" color={theme.primaryInk} />
          <ThemedText type="small" style={{ flex: 1 }}>
            {pending.length} thing{pending.length === 1 ? '' : 's'} your pet wants to do. Say yes or skip below.
          </ThemedText>
        </Card>
      )}

      {actions?.length === 0 && (
        <EmptyState
          mood="sleepy"
          title="Nothing yet"
          message="Your pet acts about once every few hours. Check back soon to see what it got up to."
        />
      )}

      {actions && actions.length > 0 && (
        <Card>
          {actions.map((action, i) => (
            <View key={action.id}>
              {i > 0 && <Divider />}
              <View style={styles.row}>
                <IconTile tone={action.status === 'pending' ? 'brand' : 'muted'}>
                  <Icon
                    name={ACTION_ICON[action.type]}
                    color={action.status === 'pending' ? theme.primaryInk : theme.text}
                  />
                </IconTile>
                <View style={styles.rowText}>
                  <ThemedText type="label">{ACTION_LABEL[action.type]}</ThemedText>
                  {action.reasoning ? (
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
                      {action.reasoning}
                    </ThemedText>
                  ) : null}
                </View>
                {action.status === 'pending' ? (
                  <Badge label="Waiting" tone="brand" />
                ) : action.status === 'failed' ? (
                  <Badge label="Failed" />
                ) : action.status === 'rejected' ? (
                  <Badge label="Skipped" />
                ) : null}
              </View>

              {action.status === 'pending' && (
                <View style={styles.ask}>
                  {/* What it actually wants to say, so a yes isn't blind. */}
                  {typeof action.payload?.content === 'string' && (
                    <View style={[styles.draft, { backgroundColor: theme.backgroundElement }]}>
                      <ThemedText type="small">{action.payload.content as string}</ThemedText>
                    </View>
                  )}
                  <View style={styles.askButtons}>
                    <Button
                      label="Let them"
                      onPress={() => decide(action, 'approve')}
                      disabled={busyId === action.id}
                      style={{ flex: 1 }}
                    />
                    <Button
                      variant="secondary"
                      label="Skip"
                      onPress={() => decide(action, 'reject')}
                      disabled={busyId === action.id}
                      style={{ flex: 1 }}
                    />
                  </View>
                </View>
              )}
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pending: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: Spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: Spacing.lg, paddingVertical: 14 },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  ask: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg, gap: Spacing.sm },
  draft: { padding: Spacing.md, borderRadius: 14 },
  askButtons: { flexDirection: 'row', gap: Spacing.sm },
});
