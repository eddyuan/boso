import type { MissionId } from '@bsocial/shared';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/controls';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type Mission = {
  id: MissionId;
  label: string;
  hint: string;
  target: number;
  xp: number;
  progress: number;
  done: boolean;
};

/**
 * Today's three goals.
 *
 * Deliberately not a streak counter and deliberately not dismissable: it's a
 * suggestion for someone who opened the app without a reason. Nothing here
 * scolds — an unfinished mission looks exactly like an unstarted one, because
 * the cost of missing a day is zero and the UI shouldn't imply otherwise.
 */
export function MissionsCard({ missions }: { missions: Mission[] }) {
  const theme = useTheme();
  if (missions.length === 0) return null;

  const doneCount = missions.filter((m) => m.done).length;

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <ThemedText type="label" style={{ flex: 1 }}>
          Today
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {doneCount} of {missions.length}
        </ThemedText>
      </View>

      {missions.map((m) => (
        <View key={m.id} style={styles.row}>
          <View
            style={[
              styles.tick,
              {
                backgroundColor: m.done ? theme.primary : 'transparent',
                borderColor: m.done ? theme.primary : theme.line,
              },
            ]}>
            {m.done && <Icon name="check" size={12} color={theme.onPrimary} strokeWidth={3.2} />}
          </View>
          <View style={styles.rowText}>
            <ThemedText type="smallBold" style={m.done ? { color: theme.textSecondary } : undefined}>
              {m.label}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {/* Partial progress is only worth showing when there are steps to
                  show — "0/1" reads like a failure, "1/3" reads like progress. */}
              {m.target > 1 && !m.done ? `${m.progress}/${m.target} · ${m.hint}` : m.hint}
            </ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            +{m.xp}
          </ThemedText>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.lg, gap: Spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  rowText: { flex: 1, minWidth: 0, gap: 1 },
  tick: {
    width: 22,
    height: 22,
    borderRadius: Radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
