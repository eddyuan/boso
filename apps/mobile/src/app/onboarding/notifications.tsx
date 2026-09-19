import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { CompanionArt } from '@/components/mascot/companions';
import { Mascot } from '@/components/mascot/mascot';
import { TitleBlock } from '@/components/auth-form';
import { OnboardingScreen } from '@/components/onboarding-screen';
import { ThemedText } from '@/components/themed-text';
import { Badge, Card } from '@/components/ui/controls';
import { useT } from '@/lib/i18n';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { apiFetch } from '@/lib/api';
import { submitStep } from '@/lib/onboarding';

// Registers this install's Expo push token with the API. Needs a physical
// device and an EAS project ID; silently skipped otherwise (e.g. simulator).
async function registerPushToken() {
  if (Platform.OS === 'web' || !Device.isDevice) return;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return;
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  await apiFetch('/api/me/push-tokens', {
    method: 'POST',
    body: JSON.stringify({ token, platform: Platform.OS }),
  });
}

export default function NotificationsStep() {
  const theme = useTheme();
  const { t } = useT();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function finish(granted: boolean) {
    setError(null);
    setLoading(true);
    const code = await submitStep('notifications', { granted });
    setLoading(false);
    if (code) setError(t('onboarding.error.save'));
  }

  async function allow() {
    let granted = false;
    if (Platform.OS !== 'web') {
      const { status } = await Notifications.requestPermissionsAsync();
      granted = status === 'granted';
      if (granted) await registerPushToken().catch(() => {});
    }
    await finish(granted);
  }

  return (
    <OnboardingScreen
      step="notifications"
      centered
      continueLabel={t('onboarding.notifications.allow')}
      onContinue={allow}
      onSkip={() => finish(false)}
      loading={loading}
      error={error}>
      <View style={styles.illustration}>
        {/* Example of the heads-up the user will get */}
        <Card style={[styles.preview, { boxShadow: '0px 10px 24px rgba(43,31,22,0.08)' }]}>
          <View style={[styles.previewAvatar, { backgroundColor: theme.primarySoft }]}>
            <CompanionArt species="cockatiel" size={36} />
          </View>
          <View style={styles.previewText}>
            <ThemedText type="label">{t('onboarding.notifications.example')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {t('onboarding.notifications.exampleBody')}
            </ThemedText>
          </View>
          <Badge label={t('onboarding.notifications.review')} tone="brand" />
        </Card>
        <Mascot mood="excited" size={130} />
      </View>
      <TitleBlock
        title={t('onboarding.notifications.title')}
        subtitle={t('onboarding.notifications.subtitle')}
      />
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  illustration: { alignItems: 'center', gap: Spacing.lg, marginBottom: Spacing.lg },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, alignSelf: 'stretch' },
  previewAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  previewText: { flex: 1, minWidth: 0 },
});
