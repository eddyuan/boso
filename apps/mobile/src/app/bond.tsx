import { LEVELS, type BondProgress, type XpEvent } from '@bsocial/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/auth-form';
import { CompanionArt } from '@/components/mascot/companions';
import { ThemedText } from '@/components/themed-text';
import { Badge, Card, ErrorText } from '@/components/ui/controls';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { apiFetch } from '@/lib/api';

type Pet = { id: string; name: string; species: string };
type Response = { pet: Pet | null; bond: BondProgress | null; xpValues: Record<XpEvent, number> | null };

/** What each act is called, in the order the list should read. */
const EARNS: { event: XpEvent; label: string; note?: string }[] = [
  { event: 'new_friendship', label: 'Make a new friend' },
  { event: 'answer_ask', label: 'Answer what your pet asked', note: 'Yes or no — both count' },
  { event: 'errand_returned', label: 'An errand comes home with something' },
  { event: 'wrote_post', label: 'You post' },
  { event: 'wrote_reply', label: 'You reply to somebody' },
  { event: 'received_reaction', label: 'Someone reacts to your pet\u2019s post' },
  { event: 'read_diary', label: 'Read last night\u2019s diary', note: 'Once a day' },
  { event: 'care', label: 'Each daily care', note: 'Three a day' },
];

/**
 * The bond, and what it unlocks.
 *
 * The award values come from the server rather than from the shared constants:
 * they're live-tunable, so rendering the constants would show a figure the ledger
 * doesn't pay. Levels themselves aren't tunable, so those are read locally.
 */
export default function BondScreen() {
  const theme = useTheme();
  const [data, setData] = useState<Response | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      apiFetch<Response>('/api/pets')
        .then(setData)
        .catch(() => setError("Couldn't load the bond."));
    }, []),
  );

  const bond = data?.bond;
  const pct = bond && bond.levelSpan > 0 ? Math.round((bond.intoLevel / bond.levelSpan) * 100) : 100;

  return (
    <Screen header={<Back title={data?.pet ? `Bond with ${data.pet.name}` : 'Bond'} />}>
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
                BOND LEVEL
              </ThemedText>
              <ThemedText style={styles.big}>{bond.level}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {bond.xp.toLocaleString()} XP
                {bond.next ? ` · ${bond.xpToNext} to level ${bond.level + 1}` : ''}
              </ThemedText>
              <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
                <View style={[styles.fill, { width: `${pct}%`, backgroundColor: theme.primaryInk }]} />
              </View>
              <Badge tone="brand" label="Never goes down" />
            </View>
          </Card>

          <ThemedText type="label" style={styles.section}>
            What earns the most
          </ThemedText>
          <Card style={styles.list}>
            {EARNS.map((e) => {
              const amount = data.xpValues?.[e.event];
              if (amount === undefined) return null;
              return (
                <View key={e.event} style={styles.row}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <ThemedText type="small">{e.label}</ThemedText>
                    {e.note && (
                      <ThemedText type="caption" themeColor="textSecondary">
                        {e.note}
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
            Saying no pays the same as saying yes. Paying only for &ldquo;yes&rdquo; would be buying
            agreement rather than rewarding the habit of answering.
          </ThemedText>

          <ThemedText type="label" style={styles.section}>
            Unlocks
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
                      {l.unlock}
                    </ThemedText>
                    {current && (
                      <ThemedText type="caption" themeColor="textSecondary">
                        You are here
                      </ThemedText>
                    )}
                  </View>
                  <ThemedText type="caption" themeColor="textSecondary">
                    {l.kind}
                  </ThemedText>
                </View>
              );
            })}
          </Card>

          <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
            Every unlock is something your pet wears, carries, collects or is called. Nothing here locks
            who you can see, meet or talk to — the map, posting, replies, friendships, playdates and
            errands are all open from the first minute.
          </ThemedText>
        </>
      )}
    </Screen>
  );
}

function Back({ title }: { title: string }) {
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
    </View>
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
