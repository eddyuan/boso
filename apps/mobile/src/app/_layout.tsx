import { getContactStatus } from '@bsocial/shared';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { authClient } from '@/lib/auth-client';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (!isPending) SplashScreen.hideAsync();
  }, [isPending]);

  if (isPending) return null;

  const signedIn = !!session;
  // Every account needs a verified email or phone before using the app.
  const verified = signedIn && getContactStatus(session.user).verified;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={verified}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="account" options={{ headerShown: true, title: 'Account' }} />
          <Stack.Screen name="devices" options={{ headerShown: true, title: 'Signed-in devices' }} />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && !verified}>
          <Stack.Screen name="verify-contact" />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="sign-in" />
          <Stack.Screen name="sign-up" />
        </Stack.Protected>
        {/* Used both signed out (phone sign-in) and signed in (add/verify contact). */}
        <Stack.Screen name="phone" options={{ headerShown: true, title: 'Phone number' }} />
        <Stack.Screen name="email" options={{ headerShown: true, title: 'Email' }} />
      </Stack>
    </ThemeProvider>
  );
}
