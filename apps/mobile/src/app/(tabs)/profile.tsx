import { CARE_KINDS, CARE_LABEL, INTERESTS, getDisplayName, getPetSpecies, type CareKind, type Mood } from '@bsocial/shared';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { Screen } from '@/components/auth-form';
import { CompanionArt } from '@/components/mascot/companions';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Badge, Card, ChipGroup, Divider, IconTile, ListRow } from '@/components/ui/controls';
import { Icon } from '@/components/ui/icon';
import { FontFamily, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { apiFetch } from '@/lib/api';
import { authClient } from '@/lib/auth-client';

type Pet = { id: string; name: string; species: string; autoApprove: boolean };
type PetResponse = { pet: Pet | null; mood: Mood | null; careToday: CareKind[] };

export default function ProfileTab() {
  const theme = useTheme();
  const { data: session } = authClient.useSession();
  const [pet, setPet] = useState<Pet | null>(null);
  const [mood, setMood] = useState<Mood | null>(null);
  const [careToday, setCareToday] = useState<CareKind[]>([]);
  const [caring, setCaring] = useState<CareKind | null>(null);
  const [showSensitive, setShowSensitive] = useState(false);
  const [savingSensitive, setSavingSensitive] = useState(false);

  useFocusEffect(
    useCallback(() => {
      apiFetch<PetResponse>('/api/pets')
        .then((r) => {
          setPet(r.pet);
          setMood(r.mood);
          setCareToday(r.careToday);
        })
        .catch(() => {});
    }, []),
  );

  const doCare = async (kind: CareKind) => {
    if (careToday.includes(kind) || caring) return;
    setCaring(kind);
    try {
      const r = await apiFetch<PetResponse>('/api/me/pet-care', {
        method: 'POST',
        body: JSON.stringify({ kind }),
      });
      setMood(r.mood);
      setCareToday(r.careToday);
    } catch {
      // Care is a nicety; a failed tap shouldn't produce an error screen.
    }
    setCaring(null);
  };

  const user = session?.user;
  // Session is the source of truth; local state only covers the in-flight toggle.
  const sensitiveOn = savingSensitive ? showSensitive : (user?.showSensitiveContent ?? false);

  const toggleSensitive = async (next: boolean) => {
    setShowSensitive(next);
    setSavingSensitive(true);
    try {
      await apiFetch('/api/me/account', {
        method: 'PATCH',
        body: JSON.stringify({ showSensitiveContent: next }),
      });
      // Re-read the session so the feed and map see the new preference.
      await authClient.getSession({ query: { disableCookieCache: true } });
    } catch {
      setShowSensitive(!next);
    }
    setSavingSensitive(false);
  };
  const interests = user?.interests ?? [];
  const species = pet ? getPetSpecies(pet.species) : null;

  return (
    <Screen>
      <View style={styles.profile}>
        {user?.image ? (
          <Image source={{ uri: user.image }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
            <ThemedText style={{ fontFamily: FontFamily.display, fontSize: 30, color: theme.onPrimary }}>
              {(user?.name?.trim() || user?.username || '?').slice(0, 1).toUpperCase()}
            </ThemedText>
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <ThemedText type="subtitle" numberOfLines={1}>
            {user ? getDisplayName(user) : ''}
          </ThemedText>
          {user?.name?.trim() && user.username ? (
            <ThemedText type="small" themeColor="textSecondary">
              @{user.username}
            </ThemedText>
          ) : null}
        </View>
      </View>

      {interests.length > 0 && (
        <ChipGroup gap={8}>
          {interests.map((value) => {
            const interest = INTERESTS.find((i) => i.value === value);
            return (
              <View key={value} style={[styles.interest, { backgroundColor: theme.primarySoft }]}>
                <ThemedText type="small" style={{ color: theme.primaryInk, fontFamily: FontFamily.bodyBold }}>
                  {interest ? `${interest.emoji} ${interest.label}` : value}
                </ThemedText>
              </View>
            );
          })}
        </ChipGroup>
      )}

      {pet && species && (
        <Card style={styles.petCard}>
          <View style={[styles.petHalo, { backgroundColor: theme.primarySoft }]}>
            <CompanionArt species={pet.species} size={80} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <ThemedText type="header">{pet.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Your {species.label.toLowerCase()} · {species.moves.toLowerCase()} on the map
            </ThemedText>
            <Badge
              tone="brand"
              label={pet.autoApprove ? 'Posts on its own' : 'Asks you first'}
              icon={<Icon name={pet.autoApprove ? 'check' : 'bell'} size={12} color={theme.primaryInk} strokeWidth={3} />}
            />
          </View>
        </Card>
      )}

      {pet && mood && (
        <Card style={styles.moodCard}>
          {/* The reason, not just the face — a drooping pet with no explanation
              is a guilt mechanic rather than information. */}
          <View style={styles.moodHead}>
            <ThemedText type="label" style={{ flex: 1 }}>
              {mood.reasons[0]}
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
          {mood.reasons.slice(1).map((reason) => (
            <ThemedText key={reason} type="small" themeColor="textSecondary">
              {reason}
            </ThemedText>
          ))}

          <View style={styles.careRow}>
            {CARE_KINDS.map((kind) => {
              const done = careToday.includes(kind);
              return (
                <Pressable
                  key={kind}
                  onPress={() => doCare(kind)}
                  disabled={done || caring !== null}
                  accessibilityRole="button"
                  accessibilityLabel={done ? `${CARE_LABEL[kind].done} today` : CARE_LABEL[kind].verb}
                  style={[
                    styles.careButton,
                    { backgroundColor: done ? theme.backgroundElement : theme.primarySoft },
                  ]}>
                  {done && <Icon name="check" size={13} color={theme.textSecondary} strokeWidth={3} />}
                  <ThemedText
                    type="smallBold"
                    style={{ color: done ? theme.textSecondary : theme.primaryInk }}>
                    {done ? CARE_LABEL[kind].done : CARE_LABEL[kind].verb}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </Card>
      )}

      <Card>
        <ListRow
          icon={
            <IconTile>
              <Icon name="person" />
            </IconTile>
          }
          title="Account"
          subtitle="Contact, sign-in methods"
          trailing={<Icon name="chevron" size={20} color={theme.textSecondary} />}
          onPress={() => router.push('/account')}
        />
        <Divider />
        <ListRow
          icon={
            <IconTile>
              <Icon name="laptop" />
            </IconTile>
          }
          title="Signed-in devices"
          trailing={<Icon name="chevron" size={20} color={theme.textSecondary} />}
          onPress={() => router.push('/devices')}
        />
        <Divider />
        <ListRow
          icon={
            <IconTile>
              <Icon name="eye" />
            </IconTile>
          }
          title="Show sensitive content"
          subtitle="Skip the cover on posts marked sensitive"
          trailing={
            <Switch
              value={sensitiveOn}
              onValueChange={toggleSensitive}
              disabled={savingSensitive}
              trackColor={{ true: theme.primary, false: theme.backgroundElement }}
              accessibilityLabel="Show sensitive content"
            />
          }
        />
      </Card>

      <Button
        variant="danger"
        label="Sign out"
        icon={<Icon name="logout" size={20} color={theme.red} />}
        onPress={() => authClient.signOut()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  interest: { paddingHorizontal: 12, height: 32, borderRadius: Radius.pill, justifyContent: 'center' },
  petCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg, padding: Spacing.lg },
  petHalo: { width: 104, height: 104, borderRadius: 52, alignItems: 'center', justifyContent: 'center' },
  moodCard: { padding: Spacing.lg, gap: Spacing.sm },
  moodHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  moodTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  moodFill: { height: '100%', borderRadius: 3 },
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
});
