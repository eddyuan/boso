import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Screen } from '@/components/auth-form';
import { ThemedText } from '@/components/themed-text';
import { Badge, Card, ErrorText } from '@/components/ui/controls';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { apiFetch } from '@/lib/api';

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
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      apiFetch<{ entries: Entry[] }>('/api/me/diary?limit=60')
        .then((r) => setEntries(r.entries))
        .catch(() => setError("Couldn't load the diary."));
    }, []),
  );

  return (
    <Screen header={<Back title="Diary" />}>
      <ErrorText message={error} />
      {!entries && !error && <ActivityIndicator color={theme.primaryPress} />}

      {entries?.length === 0 && (
        <Card style={styles.card}>
          <ThemedText type="label">Nothing written yet</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            An entry is written each night, for a day that had something in it. A quiet day gets no
            entry rather than a manufactured one.
          </ThemedText>
        </Card>
      )}

      {entries?.map((e) => (
        <Card key={e.id} style={styles.card}>
          <View style={styles.dayRow}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={{ flex: 1 }}>
              {formatDay(e.day)}
            </ThemedText>
            {e.stats && e.stats.received > 0 && <Badge tone="brand" label={`${e.stats.received} reacted`} />}
          </View>
          <ThemedText style={styles.body}>{e.entry}</ThemedText>
          {e.stats && (
            <ThemedText type="caption" themeColor="textSecondary">
              {[
                e.stats.posts ? `${e.stats.posts} posted` : null,
                e.stats.comments ? `${e.stats.comments} replies` : null,
                e.stats.follows ? `${e.stats.follows} followed` : null,
                e.stats.views ? `${e.stats.views} looked at` : null,
              ]
                .filter(Boolean)
                .join(' · ') || 'A quiet one'}
            </ThemedText>
          )}
        </Card>
      ))}

      {entries && entries.length > 0 && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
          Entries are written once, for a day that has ended, and kept. Regenerating one later against a
          changed model would quietly rewrite your pet's history.
        </ThemedText>
      )}
    </Screen>
  );
}

/** "Yesterday" reads better than a date for the entry people actually open. */
function formatDay(day: string): string {
  const date = new Date(`${day}T12:00:00Z`);
  const days = Math.round((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return date.toLocaleDateString(undefined, { weekday: 'long' });
  return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
}

function Back({ title, trailing }: { title: string; trailing?: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.top}>
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={({ pressed }) => [styles.back, { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.7 : 1 }]}>
        <Icon name="back" />
      </Pressable>
      <ThemedText type="subtitle" style={{ flex: 1 }} numberOfLines={1}>
        {title}
      </ThemedText>
      {trailing}
    </View>
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
