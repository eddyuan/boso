import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge, Card } from '@/components/ui/controls';
import { Icon } from '@/components/ui/icon';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type LiveEvent = {
  event: {
    id: string;
    title: string;
    blurb: string | null;
    goalLabel: string;
    target: number;
  };
  total: number;
  yours: number;
  fraction: number;
  hoursLeft: number;
};

/**
 * What the neighbourhood is doing together this week.
 *
 * One shared bar rather than a ranking. There's no position to lose and no list
 * of who's active nearby — your own contribution is shown to you and to nobody
 * else. Once the goal is met the bar stays full and the copy says so, because
 * "done" is the reward; there is no next tier to chase.
 */
export function EventCard({ data }: { data: LiveEvent | null }) {
  const theme = useTheme();
  if (!data) return null;

  const { event, total, yours, fraction, hoursLeft } = data;
  const met = total >= event.target;

  return (
    <Card style={[styles.card, { backgroundColor: theme.primarySoft }]}>
      <View style={styles.head}>
        <Icon name="sparkle" size={16} color={theme.primaryInk} />
        <ThemedText type="label" style={{ flex: 1 }} numberOfLines={1}>
          {event.title}
        </ThemedText>
        {met ? <Badge tone="brand" label="Done" /> : <Badge label={remaining(hoursLeft)} />}
      </View>

      {event.blurb ? (
        <ThemedText type="small" themeColor="textSecondary">
          {event.blurb}
        </ThemedText>
      ) : null}

      <View style={[styles.track, { backgroundColor: theme.background }]}>
        <View
          style={[styles.fill, { width: `${Math.round(fraction * 100)}%`, backgroundColor: theme.primaryInk }]}
        />
      </View>

      <View style={styles.foot}>
        <ThemedText type="smallBold" style={{ flex: 1, color: theme.primaryInk }}>
          {met
            ? `${total} ${event.goalLabel} — goal met`
            : `${total} of ${event.target} ${event.goalLabel}`}
        </ThemedText>
        {/* Only ever your own number. Nobody else's is available anywhere. */}
        {yours > 0 && (
          <ThemedText type="small" themeColor="textSecondary">
            {yours} from you
          </ThemedText>
        )}
      </View>
    </Card>
  );
}

function remaining(hours: number): string {
  if (hours <= 0) return 'Ending';
  if (hours < 24) return `${Math.round(hours)}h left`;
  return `${Math.round(hours / 24)}d left`;
}

const styles = StyleSheet.create({
  card: { padding: Spacing.lg, gap: Spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  track: { height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 2 },
  fill: { height: '100%', borderRadius: 4 },
  foot: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
});
