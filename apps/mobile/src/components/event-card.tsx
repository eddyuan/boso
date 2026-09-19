import type { Translator } from '@bsocial/shared';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge, Card } from '@/components/ui/controls';
import { Icon } from '@/components/ui/icon';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/lib/i18n';

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
  const { t } = useT();
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
        {met ? <Badge tone="brand" label={t('event.done')} /> : <Badge label={remaining(t, hoursLeft)} />}
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
          {t(met ? 'event.metCount' : 'event.ofTarget', {
            total,
            target: event.target,
            goal: event.goalLabel,
          })}
        </ThemedText>
        {/* Only ever your own number. Nobody else's is available anywhere. */}
        {yours > 0 && (
          <ThemedText type="small" themeColor="textSecondary">
            {t('event.fromYou', { count: yours })}
          </ThemedText>
        )}
      </View>
    </Card>
  );
}

function remaining(t: Translator['t'], hours: number): string {
  if (hours <= 0) return t('event.endingSoon');
  if (hours < 24) return t('event.hoursLeft', { hours: Math.round(hours) });
  return t('event.daysLeft', { days: Math.round(hours / 24) });
}

const styles = StyleSheet.create({
  card: { padding: Spacing.lg, gap: Spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  track: { height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 2 },
  fill: { height: '100%', borderRadius: 4 },
  foot: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
});
