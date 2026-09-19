import { INTERESTS, MAX_INTERESTS, MIN_INTERESTS, interestKey, type Interest } from '@bsocial/shared';
import { useEffect, useState } from 'react';

import { OnboardingScreen } from '@/components/onboarding-screen';
import { ThemedText } from '@/components/themed-text';
import { Chip, ChipGroup } from '@/components/ui/controls';
import { useT } from '@/lib/i18n';
import { getOnboardingStatus, submitStep } from '@/lib/onboarding';

export default function InterestsStep() {
  const { t, n } = useT();
  const [selected, setSelected] = useState<Interest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Coming back to this step: keep what was picked before.
  useEffect(() => {
    getOnboardingStatus()
      .then((s) => s.state.interests.length && setSelected(s.state.interests as Interest[]))
      .catch(() => {});
  }, []);

  function toggle(value: Interest) {
    setSelected((cur) =>
      cur.includes(value) ? cur.filter((v) => v !== value) : cur.length < MAX_INTERESTS ? [...cur, value] : cur,
    );
  }

  async function onContinue() {
    setError(null);
    setLoading(true);
    const code = await submitStep('interests', { interests: selected });
    setLoading(false);
    if (code) setError(t('onboarding.error.save'));
  }

  const remaining = MIN_INTERESTS - selected.length;

  return (
    <OnboardingScreen
      step="interests"
      title={t('onboarding.interests.title')}
      subtitle={t('onboarding.interests.subtitle', { min: MIN_INTERESTS })}
      continueLabel={remaining > 0 ? n('onboarding.interests.pickMore', remaining) : undefined}
      onContinue={onContinue}
      continueDisabled={remaining > 0}
      loading={loading}
      error={error}
      footerNote={
        selected.length > 0 ? (
          <ThemedText type="smallBold" themeColor="textSecondary" style={{ textAlign: 'center' }}>
            {t(
              selected.length >= MAX_INTERESTS
                ? 'onboarding.interests.selectedMax'
                : 'onboarding.interests.selected',
              { count: selected.length },
            )}
          </ThemedText>
        ) : undefined
      }>
      <ChipGroup>
        {INTERESTS.map((i) => (
          <Chip
            key={i.value}
            label={`${i.emoji} ${t(interestKey(i.value))}`}
            selected={selected.includes(i.value)}
            onPress={() => toggle(i.value)}
          />
        ))}
      </ChipGroup>
    </OnboardingScreen>
  );
}
