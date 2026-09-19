import { MIN_AGE, type Translator } from '@bsocial/shared';
import { useMemo, useState } from 'react';
import { Alert, Platform } from 'react-native';

import { BirthdayPicker } from '@/components/birthday-picker';
import { OnboardingScreen } from '@/components/onboarding-screen';
import { useT } from '@/lib/i18n';
import { formatBirthday, toIsoDate, yearsAgo } from '@/lib/birthday';
import { submitStep } from '@/lib/onboarding';

function confirmBirthday(t: Translator['t'], date: Date): Promise<boolean> {
  const message = t('onboarding.birthday.check', { date: formatBirthday(date) });
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(message));
  return new Promise((resolve) =>
    Alert.alert(t('onboarding.birthday.title'), message, [
      { text: t('onboarding.birthday.edit'), style: 'cancel', onPress: () => resolve(false) },
      { text: t('onboarding.birthday.confirm'), onPress: () => resolve(true) },
    ]),
  );
}

export default function BirthdayStep() {
  const { t } = useT();
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
    if (!(await confirmBirthday(t, birthday))) return;

    setError(null);
    setLoading(true);
    const code = await submitStep('birthday', { birthday: toIsoDate(birthday) });
    setLoading(false);
    // age_restricted: the root layout switches to the restricted screen.
    if (code && code !== 'age_restricted') {
      setError(t(code === 'invalid_birthday' ? 'onboarding.birthday.invalid' : 'onboarding.error.save'));
    }
  }

  return (
    <OnboardingScreen
      step="birthday"
      title={t('onboarding.birthday.question')}
      subtitle={t('onboarding.birthday.subtitle', { age: MIN_AGE })}
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
