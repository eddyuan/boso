import { Stack } from 'expo-router';

/**
 * The pet tab, plus renaming the pet as a nested route.
 *
 * Nested rather than top-level so the URL says whose sheet it is — `/pet/rename` — and a
 * cold link lands with pet behind the backdrop rather than whatever the root
 * stack's anchor happens to be. `transparentModal` keeps this screen mounted and
 * visible underneath.
 */
export default function PetLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="rename"
        options={{ presentation: 'transparentModal', animation: 'fade' }}
      />
    </Stack>
  );
}
