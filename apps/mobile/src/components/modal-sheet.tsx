import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
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

type Props = {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  /** Set when the content scrolls on its own and shouldn't be wrapped again. */
  scrollable?: boolean;
};

/**
 * A sheet with a backdrop, for asking one question and getting out of the way.
 *
 * **The other sheet is [`BottomSheet`](./bottom-sheet.tsx), and the difference is
 * not cosmetic.** That one has no backdrop on purpose: it's the map's detail
 * panel, the map stays live and interactive behind it, and selecting something
 * else swaps the contents rather than stacking. It is only ever used on the map.
 *
 * This one is the opposite in every way that matters. It is *modal*: the backdrop
 * says the rest of the screen is not available, tapping it dismisses, and the
 * thing underneath is deliberately inert. That's what picking a language or
 * renaming a pet wants — a decision to make and then be done with.
 *
 * Built on React Native's `Modal` rather than an absolutely-positioned overlay,
 * which buys three things that are awkward otherwise: it renders above
 * everything including the floating tab bar, the Android back button dismisses
 * it, and — since it isn't part of the page's view tree at all — it can't inflate
 * the scroll height of whatever is behind it, which is exactly the bug an
 * in-tree sheet caused on the tab screens.
 *
 * It sizes to its content up to `MAX_HEIGHT`, because these are short; the map's
 * sheet is a fixed 86% because a detail panel wants a predictable resting height.
 */
export function ModalSheet({ open, onClose, title, children, scrollable }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { t } = useT();

  // `Modal` has to outlive `open` so the exit animation has something to play on.
  const [mounted, setMounted] = useState(open);
  const progress = useSharedValue(0);
  const drag = useSharedValue(0);

  useEffect(() => {
    if (open) {
      setMounted(true);
      drag.value = 0;
      progress.value = withTiming(1, { duration: IN_MS });
    } else if (mounted) {
      progress.value = withTiming(0, { duration: OUT_MS }, (done) => {
        if (done) runOnJS(setMounted)(false);
      });
    }
  }, [open, mounted, progress, drag]);

  const dismiss = useCallback(() => {
    progress.value = withTiming(0, { duration: OUT_MS }, (done) => {
      if (done) {
        runOnJS(setMounted)(false);
        runOnJS(onClose)();
      }
    });
  }, [onClose, progress]);

  const pan = Gesture.Pan()
    .activeOffsetY([-8, 8])
    .onUpdate((e) => {
      drag.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (drag.value + e.velocityY * 0.15 > CLOSE_THRESHOLD) runOnJS(dismiss)();
      else drag.value = withTiming(0, { duration: 140 });
    });

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    // Slides its own height, so the distance is right whatever the content.
    transform: [{ translateY: (1 - progress.value) * height * MAX_HEIGHT + drag.value }],
  }));

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={dismiss} statusBarTranslucent>
      {/* gesture-handler needs its own root inside a Modal to see touches. */}
      <GestureHandlerRootView style={styles.fill}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable
            style={styles.fill}
            onPress={dismiss}
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
                  onPress={dismiss}
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
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(43,31,22,0.45)' },
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
