import { Stack } from 'expo-router';

/**
 * The feed tab, plus the who-looked sheet as a nested route.
 *
 * Nested rather than top-level so the URL says whose sheet it is — `/feed/viewers/[postId]` — and a
 * cold link lands with feed behind the backdrop rather than whatever the root
 * stack's anchor happens to be. `transparentModal` keeps this screen mounted and
 * visible underneath.
 *
 * The post screen carries its own copy of this route for the same reason: the
 * sheet belongs to whichever page you opened it from, so dismissing returns you
 * there. Both are thin wrappers over one `ViewersBody`.
 */
export default function FeedLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="viewers/[postId]"
        options={{ presentation: 'transparentModal', animation: 'fade' }}
      />
    </Stack>
  );
}
