import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { BackHeader } from '@/components/back-header';
import { Screen } from '@/components/auth-form';
import { ThemedText } from '@/components/themed-text';
import { Badge, Card, ErrorText } from '@/components/ui/controls';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { apiFetch } from '@/lib/api';
import { useT } from '@/lib/i18n';

type Entry = {
  id: string;
  day: string;
  entry: string;
  moodScore: number | null;
  stats: { posts: number; comments: number; likes: number; follows: number; views: number; received: number } | null;
};

/**
 * Every diary entry, newest first.
 *
 * Activity shows the latest one because that's the one people come back for; this
 * is the archive. Opening either credits the read once a day — the ritual is
 * reading it, not reaching this screen.
 */
export default function DiaryScreen() {
  const theme = useTheme();
  const { t, n, day: formatDay } = useT();
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      apiFetch<{ entries: Entry[] }>('/api/me/diary?limit=60')
        .then((r) => setEntries(r.entries))
        .catch(() => setError(t('diary.error.load')));
    }, [t]),
  );

  return (
    <Screen header={<BackHeader title={t('diary.title')} />}>
      <ErrorText message={error} />
      {!entries && !error && <ActivityIndicator color={theme.primaryPress} />}

      {entries?.length === 0 && (
        <Card style={styles.card}>
          <ThemedText type="label">{t('diary.empty.title')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('diary.empty.body')}
          </ThemedText>
        </Card>
      )}

      {entries?.map((e) => (
        <Card key={e.id} style={styles.card}>
          <View style={styles.dayRow}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={{ flex: 1 }}>
              {formatDay(e.day)}
            </ThemedText>
            {e.stats && e.stats.received > 0 && <Badge tone="brand" label={n('pet.reacted', e.stats.received)} />}
          </View>
          <ThemedText style={styles.body}>{e.entry}</ThemedText>
          {e.stats && (
            <ThemedText type="caption" themeColor="textSecondary">
              {/* A joined list of independent tallies, not a sentence built from
                  fragments — each item stands alone and is translated whole. */}
              {[
                e.stats.posts ? n('diary.stat.posted', e.stats.posts) : null,
                e.stats.comments ? n('diary.stat.replied', e.stats.comments) : null,
                e.stats.follows ? n('diary.stat.followed', e.stats.follows) : null,
                e.stats.views ? n('diary.stat.looked', e.stats.views) : null,
              ]
                .filter(Boolean)
                .join(' · ') || t('diary.quietOne')}
            </ThemedText>
          )}
        </Card>
      ))}

      {entries && entries.length > 0 && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
          {t('diary.kept')}
        </ThemedText>
      )}
    </Screen>
  );
}


const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  back: { width: 44, height: 44, borderRadius: Radius.icon, alignItems: 'center', justifyContent: 'center' },
  card: { padding: Spacing.lg, gap: Spacing.sm },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  body: { fontSize: 16, lineHeight: 25 },
  note: { paddingHorizontal: 4, paddingTop: Spacing.xs },
});
