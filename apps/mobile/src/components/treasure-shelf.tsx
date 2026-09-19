import { TREASURE_BY_ID, rarityKey, treasureKey } from '@bsocial/shared';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge, Card } from '@/components/ui/controls';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/lib/i18n';

export type Treasure = {
  id: string;
  kind: string;
  foundAt: string;
  placeName: string | null;
};

/**
 * The shelf: what the pet has brought home.
 *
 * Purely cosmetic by design — nothing here gates a feature or can be bought.
 * The place is the point: a pebble is dull, a pebble from the beach you walked
 * past on Tuesday is a souvenir.
 */
export function TreasureShelf({
  treasures,
  counts,
  petName,
}: {
  treasures: Treasure[];
  counts: Record<string, number>;
  petName: string;
}) {
  const theme = useTheme();
  const { t: translate, n, day } = useT();
  if (treasures.length === 0) return null;

  const distinct = Object.keys(counts).length;
  const total = Object.values(counts).reduce((n, c) => n + c, 0);

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <ThemedText type="label" style={{ flex: 1 }}>
          {translate('shelf.ownerTitle', { name: petName })}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {translate('shelf.summary', { found: total, kinds: distinct })}
        </ThemedText>
      </View>

      {treasures.slice(0, 6).map((t) => {
        const kind = TREASURE_BY_ID.get(t.kind);
        const rare = kind && kind.rarity !== 'common';
        return (
          <View key={t.id} style={styles.row}>
            <View
              style={[
                styles.dot,
                { backgroundColor: rare ? theme.primary : theme.backgroundElement },
              ]}
            />
            <View style={styles.rowText}>
              <ThemedText type="smallBold" numberOfLines={1}>
                {translate(treasureKey(t.kind))}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {[t.placeName, day(t.foundAt)].filter(Boolean).join(' · ')}
              </ThemedText>
            </View>
            {/* Only worth a badge when it's actually uncommon; labelling every
                bottle cap "Common" is noise. */}
            {rare && <Badge tone="brand" label={translate(rarityKey(kind!.rarity))} />}
            {counts[t.kind] > 1 && (
              <ThemedText type="small" themeColor="textSecondary">
                {translate('shelf.times', { count: counts[t.kind]! })}
              </ThemedText>
            )}
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.lg, gap: Spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  rowText: { flex: 1, minWidth: 0, gap: 1 },
  dot: { width: 10, height: 10, borderRadius: Radius.pill },
});
