import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ErrorText, Screen, TitleBlock } from '@/components/auth-form';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { CodeInput } from '@/components/ui/code-input';
import { BackButton } from '@/components/ui/controls';
import { Icon, type IconName } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { useTheme } from '@/hooks/use-theme';

export const RESEND_SECONDS = 45;

// Icon tile shown at the top of phone/email screens.
export function HeroIcon({ name }: { name: IconName }) {
  const theme = useTheme();
  return (
    <View style={[styles.heroIcon, { backgroundColor: theme.primarySoft }]}>
      <Icon name={name} size={30} color={theme.primaryInk} />
    </View>
  );
}

/** Named apart from `components/back-header.tsx`: this one falls back to the root
 * rather than assuming there's history, which is what a deep-linked code screen
 * needs. */
export function AuthBackHeader() {
  return <BackButton onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />;
}

// Step 2 of phone/email verification: six-box code entry with resend timer.
export function VerifyCodeScreen({
  icon,
  destination,
  onVerify,
  onResend,
  onChangeDestination,
  changeLabel,
  footerExtra,
}: {
  icon: IconName;
  destination: string;
  onVerify: (code: string) => Promise<string | null>;
  onResend: () => Promise<string | null>;
  onChangeDestination: () => void;
  changeLabel: string;
  footerExtra?: ReactNode;
}) {
  const { t } = useT();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  async function verify(value = code) {
    setError(null);
    setLoading(true);
    const message = await onVerify(value);
    setLoading(false);
    if (message) {
      setError(message);
      setCode('');
    }
  }

  async function resend() {
    setError(null);
    const message = await onResend();
    if (message) setError(message);
    else setSecondsLeft(RESEND_SECONDS);
  }

  return (
    <Screen
      header={<AuthBackHeader />}
      footer={
        <>
          <ErrorText message={error} />
          <Button label={t('contact.verify')} onPress={() => verify()} loading={loading} disabled={code.length < 6} />
          {footerExtra}
        </>
      }>
      <HeroIcon name={icon} />
      <TitleBlock
        title={t('contact.code.title')}
        subtitle={t('contact.code.sent', { contact: destination })}
      />
      <View style={{ marginTop: Spacing.lg }}>
        <CodeInput
          value={code}
          onChange={(v) => {
            setCode(v);
            if (v.length === 6) verify(v); // auto-submit when complete
          }}
        />
      </View>
      <View style={styles.meta}>
        {secondsLeft > 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            {t('contact.code.resendIn', { seconds: secondsLeft })}
          </ThemedText>
        ) : (
          <Pressable onPress={resend} accessibilityRole="button">
            <ThemedText type="linkPrimary">{t('contact.code.resend')}</ThemedText>
          </Pressable>
        )}
        <Pressable onPress={onChangeDestination} accessibilityRole="button">
          <ThemedText type="linkPrimary">{changeLabel}</ThemedText>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroIcon: { width: 64, height: 64, borderRadius: Radius.card, alignItems: 'center', justifyContent: 'center' },
  meta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.xs },
});
