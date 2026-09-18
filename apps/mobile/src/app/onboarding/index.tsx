import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { Mascot } from '@/components/mascot/mascot';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { ErrorText } from '@/components/ui/controls';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getOnboardingStatus, goToStep } from '@/lib/onboarding';

// Entry point: resume at the first unfinished step (onboarding state lives on
// the server, so it survives reinstalls and switching devices).
export default function OnboardingIndex() {
  const theme = useTheme();
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    getOnboardingStatus()
      .then((status) => goToStep(status.nextStep))
      .catch(() => setError("Couldn't load your setup progress."));
  }, [attempt]);

  return (
    <ThemedView style={styles.container}>
      <Mascot mood={error ? 'oops' : 'thinking'} size={120} />
      {error ? (
        <>
          <ErrorText message={error} />
          <Button
            label="Try again"
            onPress={() => {
              setError(null);
              setAttempt((a) => a + 1);
            }}
          />
        </>
      ) : (
        <ActivityIndicator color={theme.primaryPress} />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg, padding: Spacing.xl },
});
