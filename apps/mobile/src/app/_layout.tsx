import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { getContactStatus } from '@bsocial/shared';
import { Fredoka_500Medium, Fredoka_600SemiBold } from '@expo-google-fonts/fredoka';
import { Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold } from '@expo-google-fonts/nunito';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { Colors, FontFamily } from '@/constants/theme';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { authClient } from '@/lib/auth-client';
import { I18nProvider } from '@/lib/i18n';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { data: session, isPending } = authClient.useSession();
  const [fontsLoaded, fontError] = useFonts({
    Fredoka_500Medium,
    Fredoka_600SemiBold,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });
  // Don't block the app forever if a font fails; system fonts are the fallback.
  const ready = !isPending && (fontsLoaded || !!fontError);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  // Exactly one of these stages is active at a time, in this order.
  const signedIn = !!session;
  const ageRestricted = signedIn && !!session.user.ageGateFailedAt;
  const verified = signedIn && !ageRestricted && getContactStatus(session.user).verified;
  const onboarded = verified && !!session.user.onboardingCompletedAt;

  return (
    // Required by react-native-gesture-handler, which the map's bottom sheet uses.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <I18nProvider>
      <ThemeProvider value={navigationTheme(colorScheme === 'dark')}>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={onboarded}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="post/[postId]" />
        <Stack.Screen name="diary" />
        <Stack.Screen name="event" />
        <Stack.Screen name="shelf" />
        <Stack.Screen name="bond" />
        <Stack.Screen name="friend/[petId]" />
        <Stack.Screen name="pet-log" />
        <Stack.Screen name="account" />
          <Stack.Screen name="devices" />
        </Stack.Protected>
        <Stack.Protected guard={verified && !onboarded}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && !ageRestricted && !verified}>
          <Stack.Screen name="verify-contact" />
        </Stack.Protected>
        <Stack.Protected guard={ageRestricted}>
          <Stack.Screen name="age-restricted" />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="sign-in" />
          <Stack.Screen name="sign-up" />
        </Stack.Protected>
        {/* Used both signed out (phone sign-in) and signed in (add/verify contact). */}
        <Stack.Screen name="phone" />
        <Stack.Screen name="email" />
      </Stack>
      </ThemeProvider>
      </I18nProvider>
    </GestureHandlerRootView>
  );
}

function navigationTheme(dark: boolean) {
  const base = dark ? DarkTheme : DefaultTheme;
  const c = dark ? Colors.dark : Colors.light;
  return {
    ...base,
    colors: { ...base.colors, primary: c.primaryInk, background: c.background, card: c.background, text: c.text, border: c.line },
    fonts: {
      ...base.fonts,
      regular: { fontFamily: FontFamily.body, fontWeight: '400' as const },
      medium: { fontFamily: FontFamily.bodyBold, fontWeight: '500' as const },
      bold: { fontFamily: FontFamily.display, fontWeight: '600' as const },
      heavy: { fontFamily: FontFamily.display, fontWeight: '700' as const },
    },
  };
}
