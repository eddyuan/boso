import {
  LEVELS,
  unlockKey,
  unlockKindKey,
  type BondProgress,
  type TranslationKey,
  type XpEvent,
} from '@bsocial/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { BackHeader } from '@/components/back-header';
import { Screen } from '@/components/auth-form';
import { CompanionArt } from '@/components/mascot/companions';
import { ThemedText } from '@/components/themed-text';
import { Badge, Card, ErrorText } from '@/components/ui/controls';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { apiFetch } from '@/lib/api';
import { useT } from '@/lib/i18n';

type Pet = { id: string; name: string; species: string };
type Response = { pet: Pet | null; bond: BondProgress | null; xpValues: Record<XpEvent, number> | null };

/**
 * The order the list should read in — biggest award first.
 *
 * The ordering is the only thing this table carries now; the wording is looked up
 * per event, so the list can't disagree with the catalogue.
 */
const EARNS: XpEvent[] = [
  'new_friendship',
  'answer_ask',
  'errand_returned',
  'wrote_post',
  'wrote_reply',
  'received_reaction',
  'read_diary',
  'care',
];

/** The two awards that come with a cap worth stating. Everything else is plain. */
const XP_NOTES: Partial<Record<XpEvent, TranslationKey>> = {
  answer_ask: 'bond.earns.answer_ask.note',
  read_diary: 'bond.earns.read_diary.note',
  care: 'bond.earns.care.note',
};

/**
 * The bond, and what it unlocks.
 *
 * The award values come from the server rather than from the shared constants:
 * they're live-tunable, so rendering the constants would show a figure the ledger
 * doesn't pay. Levels themselves aren't tunable, so those are read locally.
 */
export default function BondScreen() {
  const theme = useTheme();
  const { t } = useT();
  const [data, setData] = useState<Response | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      apiFetch<Response>('/api/pets')
        .then(setData)
        .catch(() => setError(t('bond.error.load')));
    }, [t]),
  );

  const bond = data?.bond;
  const pct = bond && bond.levelSpan > 0 ? Math.round((bond.intoLevel / bond.levelSpan) * 100) : 100;

  return (
    <Screen header={<BackHeader title={data?.pet ? t('bond.title', { name: data.pet.name }) : t('bond.plainTitle')} />}>
      <ErrorText message={error} />
      {!data && !error && <ActivityIndicator color={theme.primaryPress} />}

      {bond && data?.pet && (
        <>
          <Card style={styles.hero}>
            <View style={[styles.halo, { backgroundColor: theme.primarySoft }]}>
              <CompanionArt species={data.pet.species} size={62} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <ThemedText type="caption" themeColor="textSecondary">
                {t('bond.level')}
              </ThemedText>
              <ThemedText style={styles.big}>{bond.level}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {bond.next
                  ? t('bond.toNext', { xp: bond.xp, remaining: bond.xpToNext, level: bond.level + 1 })
                  : t('bond.xp', { xp: bond.xp })}
              </ThemedText>
              <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
                <View style={[styles.fill, { width: `${pct}%`, backgroundColor: theme.primaryInk }]} />
              </View>
              <Badge tone="brand" label={t('bond.neverGoesDown')} />
            </View>
          </Card>

          <ThemedText type="label" style={styles.section}>
            {t('bond.earnsMost')}
          </ThemedText>
          <Card style={styles.list}>
            {EARNS.map((event) => {
              const amount = data.xpValues?.[event];
              if (amount === undefined) return null;
              const note = XP_NOTES[event];
              return (
                <View key={event} style={styles.row}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <ThemedText type="small">{t(`bond.earns.${event}`)}</ThemedText>
                    {note && (
                      <ThemedText type="caption" themeColor="textSecondary">
                        {t(note)}
                      </ThemedText>
                    )}
                  </View>
                  <ThemedText type="smallBold" style={{ color: theme.primaryInk }}>
                    +{amount}
                  </ThemedText>
                </View>
              );
            })}
          </Card>
          <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
            {t('bond.rejectingPays')}
          </ThemedText>

          <ThemedText type="label" style={styles.section}>
            {t('bond.unlocks')}
          </ThemedText>
          <Card style={styles.list}>
            {LEVELS.map((l) => {
              const have = bond.level >= l.level;
              const current = bond.level === l.level;
              return (
                <View key={l.level} style={styles.row}>
                  <View
                    style={[
                      styles.pip,
                      {
                        backgroundColor: current ? theme.primary : have ? theme.primarySoft : theme.backgroundElement,
                      },
                    ]}>
                    {have ? (
                      <Icon name="check" size={13} color={current ? theme.onPrimary : theme.primaryInk} strokeWidth={3} />
                    ) : (
                      <ThemedText type="caption" themeColor="textSecondary">
                        {l.level}
                      </ThemedText>
                    )}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <ThemedText type="small" style={have ? undefined : { color: theme.textSecondary }}>
                      {t(unlockKey(l.level))}
                    </ThemedText>
                    {current && (
                      <ThemedText type="caption" themeColor="textSecondary">
                        {t('bond.youAreHere')}
                      </ThemedText>
                    )}
                  </View>
                  <ThemedText type="caption" themeColor="textSecondary">
                    {t(unlockKindKey(l.kind))}
                  </ThemedText>
                </View>
              );
            })}
          </Card>

          <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
            {t('bond.expressionOnly')}
          </ThemedText>
        </>
      )}
    </Screen>
  );
}


const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  back: { width: 44, height: 44, borderRadius: Radius.icon, alignItems: 'center', justifyContent: 'center' },
  hero: { padding: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  halo: { width: 86, height: 86, borderRadius: 43, alignItems: 'center', justifyContent: 'center' },
  big: { fontSize: 38, lineHeight: 42, fontWeight: '700' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 2 },
  fill: { height: '100%', borderRadius: 3 },
  section: { paddingHorizontal: 4, paddingTop: Spacing.sm },
  list: { padding: Spacing.lg, gap: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  pip: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  note: { paddingHorizontal: 4 },
});
