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

/**
 * What sits underneath a screen someone deep-links straight to.
 *
 * Without this, a cold load of a sheet route renders the sheet over nothing — a
 * backdrop dimming an empty screen, with no page behind and nowhere for back to
 * go. Anchoring the stack to the tabs means the sheet always has a page under it.
 *
 * Unverified locally: an unauthenticated cold load is sent to sign-in by the
 * guards, so there is never a tab screen to anchor to and the case can't be
 * observed without a session.
 */
export const unstable_settings = { anchor: '(tabs)' };

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
      {/* Outermost of the two, so every screen and the splash overlay can read a
          locale — ThemedText does, which is nearly every line of text in the app. */}
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
              {/* The backdropped sheets. `transparentModal` keeps the screen
                  below mounted and visible, which is what makes the backdrop read
                  as a dim over the page rather than a new page. They're routes so
                  that closing is popping a history entry — which is what gets
                  Android back, browser back and the swipe gesture all behaving the
                  same way without a per-platform shim. The map's sheet is not one
                  of these: it has no backdrop and the map stays live behind it. */}
              <Stack.Screen
                name="language"
                options={{ presentation: 'transparentModal', animation: 'fade' }}
              />
              <Stack.Screen
                name="rename-pet"
                options={{ presentation: 'transparentModal', animation: 'fade' }}
              />
              <Stack.Screen
                name="viewers/[postId]"
                options={{ presentation: 'transparentModal', animation: 'fade' }}
              />
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
