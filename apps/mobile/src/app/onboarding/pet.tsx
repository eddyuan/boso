import {
  PET_NAME_MAX,
  PET_SPECIES,
  getPetSpecies,
  interestKey,
  speciesLabelKey,
  speciesMovesKey,
  type Interest,
  type PetSpecies,
} from '@bsocial/shared';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

import { CompanionArt, Egg } from '@/components/mascot/companions';
import { OnboardingScreen } from '@/components/onboarding-screen';
import { ThemedText } from '@/components/themed-text';
import { IconButton } from '@/components/ui/button';
import { Badge, Card, Divider } from '@/components/ui/controls';
import { Field } from '@/components/ui/field';
import { Icon, type IconName } from '@/components/ui/icon';
import { FontFamily, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/lib/i18n';
import { getOnboardingStatus, submitStep } from '@/lib/onboarding';

type Phase = 'egg' | 'hatching' | 'revealed';

/**
 * Keyed by species rather than by the English word for how it moves, which is
 * what it used to be — translating "Flies" would have silently lost the icon.
 */
const MOVE_ICON: Record<PetSpecies, IconName> = {
  cockatiel: 'flies',
  bunny: 'hops',
  cat: 'trots',
  puppy: 'trots',
};
const randomSpecies = () => PET_SPECIES[Math.floor(Math.random() * PET_SPECIES.length)].value;

// Step 6: hatch an egg into a random companion, optionally switch, name it, adopt.
export default function PetStep() {
  const theme = useTheme();
  const { t, rich } = useT();
  const [phase, setPhase] = useState<Phase>('egg');
  const [species, setSpecies] = useState<PetSpecies>('cockatiel');
  const [name, setName] = useState('');
  const [nameEdited, setNameEdited] = useState(false);
  const [autoApprove, setAutoApprove] = useState(true);
  const [interests, setInterests] = useState<Interest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const wobble = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;

  // The pet loves whatever the user picked in the interests step.
  useEffect(() => {
    getOnboardingStatus()
      .then((s) => setInterests(s.state.interests as Interest[]))
      .catch(() => {});
  }, []);

  // Idle wobble while waiting to hatch.
  useEffect(() => {
    if (phase !== 'egg') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(wobble, { toValue: 1, duration: 500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(wobble, { toValue: -1, duration: 500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(wobble, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.delay(700),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [phase, wobble]);

  function choose(next: PetSpecies) {
    setSpecies(next);
    // Swap the suggested name unless the user typed their own.
    if (!nameEdited) setName(getPetSpecies(next).names[0]);
  }

  function hatch() {
    setPhase('hatching');
    Animated.sequence(
      [1, -1, 1, -1, 1, 0].map((v) => Animated.timing(wobble, { toValue: v * 1.6, duration: 90, useNativeDriver: true })),
    ).start(() => {
      choose(randomSpecies());
      setPhase('revealed');
      pop.setValue(0);
      Animated.spring(pop, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }).start();
    });
  }

  function shuffleName() {
    const names: readonly string[] = getPetSpecies(species).names;
    setName(names[(names.indexOf(name) + 1) % names.length]);
    setNameEdited(false);
  }

  async function adopt() {
    setError(null);
    setLoading(true);
    // Tapping Adopt is the consent (see the note under the button).
    const code = await submitStep('pet', { name: name.trim(), species, autoApprove, consent: true });
    setLoading(false);
    if (code) setError(t('onboarding.pet.error.adopt'));
  }

  const rotate = wobble.interpolate({ inputRange: [-2, 2], outputRange: ['-16deg', '16deg'] });

  if (phase !== 'revealed') {
    return (
      <OnboardingScreen
        step="pet"
        title={t('onboarding.pet.readyTitle')}
        subtitle={t('onboarding.pet.readySubtitle')}
        continueLabel={t('onboarding.pet.hatch')}
        onContinue={hatch}
        loading={phase === 'hatching'}>
        <View style={styles.eggStage}>
          <Pressable onPress={hatch} disabled={phase === 'hatching'} accessibilityRole="button" accessibilityLabel={t('onboarding.pet.hatchEgg')}>
            <View style={[styles.eggHalo, { backgroundColor: theme.primarySoft }]}>
              <Animated.View style={{ transform: [{ rotate }] }}>
                <Egg size={210} cracked={phase === 'hatching'} />
              </Animated.View>
            </View>
          </Pressable>
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            {/* One sentence, three named slots: which species are listed and in
                what order is data, and the punctuation between them is the
                translator's. */}
            {rich('onboarding.pet.couldBe', {
              first: <ThemedText type="smallBold">{t(speciesLabelKey(PET_SPECIES[0].value)).toLowerCase()}</ThemedText>,
              second: <ThemedText type="smallBold">{t(speciesLabelKey(PET_SPECIES[1].value)).toLowerCase()}</ThemedText>,
              third: <ThemedText type="smallBold">{t(speciesLabelKey(PET_SPECIES[2].value)).toLowerCase()}</ThemedText>,
            })}
          </ThemedText>
        </View>
      </OnboardingScreen>
    );
  }

  const displayName = name.trim() || getPetSpecies(species).names[0];
  const loves = interests.map((v) => t(interestKey(v))).join(', ');
  const scale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });

  return (
    <OnboardingScreen
      step="pet"
      continueLabel={t('onboarding.pet.adopt', { name: displayName })}
      onContinue={adopt}
      continueDisabled={!name.trim()}
      loading={loading}
      error={error}
      footerNote={
        <ThemedText type="caption" style={styles.center}>
          {t('onboarding.pet.consent', { name: displayName })}
        </ThemedText>
      }>
      <View style={styles.reveal}>
        <ThemedText type="title" style={styles.center}>
          {t('onboarding.pet.itsA', { species: t(speciesLabelKey(species)).toLowerCase() })}
        </ThemedText>
        <View style={[styles.petHalo, { backgroundColor: theme.primarySoft }]}>
          <Animated.View style={{ transform: [{ scale }] }}>
            <CompanionArt species={species} size={150} />
          </Animated.View>
          <View style={styles.movesBadge}>
            <Badge
              tone="brand"
              label={t('onboarding.pet.movesOnMap', { moves: t(speciesMovesKey(species)) })}
              icon={<Icon name={MOVE_ICON[species]} size={14} color={theme.primaryInk} strokeWidth={2.4} />}
            />
          </View>
        </View>
      </View>

      <View style={styles.switcher}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          {t('onboarding.pet.notTheOne')}
        </ThemedText>
        {PET_SPECIES.filter((s) => s.value !== species).map((s) => (
          <Pressable
            key={s.value}
            onPress={() => choose(s.value)}
            accessibilityRole="button"
            accessibilityLabel={t('onboarding.pet.switchTo', { species: t(speciesLabelKey(s.value)) })}
            style={({ pressed }) => [styles.switchTile, { opacity: pressed ? 0.7 : 1 }]}>
            <View style={[styles.switchCircle, { backgroundColor: theme.surface, borderColor: theme.line }]}>
              <CompanionArt species={s.value} size={46} />
            </View>
            <ThemedText type="caption" style={{ fontFamily: FontFamily.bodyHeavy }}>
              {t(speciesLabelKey(s.value))}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <View style={styles.group}>
        <ThemedText type="label" style={{ paddingLeft: 4 }}>
          {t('onboarding.pet.name')}
        </ThemedText>
        <View style={styles.nameRow}>
          <View style={{ flex: 1 }}>
            <Field
              value={name}
              onChangeText={(v) => {
                setName(v);
                setNameEdited(true);
              }}
              maxLength={PET_NAME_MAX}
              autoCapitalize="words"
              style={{ fontSize: 18 }}
            />
          </View>
          <IconButton onPress={shuffleName} accessibilityLabel={t('onboarding.pet.suggestName')}>
            <Icon name="shuffle" />
          </IconButton>
        </View>
      </View>

      <Card>
        <View style={styles.infoRow}>
          <Icon name="sparkle" size={20} color={theme.primaryPress} />
          <ThemedText type="small" numberOfLines={1} style={styles.infoText}>
            {loves
              ? t('onboarding.pet.loves', { name: displayName, interests: loves })
              : t('onboarding.pet.lovesWhatYouLove', { name: displayName })}
          </ThemedText>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {t('onboarding.pet.editLater')}
          </ThemedText>
        </View>
        <Divider />
        <View style={styles.infoRow}>
          <Icon name={autoApprove ? 'check' : 'bell'} size={20} color={autoApprove ? theme.green : theme.primaryInk} strokeWidth={2.6} />
          <ThemedText type="small" style={styles.infoText}>
            {t(autoApprove ? 'pet.postsOnItsOwn' : 'onboarding.pet.askFirst')}
          </ThemedText>
          <Pressable onPress={() => setAutoApprove((v) => !v)} accessibilityRole="button" hitSlop={10}>
            <ThemedText type="linkPrimary">{t('onboarding.pet.change')}</ThemedText>
          </Pressable>
        </View>
      </Card>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  eggStage: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.xl, paddingVertical: Spacing.xl },
  eggHalo: { width: 260, height: 260, borderRadius: 130, alignItems: 'center', justifyContent: 'center' },
  reveal: { alignItems: 'center', gap: Spacing.sm },
  petHalo: { width: 190, height: 190, borderRadius: 95, alignItems: 'center', justifyContent: 'center' },
  movesBadge: { position: 'absolute', bottom: -4 },
  switcher: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14 },
  switchTile: { alignItems: 'center', gap: 2 },
  switchCircle: { width: 58, height: 58, borderRadius: 29, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  group: { gap: Spacing.sm },
  nameRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  infoText: { flex: 1, minWidth: 0 },
});
