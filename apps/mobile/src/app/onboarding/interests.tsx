import { INTERESTS, MAX_INTERESTS, MIN_INTERESTS, type Interest } from '@bsocial/shared';
import { useEffect, useState } from 'react';

import { OnboardingScreen } from '@/components/onboarding-screen';
import { ThemedText } from '@/components/themed-text';
import { Chip, ChipGroup } from '@/components/ui/controls';
import { getOnboardingStatus, submitStep } from '@/lib/onboarding';

export default function InterestsStep() {
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
    if (code) setError("Couldn't save. Please try again.");
  }

  const remaining = MIN_INTERESTS - selected.length;

  return (
    <OnboardingScreen
      step="interests"
      title="What are you into?"
      subtitle={`Pick at least ${MIN_INTERESTS}. Your pet will post and engage around these.`}
      continueLabel={remaining > 0 ? `Pick ${remaining} more` : 'Continue'}
      onContinue={onContinue}
      continueDisabled={remaining > 0}
      loading={loading}
      error={error}
      footerNote={
        selected.length > 0 ? (
          <ThemedText type="smallBold" themeColor="textSecondary" style={{ textAlign: 'center' }}>
            {selected.length >= MAX_INTERESTS ? `${MAX_INTERESTS} selected (max)` : `${selected.length} selected`}
          </ThemedText>
        ) : undefined
      }>
      <ChipGroup>
        {INTERESTS.map((i) => (
          <Chip
            key={i.value}
            label={`${i.emoji} ${i.label}`}
            selected={selected.includes(i.value)}
            onPress={() => toggle(i.value)}
          />
        ))}
      </ChipGroup>
    </OnboardingScreen>
  );
}
