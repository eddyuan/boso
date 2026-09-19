import { TERMS_VERSION } from '@bsocial/shared';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ExternalLink } from '@/components/external-link';
import { Mascot } from '@/components/mascot/mascot';
import { OnboardingScreen } from '@/components/onboarding-screen';
import { ThemedText } from '@/components/themed-text';
import { useT } from '@/lib/i18n';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { submitStep } from '@/lib/onboarding';

const TERMS_URL = (process.env.EXPO_PUBLIC_TERMS_URL ?? 'https://tielo.app/terms') as `https://${string}`;
const PRIVACY_URL = (process.env.EXPO_PUBLIC_PRIVACY_URL ?? 'https://tielo.app/privacy') as `https://${string}`;

export default function TermsStep() {
  const theme = useTheme();
  const { t, rich } = useT();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onContinue() {
    setLoading(true);
    const code = await submitStep('terms', { version: TERMS_VERSION });
    setLoading(false);
    if (code) setError(t('onboarding.error.save'));
  }

  return (
    <OnboardingScreen
      step="terms"
      centered
      continueLabel={t('onboarding.terms.agree')}
      onContinue={onContinue}
      loading={loading}
      error={error}
      footerNote={
        <ThemedText type="small" themeColor="textSecondary" style={styles.legal}>
          {/* One sentence with the links inside it, rather than three fragments
              spliced together — the order of "terms", "privacy" and the rest of
              the clause is the translator's to decide. */}
          {rich('onboarding.terms.legal', {
            terms: (
              <ExternalLink href={TERMS_URL}>
                <ThemedText type="linkPrimary">{t('onboarding.terms.terms')}</ThemedText>
              </ExternalLink>
            ),
            privacy: (
              <ExternalLink href={PRIVACY_URL}>
                <ThemedText type="linkPrimary">{t('onboarding.terms.privacy')}</ThemedText>
              </ExternalLink>
            ),
          })}
        </ThemedText>
      }>
      <View style={styles.hero}>
        <View style={[styles.halo, { backgroundColor: theme.primarySoft }]}>
          <Mascot mood="waving" size={160} />
        </View>
        <ThemedText type="hero" style={styles.center}>
          {t('onboarding.terms.title')}
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={[styles.center, { maxWidth: 300 }]}>
          {t('onboarding.terms.body')}
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
