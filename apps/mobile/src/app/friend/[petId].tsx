import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/auth-form';
import { CompanionArt } from '@/components/mascot/companions';
import { ThemedText } from '@/components/themed-text';
import { Badge, Card, ErrorText } from '@/components/ui/controls';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/lib/i18n';
import { apiFetch } from '@/lib/api';

type Detail = {
  myPetName: string;
  other: {
    petId: string;
    petName: string;
    species: string;
    ownerName: string | null;
    ownerImage: string | null;
    isReal: boolean;
  };
  affinity: number;
  tier: { id: string; label: string; blurb: string; min: number };
  tiers: { id: string; label: string; min: number; blurb: string }[];
  interactions: number;
  becameFriendsAt: string | null;
  lastInteractionAt: string | null;
  halfLifeDays: number;
  timeline: { event: string; points: number; createdAt: string }[];
  loggedTotal: number;
};

/** Plain words for each ledger key, so the timeline reads as events not enums. */
const EVENT_LABEL: Record<string, string> = {
  follow: 'Followed them',
  comment: 'Replied to their post',
  like: 'Liked their post',
  visit: 'Looked at their post',
  received_comment: 'They replied to yours',
  received_like: 'They liked yours',
};

/**
 * One friendship, and how it got there.
 *
 * Reached from the pet's circle on Profile. The point is the timeline: a running
 * score can only say "warmth 18", which is unexplainable — and an unexplainable
 * number is exactly what the bond ledger exists to avoid.
 */
export default function FriendScreen() {
  const theme = useTheme();
  const { timeAgo } = useT();
  const { petId } = useLocalSearchParams<{ petId: string }>();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      apiFetch<Detail>(`/api/me/relationships/${petId}`)
        .then(setData)
        .catch(() => setError("Couldn't load this friendship."));
    }, [petId]),
  );

  const maxTier = data?.tiers[data.tiers.length - 1]?.min ?? 70;

  return (
    <Screen
      header={
        <View style={styles.top}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={({ pressed }) => [styles.back, { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.7 : 1 }]}>
            <Icon name="back" />
          </Pressable>
          <ThemedText type="subtitle" style={{ flex: 1 }} numberOfLines={1}>
            {data ? `${data.myPetName} & ${data.other.petName}` : 'Friendship'}
          </ThemedText>
        </View>
      }>
      <ErrorText message={error} />
      {!data && !error && <ActivityIndicator color={theme.primaryPress} />}

      {data && (
        <>
          <Card style={styles.hero}>
            {data.other.ownerImage ? (
              <Image source={{ uri: data.other.ownerImage }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: theme.primarySoft }]}>
                <CompanionArt species={data.other.species} size={44} />
              </View>
            )}
            <View style={{ flex: 1, gap: 4 }}>
              <ThemedText type="header">{data.other.petName}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {data.other.ownerName?.trim() ? `Lives with ${data.other.ownerName.trim()}` : 'A pet nearby'}
              </ThemedText>
              {data.other.isReal && (
                <Badge
                  tone="brand"
                  label="Real neighbour"
                  icon={<Icon name="shield" size={12} color={theme.primaryInk} strokeWidth={2.6} />}
                />
              )}
            </View>
          </Card>

          <Card style={styles.card}>
            <View style={styles.tierHead}>
              <ThemedText type="header" style={{ flex: 1 }}>
                {data.tier.label}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                warmth {data.affinity.toFixed(1)}
              </ThemedText>
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {data.tier.blurb}.
            </ThemedText>
            <View style={styles.tierBar}>
              {data.tiers.map((t) => (
                <View
                  key={t.id}
                  style={[
                    styles.tierSeg,
                    { backgroundColor: data.affinity >= t.min ? theme.primaryPress : theme.backgroundElement },
                  ]}
                />
              ))}
            </View>
            <View style={styles.tierLabels}>
              {data.tiers.map((t) => (
                <ThemedText
                  key={t.id}
                  type="caption"
                  themeColor={data.tier.id === t.id ? 'primaryInk' : 'textSecondary'}
                  style={{ flex: 1 }}>
                  {t.min}
                </ThemedText>
              ))}
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {data.interactions} interactions
              {data.becameFriendsAt ? ` · friends since ${new Date(data.becameFriendsAt).toLocaleDateString()}` : ''}
              {data.affinity >= maxTier ? ' · the bond of the neighbourhood' : ''}
            </ThemedText>
          </Card>

          <ThemedText type="label" style={styles.section}>
            How they got here
          </ThemedText>
          {data.timeline.length === 0 ? (
            <Card style={styles.card}>
              <ThemedText type="small" themeColor="textSecondary">
                Nothing logged yet. This friendship predates the ledger, so its warmth is real but its
                history wasn&apos;t recorded — anything from here will be.
              </ThemedText>
            </Card>
          ) : (
            <Card style={styles.list}>
              {data.timeline.map((t, i) => (
                <View key={`${t.createdAt}-${i}`} style={styles.row}>
                  <View style={[styles.pip, { backgroundColor: theme.primaryPress }]} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <ThemedText type="small">{EVENT_LABEL[t.event] ?? t.event}</ThemedText>
                    <ThemedText type="caption" themeColor="textSecondary">
                      {timeAgo(t.createdAt)}
                    </ThemedText>
                  </View>
                  <ThemedText type="smallBold" style={{ color: theme.primaryInk }}>
                    +{t.points}
                  </ThemedText>
                </View>
              ))}
            </Card>
          )}

          <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
            Warmth halves about every {data.halfLifeDays} days, so a friendship that stops being fed
            fades rather than standing forever — but nothing disappears overnight. Decay is charged when
            new warmth arrives, not on a sweep.
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
            Kept per direction. One pet can be far keener than the other, and how keen theirs is about
            yours is theirs to know.
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
  avatar: { width: 66, height: 66, borderRadius: 33, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  card: { padding: Spacing.lg, gap: Spacing.sm },
  list: { padding: Spacing.lg, gap: Spacing.md },
  tierHead: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
  tierBar: { flexDirection: 'row', gap: 4, marginTop: 2 },
  tierSeg: { flex: 1, height: 8, borderRadius: 4 },
  tierLabels: { flexDirection: 'row', gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  pip: { width: 8, height: 8, borderRadius: 4 },
  section: { paddingHorizontal: 4, paddingTop: Spacing.sm },
  note: { paddingHorizontal: 4 },
});
