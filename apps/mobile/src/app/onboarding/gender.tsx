import { GENDERS, type Gender } from '@bsocial/shared';
import { useState } from 'react';

import { OnboardingScreen } from '@/components/onboarding-screen';
import { OptionCard } from '@/components/ui/controls';
import { submitStep } from '@/lib/onboarding';

export default function GenderStep() {
  const [gender, setGender] = useState<Gender | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onContinue() {
    if (!gender) return;
    setError(null);
    setLoading(true);
    const code = await submitStep('gender', { gender });
    setLoading(false);
    if (code) setError("Couldn't save. Please try again.");
  }

  return (
    <OnboardingScreen
      step="gender"
      title="What's your gender?"
      subtitle="This stays private."
      onContinue={onContinue}
      continueDisabled={!gender}
      loading={loading}
      error={error}>
      {GENDERS.map((g) => (
        <OptionCard key={g.value} title={g.label} selected={gender === g.value} onPress={() => setGender(g.value)} />
      ))}
    </OnboardingScreen>
  );
}
