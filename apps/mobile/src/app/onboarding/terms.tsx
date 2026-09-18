import { TERMS_VERSION } from '@bsocial/shared';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ExternalLink } from '@/components/external-link';
import { Mascot } from '@/components/mascot/mascot';
import { OnboardingScreen } from '@/components/onboarding-screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { submitStep } from '@/lib/onboarding';

const TERMS_URL = (process.env.EXPO_PUBLIC_TERMS_URL ?? 'https://tielo.app/terms') as `https://${string}`;
const PRIVACY_URL = (process.env.EXPO_PUBLIC_PRIVACY_URL ?? 'https://tielo.app/privacy') as `https://${string}`;

export default function TermsStep() {
  const theme = useTheme();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onContinue() {
    setLoading(true);
    const code = await submitStep('terms', { version: TERMS_VERSION });
    setLoading(false);
    if (code) setError("Couldn't save. Please try again.");
  }

  return (
    <OnboardingScreen
      step="terms"
      centered
      continueLabel="Agree and continue"
      onContinue={onContinue}
      loading={loading}
      error={error}
      footerNote={
        <ThemedText type="small" themeColor="textSecondary" style={styles.legal}>
          By continuing, you agree to our{' '}
          <ExternalLink href={TERMS_URL}>
            <ThemedText type="linkPrimary">Terms of Service</ThemedText>
          </ExternalLink>{' '}
          and{' '}
          <ExternalLink href={PRIVACY_URL}>
            <ThemedText type="linkPrimary">Privacy Policy</ThemedText>
          </ExternalLink>
          , including how your pet may post and interact on your behalf.
        </ThemedText>
      }>
      <View style={styles.hero}>
        <View style={[styles.halo, { backgroundColor: theme.primarySoft }]}>
          <Mascot mood="waving" size={160} />
        </View>
        <ThemedText type="hero" style={styles.center}>
          Welcome to Tielo
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={[styles.center, { maxWidth: 300 }]}>
          Your AI pet keeps your social life going, even when you're away.
        </ThemedText>
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: Spacing.lg },
  halo: { width: 220, height: 220, borderRadius: 110, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  center: { textAlign: 'center' },
  legal: { textAlign: 'center', marginTop: Spacing.sm },
});
