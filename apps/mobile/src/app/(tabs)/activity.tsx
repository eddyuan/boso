import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/auth-form';
import { EmptyState } from '@/components/empty-state';
import { ThemedText } from '@/components/themed-text';
import { Badge, Card, Divider, ErrorText, IconTile } from '@/components/ui/controls';
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
  visit: 'pin',
  none: 'sparkle',
};

const ACTION_LABEL: Record<PetAction['type'], string> = {
  post: 'Wrote a post',
  like: 'Liked a post',
  comment: 'Replied to a post',
  follow: 'Followed a pet',
  visit: 'Visited a profile',
  none: 'Rested',
};

export default function ActivityTab() {
  const theme = useTheme();
  const [actions, setActions] = useState<PetAction[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      apiFetch<{ actions: PetAction[] }>('/api/me/pet-actions')
        .then((r) => setActions(r.actions))
        .catch(() => setError("Couldn't load your pet's activity."));
    }, []),
  );

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
            {pending.length} action{pending.length === 1 ? '' : 's'} waiting for your approval. Approving them comes next.
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
                ) : null}
              </View>
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
});
