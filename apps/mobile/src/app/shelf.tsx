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
import { useT } from '@/lib/i18n';
import { TREASURE_BY_ID, TREASURE_RARITIES, rarityKey, treasureKey } from '@bsocial/shared';

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
  const { t, day } = useT();
  const [data, setData] = useState<{ treasures: Treasure[]; counts: Record<string, number> } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      apiFetch<{ treasures: Treasure[]; counts: Record<string, number> }>('/api/me/treasures')
        .then(setData)
        .catch(() => setError(t('shelf.error.load')));
    }, [t]),
  );

  const total = data ? Object.values(data.counts).reduce((n, c) => n + c, 0) : 0;
  const kinds = data ? Object.keys(data.counts).length : 0;

  return (
    <Screen
      header={
        <BackHeader
          title={t('shelf.title')}
          trailing={
            data ? (
              <ThemedText type="small" themeColor="textSecondary">
                {t('shelf.summary', { found: total, kinds })}
              </ThemedText>
            ) : undefined
          }
        />
      }>
      <ErrorText message={error} />
      {!data && !error && <ActivityIndicator color={theme.primaryPress} />}

      {data?.treasures.length === 0 && (
        <Card style={styles.card}>
          <ThemedText type="label">{t('shelf.empty.title')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('shelf.empty.body')}
          </ThemedText>
        </Card>
      )}

      {data && data.treasures.length > 0 && (
        <Card style={styles.list}>
          {data.treasures.map((found) => {
            const kind = TREASURE_BY_ID.get(found.kind);
            const rarity = kind?.rarity ?? 'common';
            const tone = RARITY_TONE[rarity]!;
            const count = data.counts[found.kind] ?? 1;
            return (
              <View key={found.id} style={styles.row}>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: rarity === 'common' ? theme.line : theme[tone.fg as 'primaryInk'] },
                  ]}
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <ThemedText type="smallBold" numberOfLines={1}>
                    {t(treasureKey(found.kind))}
                  </ThemedText>
                  <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
                    {[found.placeName, day(found.foundAt)].filter(Boolean).join(' · ')}
                  </ThemedText>
                </View>
                {rarity !== 'common' && <Badge tone="brand" label={t(rarityKey(rarity))} />}
                {count > 1 && (
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('shelf.times', { count })}
                  </ThemedText>
                )}
              </View>
            );
          })}
        </Card>
      )}

      <Card style={styles.card}>
        <ThemedText type="label">{t('shelf.whatTurnsUp')}</ThemedText>
        {TREASURE_RARITIES.map((r) => (
          <View key={r.id} style={styles.rarityRow}>
            <Badge tone={r.id === 'common' ? 'muted' : 'brand'} label={t(rarityKey(r.id))} />
            <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1 }}>
              {TREASURE_BY_ID.size > 0
                ? [...TREASURE_BY_ID.values()]
                    .filter((kind) => kind.rarity === r.id)
                    .map((kind) => t(treasureKey(kind.id)))
                    .join(', ')
                : ''}
            </ThemedText>
          </View>
        ))}
        <ThemedText type="caption" themeColor="textSecondary">
          {t('shelf.venueDecides')}
        </ThemedText>
      </Card>
    </Screen>
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
