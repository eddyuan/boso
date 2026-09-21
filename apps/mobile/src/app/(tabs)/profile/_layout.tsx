import { Stack } from 'expo-router';

/**
 * The profile tab, plus the language picker as a nested route.
 *
 * Nested rather than top-level so the URL says whose sheet it is — `/profile/language` — and a
 * cold link lands with profile behind the backdrop rather than whatever the root
 * stack's anchor happens to be. `transparentModal` keeps this screen mounted and
 * visible underneath.
 */
export default function ProfileLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="language"
        options={{ presentation: 'transparentModal', animation: 'fade' }}
      />
    </Stack>
  );
}
