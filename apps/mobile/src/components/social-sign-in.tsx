import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { AppleLogo, GoogleLogo, Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { useTheme } from '@/hooks/use-theme';
import { isNativeAppleAvailable, signInWithProvider, type SocialProvider } from '@/lib/social';

type Props = { onError: (message: string | null) => void };

// Apple (native sheet on iOS, browser elsewhere), Google (browser), and phone.
export function SocialSignIn({ onError }: Props) {
  const theme = useTheme();
  const { t } = useT();
  const colorScheme = useColorScheme();
  const [nativeAppleAvailable, setNativeAppleAvailable] = useState(false);

  useEffect(() => {
    isNativeAppleAvailable().then(setNativeAppleAvailable);
  }, []);

  async function signIn(provider: SocialProvider) {
    onError(null);
    try {
      onError(await signInWithProvider(provider));
    } catch (e) {
      onError(e instanceof Error ? e.message : `Sign in with ${provider} failed`);
    }
  }

  return (
    <View style={styles.stack}>
      {nativeAppleAvailable ? (
        // Apple's own button is required for native Sign in with Apple.
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={
            colorScheme === 'dark'
              ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
              : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
          }
          cornerRadius={Radius.button}
          style={styles.appleNative}
          onPress={() => signIn('apple')}
        />
      ) : (
        <Button
          variant="apple"
          label={t('auth.continueWithApple')}
          icon={<AppleLogo color={theme.background} />}
          onPress={() => signIn('apple')}
        />
      )}
      <Button
        variant="secondary"
        label={t('auth.continueWithGoogle')}
        icon={<GoogleLogo />}
        onPress={() => signIn('google')}
      />
      <Button
        variant="secondary"
        label={t('auth.continueWithPhone')}
        icon={<Icon name="phone" />}
        onPress={() => router.push('/phone')}
      />
    </View>
  );
}

export function OrDivider({ label }: { label?: string }) {
  const theme = useTheme();
  const { t } = useT();
  return (
    <View style={styles.divider}>
      <View style={[styles.line, { backgroundColor: theme.line }]} />
      <ThemedText type="smallBold" themeColor="textSecondary">
        {label ?? t('auth.or')}
      </ThemedText>
      <View style={[styles.line, { backgroundColor: theme.line }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: Spacing.sm + 2 },
  appleNative: { height: 56 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: Spacing.sm },
  line: { flex: 1, height: 2 },
});
