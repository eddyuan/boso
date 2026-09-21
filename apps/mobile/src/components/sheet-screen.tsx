import { router } from 'expo-router';
import { type ReactNode, useCallback, useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/lib/i18n';

/** Never taller than this share of the screen, however much content there is. */
const MAX_HEIGHT = 0.86;
/** Drag this far down and it closes instead of springing back. */
const CLOSE_THRESHOLD = 90;
const IN_MS = 220;
const OUT_MS = 170;

/**
 * A sheet with a backdrop, rendered **as its own route**.
 *
 * The other sheet is [`BottomSheet`](./bottom-sheet.tsx), which has no backdrop,
 * lets the map stay live behind it, and is used only on the map. This one is
 * modal in the real sense: the backdrop says the rest of the screen isn't
 * available, and the thing underneath is inert.
 *
 * **Why a route rather than an overlay.** Back has to close the sheet, not leave
 * the screen. As an in-place `Modal` that worked on Android — `onRequestClose`
 * fires on the hardware back button — but not on web, where `react-native-web`
 * wires that hook to the Escape key and nothing else, so browser back navigated
 * away with the sheet still notionally open. A route gets it right on every
 * platform for free, because closing *is* popping a history entry: Android back,
 * browser back, and the swipe gesture all do the same thing without a shim.
 *
 * Declared with `presentation: 'transparentModal'` so the screen underneath stays
 * mounted and visible through the backdrop.
 */
export function SheetScreen({
  title,
  children,
  scrollable,
}: {
  title?: ReactNode;
  children: ReactNode;
  /** Set when the content is long enough to need its own scroll. */
  scrollable?: boolean;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { t } = useT();

  const progress = useSharedValue(0);
  const drag = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: IN_MS });
  }, [progress]);

  /**
   * Plays the exit, then pops.
   *
   * Only for dismissals we initiate — a tap or a drag. A hardware or browser back
   * pops the route first and the stack's own transition covers it, which is why
   * this doesn't try to intercept those.
   */
  const close = useCallback(() => {
    progress.value = withTiming(0, { duration: OUT_MS }, (done) => {
      if (done) runOnJS(router.back)();
    });
  }, [progress]);

  const pan = Gesture.Pan()
    .activeOffsetY([-8, 8])
    .onUpdate((e) => {
      drag.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (drag.value + e.velocityY * 0.15 > CLOSE_THRESHOLD) runOnJS(close)();
      else drag.value = withTiming(0, { duration: 140 });
    });

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * height * MAX_HEIGHT + drag.value }],
  }));

  return (
    <View style={styles.fill}>
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable
          style={styles.fill}
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel={t('action.close')}
        />
      </Animated.View>

      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.surface,
              maxHeight: height * MAX_HEIGHT,
              paddingBottom: insets.bottom + Spacing.lg,
            },
            sheetStyle,
          ]}>
          <View style={[styles.grabber, { backgroundColor: theme.line }]} />
          {title !== undefined && (
            <View style={styles.head}>
              <View style={{ flex: 1, minWidth: 0 }}>
                {typeof title === 'string' ? <ThemedText type="label">{title}</ThemedText> : title}
              </View>
              <Pressable
                onPress={close}
                accessibilityRole="button"
                accessibilityLabel={t('action.close')}
                style={({ pressed }) => [
                  styles.close,
                  { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.7 : 1 },
                ]}>
                <Icon name="close" size={18} />
              </Pressable>
            </View>
          )}
          {scrollable ? (
            <ScrollView
              contentContainerStyle={styles.body}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
          ) : (
            <View style={styles.body}>{children}</View>
          )}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(43,31,22,0.45)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: Radius.card,
    borderTopRightRadius: Radius.card,
    paddingTop: Spacing.sm,
    boxShadow: '0px -6px 24px rgba(43,31,22,0.18)',
  },
  grabber: { width: 44, height: 5, borderRadius: 3, alignSelf: 'center' },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  close: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  body: { padding: Spacing.lg, gap: Spacing.md },
});
