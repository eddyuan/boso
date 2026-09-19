import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { BackHeader } from '@/components/back-header';
import { Screen } from '@/components/auth-form';
import { ThemedText } from '@/components/themed-text';
import { Badge, Card, ErrorText } from '@/components/ui/controls';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { apiFetch } from '@/lib/api';

type Live = {
  event: { id: string; title: string; blurb: string | null; goalLabel: string; target: number } | null;
  total: number;
  yours: number;
  fraction: number;
  hoursLeft: number;
};

/**
 * The running event in full.
 *
 * Activity shows the bar; this explains it — what counts, what doesn't, and why
 * it's a shared total rather than a ranking. The reasoning belongs somewhere a
 * player can find it, or the absence of a leaderboard reads as an omission.
 */
export default function EventScreen() {
  const theme = useTheme();
  const [data, setData] = useState<Live | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      apiFetch<Live>('/api/me/event')
        .then(setData)
        .catch(() => setError("Couldn't load the event."));
    }, []),
  );

  const met = data?.event ? data.total >= data.event.target : false;

  return (
    <Screen header={<BackHeader title={data?.event?.title ?? 'Event'} />}>
      <ErrorText message={error} />
      {!data && !error && <ActivityIndicator color={theme.primaryPress} />}

      {data && !data.event && (
        <Card style={styles.card}>
          <ThemedText type="label">Nothing running</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Events are occasional and time-boxed. There&apos;s nothing to join at the moment.
          </ThemedText>
        </Card>
      )}

      {data?.event && (
        <>
          <Card style={styles.hero}>
            <ThemedText style={styles.big}>
              {data.total.toLocaleString()}
              <ThemedText type="subtitle" themeColor="textSecondary">
                {' / '}
                {data.event.target.toLocaleString()}
              </ThemedText>
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {data.event.goalLabel} in your neighbourhood
            </ThemedText>
            <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
              <View
                style={[styles.fill, { width: `${Math.round(data.fraction * 100)}%`, backgroundColor: theme.primaryInk }]}
              />
            </View>
            <View style={styles.badges}>
              <Badge tone="brand" label={met ? 'Goal met' : remaining(data.hoursLeft)} />
              {data.yours > 0 && <Badge label={`${data.yours} from you`} />}
            </View>
          </Card>

          {data.event.blurb && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
              {data.event.blurb}
            </ThemedText>
          )}

          <Card style={styles.card}>
            <ThemedText type="label">One bar, not a ranking</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              There&apos;s no position to lose and no list of who&apos;s busy near you. Your own number is
              shown to you and to nobody else.
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Only real accounts count toward it — seeded pets can make a neighbourhood look inhabited,
              but they can&apos;t fill this in.
            </ThemedText>
          </Card>

          <Card style={styles.card}>
            <ThemedText type="label">Counted from what actually happened</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Nothing is tallied separately, so the bar can&apos;t disagree with the thing it&apos;s
              counting. Past the target it stays full and says so — there&apos;s no next tier.
            </ThemedText>
          </Card>
        </>
      )}
    </Screen>
  );
}

function remaining(hours: number): string {
  if (hours <= 0) return 'Ending';
  if (hours < 24) return `${Math.round(hours)}h left`;
  return `${Math.round(hours / 24)}d left`;
}


const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  back: { width: 44, height: 44, borderRadius: Radius.icon, alignItems: 'center', justifyContent: 'center' },
  card: { padding: Spacing.lg, gap: Spacing.sm },
  hero: { padding: Spacing.xl, gap: Spacing.sm, alignItems: 'center' },
  big: { fontSize: 44, lineHeight: 50, fontWeight: '700' },
  track: { height: 12, borderRadius: 6, overflow: 'hidden', alignSelf: 'stretch', marginTop: Spacing.sm },
  fill: { height: '100%', borderRadius: 6 },
  badges: { flexDirection: 'row', gap: Spacing.sm, marginTop: 2 },
  note: { paddingHorizontal: 4 },
});
