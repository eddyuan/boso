import { MIN_AGE } from '@bsocial/shared';
import { useMemo, useState } from 'react';
import { Alert, Platform } from 'react-native';

import { BirthdayPicker } from '@/components/birthday-picker';
import { OnboardingScreen } from '@/components/onboarding-screen';
import { formatBirthday, toIsoDate, yearsAgo } from '@/lib/birthday';
import { submitStep } from '@/lib/onboarding';

function confirmBirthday(date: Date): Promise<boolean> {
  const message = `Is ${formatBirthday(date)} correct? You won't be able to change your birthday later.`;
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(message));
  return new Promise((resolve) =>
    Alert.alert('Confirm your birthday', message, [
      { text: 'Edit', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Confirm', onPress: () => resolve(true) },
    ]),
  );
}

export default function BirthdayStep() {
  const [birthday, setBirthday] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { today, initialDate, minimumDate } = useMemo(() => {
    const now = new Date();
    return {
      today: now,
      // Neutral starting point. Deliberately not "18 years ago", which would
      // hint at the cutoff; the max is today for the same reason.
      initialDate: yearsAgo(25, now),
      minimumDate: yearsAgo(120, now),
    };
  }, []);

  async function onContinue() {
    if (!birthday) return;
    if (!(await confirmBirthday(birthday))) return;

    setError(null);
    setLoading(true);
    const code = await submitStep('birthday', { birthday: toIsoDate(birthday) });
    setLoading(false);
    // age_restricted: the root layout switches to the restricted screen.
    if (code && code !== 'age_restricted') {
      setError(code === 'invalid_birthday' ? 'Enter a valid date' : "Couldn't save. Please try again.");
    }
  }

  return (
    <OnboardingScreen
      step="birthday"
      title="When's your birthday?"
      subtitle={`You must be ${MIN_AGE} or older to use Tielo. This won't be shown on your profile.`}
      onContinue={onContinue}
      continueDisabled={!birthday}
      loading={loading}
      error={error}>
      <BirthdayPicker
        value={birthday}
        onChange={setBirthday}
        initialDate={initialDate}
        minimumDate={minimumDate}
        maximumDate={today}
      />
    </OnboardingScreen>
  );
}
