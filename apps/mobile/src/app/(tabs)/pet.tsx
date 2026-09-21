import {
  CARE_KINDS,
  careDoneKey,
  careVerbKey,
  getPetSpecies,
  speciesLabelKey,
  speciesMovesKey,
  tierBlurbKey,
  tierLabelKey,
  unlockKey,
  type BondProgress,
  type CareKind,
  type Mood,
  type RelationshipTier,
} from '@bsocial/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/auth-form';
import { EventCard, type LiveEvent } from '@/components/event-card';
import { CompanionArt } from '@/components/mascot/companions';
import { MissionsCard, type Mission } from '@/components/missions-card';
import { usePetSummary } from '@/components/pet-summary';
import { PlaydatesCard, type Playdates } from '@/components/playdates-card';
import { ThemedText } from '@/components/themed-text';
import { TreasureShelf, type Treasure } from '@/components/treasure-shelf';
import { Button } from '@/components/ui/button';
import { Badge, Card, ErrorText } from '@/components/ui/controls';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { apiFetch } from '@/lib/api';
import { useT } from '@/lib/i18n';

type Pet = { id: string; name: string; species: string; autoApprove: boolean };
type PetResponse = { pet: Pet | null; mood: Mood | null; careToday: CareKind[]; bond: BondProgress | null };
type Relationship = {
  petId: string;
  petName: string;
  species: string;
  tier: RelationshipTier;
  affinity: number;
  interactions: number;
};
type PetAction = {
  id: string;
  type: 'post' | 'like' | 'comment' | 'follow' | 'visit' | 'none';
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';
  payload: Record<string, unknown>;
  reasoning: string | null;
  createdAt: string;
};
type DiaryEntry = { id: string; day: string; entry: string; stats: { received: number } | null };

/**
 * Your pet, and everything that belongs to it.
 *
 * This replaced "Activity", which held three unrelated jobs — an inbox, a goals
 * board and a log — and read as thin however full it was. The difference isn't the
 * amount of content: it's that this is one subject with several sections.
 *
 * Order is by urgency, not by feature. What's waiting on you comes first, then
 * how the pet is, then what to do today, then what happened. The log itself is
 * the weakest thing here and lives on its own screen rather than taking space.
 */
export default function PetTab() {
  const theme = useTheme();
  const { t, n, p } = useT();
  const { refresh: refreshBadge } = usePetSummary();

  const [pet, setPet] = useState<Pet | null>(null);
  const [mood, setMood] = useState<Mood | null>(null);
  const [careToday, setCareToday] = useState<CareKind[]>([]);
  const [caring, setCaring] = useState<CareKind | null>(null);
  const [bond, setBond] = useState<BondProgress | null>(null);
  const [actions, setActions] = useState<PetAction[] | null>(null);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [playdates, setPlaydates] = useState<Playdates | null>(null);
  const [liveEvent, setLiveEvent] = useState<LiveEvent | null>(null);
  const [diary, setDiary] = useState<DiaryEntry[]>([]);
  const [treasures, setTreasures] = useState<{ treasures: Treasure[]; counts: Record<string, number> } | null>(null);
  const [friends, setFriends] = useState<Relationship[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadActions = useCallback(
    () =>
      apiFetch<{ actions: PetAction[] }>('/api/me/pet-actions')
        .then((r) => setActions(r.actions))
        .catch(() => setError(t('pet.error.load'))),
    [t],
  );
  const loadPlaydates = useCallback(
    () => apiFetch<Playdates>('/api/me/playdates').then(setPlaydates).catch(() => {}),
    [],
  );

  useFocusEffect(
    useCallback(() => {
      apiFetch<PetResponse>('/api/pets')
        .then((r) => {
          setPet(r.pet);
          setMood(r.mood);
          setCareToday(r.careToday);
          setBond(r.bond);
        })
        .catch(() => {});
      loadActions();
      loadPlaydates();
      apiFetch<{ missions: Mission[] }>('/api/me/missions').then((r) => setMissions(r.missions)).catch(() => {});
      apiFetch<LiveEvent & { event: LiveEvent['event'] | null }>('/api/me/event')
        .then((r) => setLiveEvent(r.event ? r : null))
        .catch(() => {});
      apiFetch<{ entries: DiaryEntry[] }>('/api/me/diary?limit=1').then((r) => setDiary(r.entries)).catch(() => {});
      apiFetch<{ treasures: Treasure[]; counts: Record<string, number> }>('/api/me/treasures')
        .then(setTreasures)
        .catch(() => {});
      apiFetch<{ relationships: Relationship[] }>('/api/me/relationships')
        .then((r) => setFriends(r.relationships))
        .catch(() => {});
    }, [loadActions, loadPlaydates]),
  );

  const decide = async (action: PetAction, decision: 'approve' | 'reject') => {
    setBusyId(action.id);
    setError(null);
    try {
      await apiFetch('/api/me/pet-actions', { method: 'PATCH', body: JSON.stringify({ id: action.id, decision }) });
      await loadActions();
      // The tab badge counts these, so it has to hear about it too.
      refreshBadge();
    } catch {
      setError(t(decision === 'approve' ? 'pet.error.approve' : 'pet.error.reject'));
    }
    setBusyId(null);
  };

  const doCare = async (kind: CareKind) => {
    if (careToday.includes(kind) || caring) return;
    setCaring(kind);
    try {
      const r = await apiFetch<PetResponse>('/api/me/pet-care', { method: 'POST', body: JSON.stringify({ kind }) });
      setMood(r.mood);
      setCareToday(r.careToday);
      setBond(r.bond);
    } catch {
      // Care is a nicety; a failed tap shouldn't produce an error screen.
    }
    setCaring(null);
  };

  const pending = actions?.filter((a) => a.status === 'pending') ?? [];
  const species = pet ? getPetSpecies(pet.species) : null;

  return (
    <Screen underTabBar>
      <ErrorText message={error} />
      {!pet && !error && <ActivityIndicator color={theme.primaryPress} />}

      {pet && species && (
        <>
          {/* ---------------------------------------------------- who they are */}
          <View style={styles.hero}>
            <View style={[styles.halo, { backgroundColor: theme.primarySoft }]}>
              <CompanionArt species={pet.species} size={84} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              {/* The name itself is the affordance — a rename buried in settings
                  is a rename nobody finds. */}
              <Pressable
                onPress={() => router.push({ pathname: '/rename-pet', params: { current: pet.name } })}
                accessibilityRole="button"
                accessibilityLabel={t('pet.a11y.rename', { name: pet.name })}
                hitSlop={6}
                style={({ pressed }) => [styles.nameRow, { opacity: pressed ? 0.7 : 1 }]}>
                <ThemedText type="title">{pet.name}</ThemedText>
                <Icon name="edit" size={16} color={theme.textSecondary} />
              </Pressable>
              <ThemedText type="small" themeColor="textSecondary">
                {t('pet.yourSpecies', {
                  species: t(speciesLabelKey(species.value)).toLowerCase(),
                  moves: t(speciesMovesKey(species.value)).toLowerCase(),
                })}
              </ThemedText>
              <Badge
                tone="brand"
                label={t(pet.autoApprove ? 'pet.postsOnItsOwn' : 'pet.asksYouFirst')}
                icon={
                  <Icon
                    name={pet.autoApprove ? 'check' : 'bell'}
                    size={12}
                    color={theme.primaryInk}
                    strokeWidth={3}
                  />
                }
              />
            </View>
          </View>

          {/* -------------------------------------------- what's waiting on you */}
          {pending.length > 0 && (
            <>
              <ThemedText type="label" style={styles.section}>
                {n('pet.waitingOnYou', pending.length)}
              </ThemedText>
              {pending.map((action) => (
                <Card key={action.id} style={styles.ask}>
                  <ThemedText type="label">
                    {t(action.type === 'comment' ? 'pet.wantsToReply' : 'pet.wantsToPost', { name: pet.name })}
                  </ThemedText>
                  {action.reasoning && (
                    <ThemedText type="small" themeColor="textSecondary">
                      {action.reasoning}
                    </ThemedText>
                  )}
                  {typeof action.payload?.content === 'string' && (
                    <View style={[styles.draft, { backgroundColor: theme.primarySoft }]}>
                      <ThemedText type="small">{action.payload.content as string}</ThemedText>
                    </View>
                  )}
                  <View style={styles.askButtons}>
                    <Button
                      label={t('pet.letThem')}
                      onPress={() => decide(action, 'approve')}
                      disabled={busyId === action.id}
                      style={{ flex: 1 }}
                    />
                    <Button
                      variant="secondary"
                      label={t('pet.skip')}
                      onPress={() => decide(action, 'reject')}
                      disabled={busyId === action.id}
                      style={{ flex: 1 }}
                    />
                  </View>
                  <ThemedText type="caption" themeColor="textSecondary">
                    {t('pet.skipIsEqual')}
                  </ThemedText>
                </Card>
              ))}
            </>
          )}

          {/* ------------------------------------------------- how they are */}
          {mood && (
            <Card style={styles.moodCard}>
              <View style={styles.moodHead}>
                <ThemedText type="label" style={{ flex: 1 }}>
                  {p({ ...mood.reasons[0]!, vars: { name: pet.name, ...mood.reasons[0]!.vars } })}
                </ThemedText>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {mood.score}
                </ThemedText>
              </View>
              <View style={[styles.moodTrack, { backgroundColor: theme.backgroundElement }]}>
                <View
                  style={[
                    styles.moodFill,
                    { width: `${mood.score}%`, backgroundColor: mood.score >= 55 ? theme.primary : theme.red },
                  ]}
                />
              </View>
              {mood.reasons.slice(1).map((reason) => {
                const line = p({ ...reason, vars: { name: pet.name, ...reason.vars } });
                return (
                  <ThemedText key={line} type="small" themeColor="textSecondary">
                    {line}
                  </ThemedText>
                );
              })}

              {bond && (
                <Pressable
                  onPress={() => router.push('/bond')}
                  accessibilityRole="button"
                  accessibilityLabel={t('pet.a11y.bond')}
                  style={styles.bondRow}>
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    {t('bond.short', { level: bond.level })}
                  </ThemedText>
                  <View style={[styles.bondTrack, { backgroundColor: theme.backgroundElement }]}>
                    <View
                      style={[
                        styles.bondFill,
                        {
                          width: `${bond.levelSpan > 0 ? Math.round((bond.intoLevel / bond.levelSpan) * 100) : 100}%`,
                          backgroundColor: theme.primaryInk,
                        },
                      ]}
                    />
                  </View>
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={{ flexShrink: 1 }}>
                    {bond.next
                      ? t('bond.toUnlock', {
                          xp: bond.xpToNext,
                          unlock: t(unlockKey(bond.level + 1)).toLowerCase(),
                        })
                      : t('bond.elder')}
                  </ThemedText>
                  <Icon name="chevron" size={16} color={theme.textSecondary} />
                </Pressable>
              )}

              <View style={styles.careRow}>
                {CARE_KINDS.map((kind) => {
                  const done = careToday.includes(kind);
                  return (
                    <Pressable
                      key={kind}
                      onPress={() => doCare(kind)}
                      disabled={done || caring !== null}
                      accessibilityRole="button"
                      accessibilityLabel={t(done ? careDoneKey(kind) : careVerbKey(kind))}
                      style={[
                        styles.careButton,
                        { backgroundColor: done ? theme.backgroundElement : theme.primarySoft },
                      ]}>
                      {done && <Icon name="check" size={13} color={theme.textSecondary} strokeWidth={3} />}
                      <ThemedText type="smallBold" style={{ color: done ? theme.textSecondary : theme.primaryInk }}>
                        {t(done ? careDoneKey(kind) : careVerbKey(kind))}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </Card>
          )}

          {/* ------------------------------------------------ what to do today */}
          {liveEvent && (
            <Pressable onPress={() => router.push('/event')} accessibilityRole="button" accessibilityLabel={t('event.title')}>
              <EventCard data={liveEvent} />
            </Pressable>
          )}
          <MissionsCard missions={missions} />
          {playdates && <PlaydatesCard data={playdates} onChange={loadPlaydates} />}

          {/* --------------------------------------------- what happened */}
          {diary.length > 0 && (
            <>
              <View style={styles.sectionRow}>
                <ThemedText type="label" style={{ flex: 1 }}>
                  {t('pet.lastNight')}
                </ThemedText>
                <Pressable onPress={() => router.push('/diary')} hitSlop={8} accessibilityRole="button">
                  <ThemedText type="smallBold" style={{ color: theme.primaryInk }}>
                    {t('pet.wholeDiary')}
                  </ThemedText>
                </Pressable>
              </View>
              <Card style={styles.diary}>
                {diary[0]!.stats && diary[0]!.stats.received > 0 && (
                  <Badge tone="brand" label={n('pet.reacted', diary[0]!.stats.received)} />
                )}
                <ThemedText>{diary[0]!.entry}</ThemedText>
              </Card>
            </>
          )}

          {treasures && treasures.treasures.length > 0 && (
            <Pressable onPress={() => router.push('/shelf')} accessibilityRole="button" accessibilityLabel={t('pet.a11y.shelf')}>
              <TreasureShelf treasures={treasures.treasures} counts={treasures.counts} petName={pet.name} />
            </Pressable>
          )}

          {friends.length > 0 && (
            <Card style={styles.friendsCard}>
              <ThemedText type="label">{t('pet.circle', { name: pet.name })}</ThemedText>
              {friends.slice(0, 5).map((friend) => (
                <Pressable
                  key={friend.petId}
                  onPress={() => router.push(`/friend/${friend.petId}`)}
                  accessibilityRole="button"
                  accessibilityLabel={t('pet.a11y.friend', { name: friend.petName })}
                  style={styles.friendRow}>
                  <View style={[styles.friendArt, { backgroundColor: theme.primarySoft }]}>
                    <CompanionArt species={friend.species} size={28} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <ThemedText type="smallBold" numberOfLines={1}>
                      {friend.petName}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                      {`${t(tierBlurbKey(friend.tier))} · ${n('pet.together', friend.interactions)}`}
                    </ThemedText>
                  </View>
                  <Badge tone={friend.affinity >= 12 ? 'brand' : 'muted'} label={t(tierLabelKey(friend.tier))} />
                  <Icon name="chevron" size={16} color={theme.textSecondary} />
                </Pressable>
              ))}
            </Card>
          )}

          <Pressable onPress={() => router.push('/pet-log')} accessibilityRole="button">
            <Card style={styles.logRow}>
              <View style={[styles.logIcon, { backgroundColor: theme.backgroundElement }]}>
                <Icon name="feed" size={20} color={theme.text} />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText type="label">{t('pet.everythingDid', { name: pet.name })}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('pet.everythingDidBody')}
                </ThemedText>
              </View>
              <Icon name="chevron" size={20} color={theme.textSecondary} />
            </Card>
          </Pressable>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  halo: { width: 108, height: 108, borderRadius: 54, alignItems: 'center', justifyContent: 'center' },
  section: { paddingHorizontal: 4, paddingTop: Spacing.xs },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: 4, paddingTop: Spacing.xs },
  ask: { padding: Spacing.lg, gap: Spacing.sm },
  draft: { padding: Spacing.md, borderRadius: 14, borderTopLeftRadius: 4 },
  askButtons: { flexDirection: 'row', gap: Spacing.sm, marginTop: 2 },
  moodCard: { padding: Spacing.lg, gap: Spacing.sm },
  moodHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  moodTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  moodFill: { height: '100%', borderRadius: 3 },
  bondRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 2 },
  bondTrack: { width: 54, height: 5, borderRadius: 3, overflow: 'hidden' },
  bondFill: { height: '100%', borderRadius: 3 },
  careRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: 2 },
  careButton: {
    flex: 1,
    height: 38,
    borderRadius: Radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  diary: { padding: Spacing.lg, gap: Spacing.sm },
  friendsCard: { padding: Spacing.lg, gap: Spacing.md },
  friendRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  friendArt: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg },
  logIcon: { width: 40, height: 40, borderRadius: Radius.icon, alignItems: 'center', justifyContent: 'center' },
});
