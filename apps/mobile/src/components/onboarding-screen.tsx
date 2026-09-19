import { ONBOARDING_STEPS, type OnboardingStep } from '@bsocial/shared';
import { type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Screen, TitleBlock } from '@/components/auth-form';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { BackButton, ErrorText, ProgressBar } from '@/components/ui/controls';
import { useT } from '@/lib/i18n';
import { Spacing } from '@/constants/theme';
import { goToStep, stepNumber } from '@/lib/onboarding';

type Props = {
  step: OnboardingStep;
  title?: string;
  subtitle?: string;
  children?: ReactNode;
  error?: string | null;
  continueLabel?: string;
  onContinue: () => void;
  continueDisabled?: boolean;
  loading?: boolean;
  // Optional steps (notifications, contacts, calendar)
  onSkip?: () => void;
  skipLabel?: string;
  // Extra content under the primary button (e.g. consent microcopy)
  footerNote?: ReactNode;
  centered?: boolean;
};

// Onboarding step layout: back + progress header, title, content, and the
// primary action pinned to the bottom.
export function OnboardingScreen({
  step,
  title,
  subtitle,
  children,
  error,
  continueLabel,
  onContinue,
  continueDisabled,
  loading,
  onSkip,
  skipLabel,
  footerNote,
  centered,
}: Props) {
  const { t } = useT();
  const { index, total } = stepNumber(step);
  const previous = index > 1 ? ONBOARDING_STEPS[index - 2] : null;

  return (
    <Screen
      centered={centered}
      header={
        <View style={styles.header}>
          {previous ? <BackButton onPress={() => goToStep(previous)} /> : <View style={styles.backSpacer} />}
          <ProgressBar value={index / total} />
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.count}>
            {t('onboarding.step', { index, total })}
          </ThemedText>
        </View>
      }
      footer={
        <>
          <ErrorText message={error} />
          <Button label={continueLabel ?? t('onboarding.continue')} onPress={onContinue} disabled={continueDisabled} loading={loading} />
          {footerNote}
          {onSkip && (
            <Pressable onPress={onSkip} accessibilityRole="button" style={styles.skip}>
              <ThemedText type="link" themeColor="textSecondary">
                {skipLabel ?? t('onboarding.notNow')}
              </ThemedText>
            </Pressable>
          )}
        </>
      }>
      {title && <TitleBlock title={title} subtitle={subtitle} />}
      <View style={[styles.body, centered && styles.bodyCentered]}>{children}</View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, height: 44 },
  backSpacer: { width: 44, height: 44 },
  count: { width: 40, textAlign: 'right' },
  body: { marginTop: Spacing.sm, gap: Spacing.lg },
  bodyCentered: { flexGrow: 1, justifyContent: 'center' },
  skip: { alignItems: 'center', paddingVertical: Spacing.sm },
});
