import { tierBlurbKey, tierLabelKey, type AffinityEvent, type RelationshipTier } from '@bsocial/shared';
import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
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
  tier: { id: RelationshipTier; min: number };
  tiers: { id: RelationshipTier; min: number }[];
  interactions: number;
  becameFriendsAt: string | null;
  lastInteractionAt: string | null;
  halfLifeDays: number;
  timeline: { event: AffinityEvent; points: number; createdAt: string }[];
  loggedTotal: number;
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
  const { t, n, timeAgo, day } = useT();
  const { petId } = useLocalSearchParams<{ petId: string }>();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      apiFetch<Detail>(`/api/me/relationships/${petId}`)
        .then(setData)
        .catch(() => setError(t('friend.error.load')));
    }, [petId, t]),
  );

  const maxTier = data?.tiers[data.tiers.length - 1]?.min ?? 70;

  return (
    <Screen
      header={
        <BackHeader
          title={data ? t('friend.pair', { mine: data.myPetName, theirs: data.other.petName }) : t('friend.title')}
        />
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
                {data.other.ownerName?.trim()
                  ? t('friend.livesWith', { name: data.other.ownerName.trim() })
                  : t('friend.aPetNearby')}
              </ThemedText>
              {data.other.isReal && (
                <Badge
                  tone="brand"
                  label={t('friend.realNeighbour')}
                  icon={<Icon name="shield" size={12} color={theme.primaryInk} strokeWidth={2.6} />}
                />
              )}
            </View>
          </Card>

          <Card style={styles.card}>
            <View style={styles.tierHead}>
              <ThemedText type="header" style={{ flex: 1 }}>
                {t(tierLabelKey(data.tier.id))}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t('friend.warmth', { value: data.affinity.toFixed(1) })}
              </ThemedText>
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {t(tierBlurbKey(data.tier.id))}
            </ThemedText>
            <View style={styles.tierBar}>
              {data.tiers.map((tier) => (
                <View
                  key={tier.id}
                  style={[
                    styles.tierSeg,
                    { backgroundColor: data.affinity >= tier.min ? theme.primaryPress : theme.backgroundElement },
                  ]}
                />
              ))}
            </View>
            <View style={styles.tierLabels}>
              {data.tiers.map((tier) => (
                <ThemedText
                  key={tier.id}
                  type="caption"
                  themeColor={data.tier.id === tier.id ? 'primaryInk' : 'textSecondary'}
                  style={{ flex: 1 }}>
                  {tier.min}
                </ThemedText>
              ))}
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {[
                n('friend.interactions', data.interactions),
                data.becameFriendsAt ? t('friend.friendsSince', { date: day(data.becameFriendsAt) }) : null,
                data.affinity >= maxTier ? t('friend.bondOfNeighbourhood') : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </ThemedText>
          </Card>

          <ThemedText type="label" style={styles.section}>
            {t('friend.howTheyGotHere')}
          </ThemedText>
          {data.timeline.length === 0 ? (
            <Card style={styles.card}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('friend.noHistory')}
              </ThemedText>
            </Card>
          ) : (
            <Card style={styles.list}>
              {data.timeline.map((entry, i) => (
                <View key={`${entry.createdAt}-${i}`} style={styles.row}>
                  <View style={[styles.pip, { backgroundColor: theme.primaryPress }]} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <ThemedText type="small">{t(`friend.event.${entry.event}`)}</ThemedText>
                    <ThemedText type="caption" themeColor="textSecondary">
                      {timeAgo(entry.createdAt)}
                    </ThemedText>
                  </View>
                  <ThemedText type="smallBold" style={{ color: theme.primaryInk }}>
                    +{entry.points}
                  </ThemedText>
                </View>
              ))}
            </Card>
          )}

          <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
            {t('friend.decay', { days: data.halfLifeDays })}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
            {t('friend.directional')}
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
