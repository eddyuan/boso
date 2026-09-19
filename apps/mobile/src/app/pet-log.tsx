import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { BackHeader } from '@/components/back-header';
import { Screen } from '@/components/auth-form';
import { EmptyState } from '@/components/empty-state';
import { ThemedText } from '@/components/themed-text';
import { Badge, Card, Divider, ErrorText, IconTile } from '@/components/ui/controls';
import { Icon, type IconName } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/lib/i18n';
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
  like: 'heart',
  comment: 'bubble',
  follow: 'users',
  visit: 'eye',
  none: 'sparkle',
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
  const { t, timeAgo } = useT();
  const [actions, setActions] = useState<PetAction[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      apiFetch<{ actions: PetAction[] }>('/api/me/pet-actions')
        .then((r) => setActions(r.actions))
        .catch(() => setError(t('petLog.error.load')));
    }, [t]),
  );

  return (
    <Screen
      header={
        <BackHeader title={t('petLog.title')} />
      }>
      <ErrorText message={error} />
      {!actions && !error && <ActivityIndicator color={theme.primaryPress} />}

      {actions?.length === 0 && (
        <EmptyState
          mood="sleepy"
          title={t('petLog.empty.title')}
          message={t('petLog.empty.body')}
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
                  <ThemedText type="label">{t(`petLog.action.${action.type}`)}</ThemedText>
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
                  <Badge label={t('petLog.waiting')} tone="brand" />
                ) : action.status === 'failed' ? (
                  <Badge label={t('petLog.failed')} />
                ) : action.status === 'rejected' ? (
                  <Badge label={t('petLog.skipped')} />
                ) : null}
              </View>
            </View>
          ))}
        </Card>
      )}

      {actions && actions.length > 0 && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
          {t('petLog.note')}
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
