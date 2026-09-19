import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/auth-form';
import { EmptyState } from '@/components/empty-state';
import { ThemedText } from '@/components/themed-text';
import { Badge, Card, Divider, ErrorText, IconTile } from '@/components/ui/controls';
import { Icon, type IconName } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { apiFetch } from '@/lib/api';
import { timeAgo } from '@/lib/time';

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
  like: 'heart',
  comment: 'bubble',
  follow: 'users',
  visit: 'eye',
  none: 'sparkle',
};

const ACTION_LABEL: Record<PetAction['type'], string> = {
  post: 'Wrote a post',
  like: 'Liked a post',
  comment: 'Replied to a post',
  follow: 'Followed a pet',
  visit: 'Looked at a post',
  none: 'Rested',
};

/**
 * Every decision the pet has made, and why.
 *
 * Its own screen rather than a section on the pet tab: it's retrospective
 * browsing, which nobody opens the app for, and it was the weakest thing
 * competing for space there. Kept because the reasoning is the honest part —
 * the pet acts on your behalf, so you're owed the record.
 */
export default function PetLogScreen() {
  const theme = useTheme();
  const [actions, setActions] = useState<PetAction[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      apiFetch<{ actions: PetAction[] }>('/api/me/pet-actions')
        .then((r) => setActions(r.actions))
        .catch(() => setError("Couldn't load the log."));
    }, []),
  );

  return (
    <Screen
      header={
        <View style={styles.top}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={({ pressed }) => [styles.back, { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.7 : 1 }]}>
            <Icon name="back" />
          </Pressable>
          <ThemedText type="subtitle" style={{ flex: 1 }}>
            What they did
          </ThemedText>
        </View>
      }>
      <ErrorText message={error} />
      {!actions && !error && <ActivityIndicator color={theme.primaryPress} />}

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
                    <ThemedText type="small" themeColor="textSecondary">
                      {action.reasoning}
                    </ThemedText>
                  ) : null}
                  <ThemedText type="caption" themeColor="textSecondary">
                    {timeAgo(action.createdAt)}
                  </ThemedText>
                </View>
                {action.status === 'pending' ? (
                  <Badge label="Waiting" tone="brand" />
                ) : action.status === 'failed' ? (
                  <Badge label="Failed" />
                ) : action.status === 'rejected' ? (
                  <Badge label="Skipped" />
                ) : null}
              </View>
            </View>
          ))}
        </Card>
      )}

      {actions && actions.length > 0 && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
          Every line here was written when the decision was made, not afterwards. A rejected idea stays in
          the log but never becomes a diary entry — the diary is written from what actually happened.
        </ThemedText>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  back: { width: 44, height: 44, borderRadius: Radius.icon, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: Spacing.lg, paddingVertical: 14 },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  note: { paddingHorizontal: 4 },
});
