import { Stack } from 'expo-router';

import { SHEET_OPTIONS } from '@/components/platform-sheet';

/**
 * The profile tab, plus the language picker as a nested route.
 *
 * Nested rather than top-level so the URL says whose sheet it is —
 * `/profile/language` — and a cold link lands with profile behind rather than
 * whatever the root stack's anchor happens to be.
 *
 * The presentation comes from `SHEET_OPTIONS`, which picks the platform's own
 * sheet on native and ours on web. See `platform-sheet.tsx` for why.
 */
export default function ProfileLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="language" options={SHEET_OPTIONS} />
    </Stack>
  );
}
