import type { Translator } from '@bsocial/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { BackHeader } from '@/components/back-header';
import { Screen } from '@/components/auth-form';
import { ThemedText } from '@/components/themed-text';
import { Badge, Card, ErrorText } from '@/components/ui/controls';
import { Icon } from '@/components/ui/icon';
import { useT } from '@/lib/i18n';
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
  const { t, num } = useT();
  const [data, setData] = useState<Live | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      apiFetch<Live>('/api/me/event')
        .then(setData)
        .catch(() => setError(t('event.error.load')));
    }, [t]),
  );

  const met = data?.event ? data.total >= data.event.target : false;

  return (
    <Screen header={<BackHeader title={data?.event?.title ?? t('event.title')} />}>
      <ErrorText message={error} />
      {!data && !error && <ActivityIndicator color={theme.primaryPress} />}

      {data && !data.event && (
        <Card style={styles.card}>
          <ThemedText type="label">{t('event.none.title')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('event.none.body')}
          </ThemedText>
        </Card>
      )}

      {data?.event && (
        <>
          <Card style={styles.hero}>
            <ThemedText style={styles.big}>
              {num(data.total)}
              <ThemedText type="subtitle" themeColor="textSecondary">
                {` / ${num(data.event.target)}`}
              </ThemedText>
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('event.inNeighbourhood', { goal: data.event.goalLabel })}
            </ThemedText>
            <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
              <View
                style={[styles.fill, { width: `${Math.round(data.fraction * 100)}%`, backgroundColor: theme.primaryInk }]}
              />
            </View>
            <View style={styles.badges}>
              <Badge tone="brand" label={met ? t('event.goalMet') : remaining(t, data.hoursLeft)} />
              {data.yours > 0 && <Badge label={t('event.fromYou', { count: data.yours })} />}
            </View>
          </Card>

          {data.event.blurb && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
              {data.event.blurb}
            </ThemedText>
          )}

          <Card style={styles.card}>
            <ThemedText type="label">{t('event.notARanking.title')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('event.notARanking.body')}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('event.realOnly')}
            </ThemedText>
          </Card>

          <Card style={styles.card}>
            <ThemedText type="label">{t('event.counted.title')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('event.counted.body')}
            </ThemedText>
          </Card>
        </>
      )}
    </Screen>
  );
}

function remaining(t: Translator['t'], hours: number): string {
  if (hours <= 0) return t('event.endingSoon');
  if (hours < 24) return t('event.hoursLeft', { hours: Math.round(hours) });
  return t('event.daysLeft', { days: Math.round(hours / 24) });
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
