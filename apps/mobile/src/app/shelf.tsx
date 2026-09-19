import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/auth-form';
import { ThemedText } from '@/components/themed-text';
import { Badge, Card, ErrorText } from '@/components/ui/controls';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { apiFetch } from '@/lib/api';
import { TREASURE_BY_ID, TREASURE_RARITIES, rarityLabel } from '@bsocial/shared';

type Treasure = { id: string; kind: string; foundAt: string; placeName: string | null };

const RARITY_TONE: Record<string, { bg: string; fg: string }> = {
  common: { bg: 'backgroundElement', fg: 'textSecondary' },
  uncommon: { bg: 'primarySoft', fg: 'green' },
  rare: { bg: 'primarySoft', fg: 'primaryInk' },
  legendary: { bg: 'primarySoft', fg: 'primaryInk' },
};

/**
 * Everything the pet has brought home.
 *
 * The place leads on every row: a pebble is dull, a pebble from the beach you
 * walked past on Tuesday is a souvenir. Nothing here is purchasable and nothing
 * gates anything — rarer tiers only become *possible* as the bond grows.
 */
export default function ShelfScreen() {
  const theme = useTheme();
  const [data, setData] = useState<{ treasures: Treasure[]; counts: Record<string, number> } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      apiFetch<{ treasures: Treasure[]; counts: Record<string, number> }>('/api/me/treasures')
        .then(setData)
        .catch(() => setError("Couldn't load the shelf."));
    }, []),
  );

  const total = data ? Object.values(data.counts).reduce((n, c) => n + c, 0) : 0;
  const kinds = data ? Object.keys(data.counts).length : 0;

  return (
    <Screen
      header={
        <Back
          title="The shelf"
          trailing={
            data ? (
              <ThemedText type="small" themeColor="textSecondary">
                {total} found · {kinds} kinds
              </ThemedText>
            ) : undefined
          }
        />
      }>
      <ErrorText message={error} />
      {!data && !error && <ActivityIndicator color={theme.primaryPress} />}

      {data?.treasures.length === 0 && (
        <Card style={styles.card}>
          <ThemedText type="label">Nothing yet</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Most wanders find nothing — that&apos;s what makes finding something feel like anything. Send
            your pet out and see what turns up.
          </ThemedText>
        </Card>
      )}

      {data && data.treasures.length > 0 && (
        <Card style={styles.list}>
          {data.treasures.map((t) => {
            const kind = TREASURE_BY_ID.get(t.kind);
            const rarity = kind?.rarity ?? 'common';
            const tone = RARITY_TONE[rarity]!;
            const count = data.counts[t.kind] ?? 1;
            return (
              <View key={t.id} style={styles.row}>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: rarity === 'common' ? theme.line : theme[tone.fg as 'primaryInk'] },
                  ]}
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <ThemedText type="smallBold" numberOfLines={1}>
                    {kind?.label ?? t.kind}
                  </ThemedText>
                  <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
                    {[t.placeName, foundWhen(t.foundAt)].filter(Boolean).join(' · ')}
                  </ThemedText>
                </View>
                {rarity !== 'common' && <Badge tone="brand" label={rarityLabel(rarity)} />}
                {count > 1 && (
                  <ThemedText type="small" themeColor="textSecondary">
                    ×{count}
                  </ThemedText>
                )}
              </View>
            );
          })}
        </Card>
      )}

      <Card style={styles.card}>
        <ThemedText type="label">What turns up where</ThemedText>
        {TREASURE_RARITIES.map((r) => (
          <View key={r.id} style={styles.rarityRow}>
            <Badge tone={r.id === 'common' ? 'muted' : 'brand'} label={r.label} />
            <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1 }}>
              {TREASURE_BY_ID.size > 0
                ? [...TREASURE_BY_ID.values()]
                    .filter((t) => t.rarity === r.id)
                    .map((t) => t.label)
                    .join(', ')
                : ''}
            </ThemedText>
          </View>
        ))}
        <ThemedText type="caption" themeColor="textSecondary">
          A beach turns up sea glass rather than a cinema ticket — the venue decides what&apos;s possible.
        </ThemedText>
      </Card>
    </Screen>
  );
}

function foundWhen(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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
  list: { padding: Spacing.lg, gap: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  dot: { width: 10, height: 10, borderRadius: 5 },
  rarityRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
});
