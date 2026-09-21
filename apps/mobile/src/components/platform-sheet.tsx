import { type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SheetScreen } from '@/components/sheet-screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * A sheet that uses the platform's own on native and ours on web.
 *
 * On iOS and Android, `presentation: 'formSheet'` gives the real thing —
 * `UISheetPresentationController` and a Material bottom sheet respectively — so
 * the backdrop, grabber, corner radius, drag and swipe-to-dismiss all come from
 * the OS and match every other sheet on the device. Nothing we draw will match
 * that as well as the OS does.
 *
 * On web there is no native sheet, and react-navigation's fallback for
 * `formSheet` is poor: the content renders flush to the *top* of the window with
 * no backdrop, no rounded corners and the page behind blanked out. So web keeps
 * `SheetScreen`, which draws its own and looks the same everywhere.
 *
 * `SHEET_OPTIONS` is the matching half of this — the screen's options have to
 * agree with which branch renders, so they're exported together.
 */
export const SHEET_OPTIONS = Platform.select({
  web: { presentation: 'transparentModal', animation: 'fade' },
  default: {
    presentation: 'formSheet',
    // Sized to the rows rather than to a fraction of the screen.
    sheetAllowedDetents: 'fitToContents',
    sheetGrabberVisible: true,
    sheetCornerRadius: Radius.card,
    sheetElevation: 24,
  },
} as const);

export function PlatformSheet({ title, children }: { title: string; children: ReactNode }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  if (Platform.OS === 'web') {
    return <SheetScreen title={title}>{children}</SheetScreen>;
  }

  // The OS draws the sheet around this; it only needs what goes inside.
  return (
    <View
      style={[styles.body, { backgroundColor: theme.surface, paddingBottom: insets.bottom + Spacing.lg }]}>
      <ThemedText type="label">{title}</ThemedText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: Spacing.lg, gap: Spacing.md },
});
