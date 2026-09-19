import { requestCalendarPermissions } from 'expo-calendar';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { TitleBlock } from '@/components/auth-form';
import { OnboardingScreen } from '@/components/onboarding-screen';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/controls';
import { Icon } from '@/components/ui/icon';
import { useT } from '@/lib/i18n';
import { FontFamily, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { submitStep } from '@/lib/onboarding';

// Last step. Completing it finishes onboarding; the root layout then switches
// to the main app.
export default function CalendarStep() {
  const theme = useTheme();
  const { t } = useT();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supported = Platform.OS !== 'web';

  async function finish(granted: boolean) {
    setError(null);
    setLoading(true);
    const code = await submitStep('calendar', { granted });
    setLoading(false);
    if (code) setError(t('onboarding.error.save'));
  }

  async function allow() {
    let granted = false;
    try {
      // Read-only access (writeOnly: false).
      granted = (await requestCalendarPermissions(false)).granted;
    } catch {
      // Treat failures as a skip; this step is optional.
    }
    await finish(granted);
  }

  // An illustration of a day, not the user's actual calendar.
  const slots = [
    { time: '10:00', label: t('onboarding.calendar.exampleBusy'), bg: theme.primarySoft, fg: theme.primaryInk },
    { time: '14:00', label: t('onboarding.calendar.exampleTitle'), bg: theme.greenSoft, fg: theme.green },
    { time: '19:00', label: t('onboarding.calendar.exampleEvent'), bg: theme.backgroundElement, fg: theme.textSecondary },
  ];

  return (
    <OnboardingScreen
      step="calendar"
      centered
      continueLabel={t(supported ? 'onboarding.calendar.connect' : 'onboarding.finish')}
      onContinue={supported ? allow : () => finish(false)}
      onSkip={supported ? () => finish(false) : undefined}
      loading={loading}
      error={error}>
      <Card style={[styles.agenda, { boxShadow: '0px 10px 24px rgba(43,31,22,0.08)' }]}>
        <View style={styles.agendaHeader}>
          <ThemedText type="header" style={{ fontSize: 18 }}>
            {t('common.today')}
          </ThemedText>
          <Icon name="calendar" size={20} color={theme.textSecondary} />
        </View>
        {slots.map((s) => (
          <View key={s.time} style={styles.slot}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.time}>
              {s.time}
            </ThemedText>
            <View style={[styles.event, { backgroundColor: s.bg }]}>
              <ThemedText style={{ fontFamily: FontFamily.bodyHeavy, fontSize: 14, color: s.fg }}>{s.label}</ThemedText>
            </View>
          </View>
        ))}
      </Card>
      <TitleBlock
        title={t('onboarding.calendar.title')}
        subtitle={t('onboarding.calendar.subtitle')}
      />
      <ThemedText type="small" themeColor="textSecondary">
        {t(supported ? 'onboarding.calendar.private' : 'onboarding.webOnly.calendar')}
      </ThemedText>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  agenda: { padding: Spacing.lg, gap: 10, marginBottom: Spacing.lg },
  agendaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  slot: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  time: { width: 48 },
  event: { flex: 1, height: 40, borderRadius: Radius.icon - 2, justifyContent: 'center', paddingHorizontal: 12 },
});
