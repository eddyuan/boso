import { Stack } from 'expo-router';

/**
 * One post, plus its who-looked sheet as a nested route: `/post/{id}/viewers`.
 *
 * The feed has its own copy of that route, because the sheet belongs to the page
 * you opened it from — dismissing should put you back there, not somewhere else.
 * Both render `ViewersBody`.
 */
export default function PostLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="viewers" options={{ presentation: 'transparentModal', animation: 'fade' }} />
    </Stack>
  );
}
