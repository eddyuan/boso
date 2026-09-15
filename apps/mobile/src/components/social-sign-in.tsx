import * as AppleAuthentication from 'expo-apple-authentication';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, useColorScheme } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isNativeAppleAvailable, signInWithProvider, type SocialProvider } from '@/lib/social';

type Props = { onError: (message: string | null) => void };

// Apple (native sheet on iOS, browser elsewhere), Google (browser), and phone.
export function SocialSignIn({ onError }: Props) {
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
    <>
      {nativeAppleAvailable ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={
            colorScheme === 'dark'
              ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
              : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
          }
          cornerRadius={Spacing.three}
          style={styles.appleButton}
          onPress={() => signIn('apple')}
        />
      ) : (
        <SecondaryButton label="Continue with Apple" onPress={() => signIn('apple')} />
      )}
      <SecondaryButton label="Continue with Google" onPress={() => signIn('google')} />
      <Link href="/phone" asChild>
        <SecondaryButton label="Continue with phone" />
      </Link>
      <ThemedText type="small" themeColor="textSecondary" style={styles.divider}>
        or
      </ThemedText>
    </>
  );
}

export function SecondaryButton({ label, onPress }: { label: string; onPress?: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.7 : 1 },
      ]}>
      <ThemedText type="smallBold">{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  appleButton: { height: 52 },
  button: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  divider: { textAlign: 'center' },
});
