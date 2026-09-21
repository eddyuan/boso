import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTabBarVisibility } from '@/components/tab-bar-visibility';
import { Icon } from '@/components/ui/icon';
import { Elevation, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Wide enough for a side card instead of a sheet — tablets and desktop. */
const SIDE_CARD_FROM = 700;
const SIDE_CARD_WIDTH = 380;
/** How tall the sheet is when fully open, as a fraction of the screen. */
const MAX_HEIGHT = 0.86;
/** Visible height when it first appears. */
const PEEK_HEIGHT = 280;
/** Drag past this far below the peek and it closes instead of springing back. */
const CLOSE_THRESHOLD = 80;
const SPRING = { damping: 20, stiffness: 180, mass: 0.7 };
/** Movement before a drag takes over, so taps and scrolls aren't hijacked. */
const DRAG_SLOP = 8;

type Props = {
  open: boolean;
  onClose: () => void;
  /** Always visible; on phones it's also the drag area. */
  header?: ReactNode;
  children: ReactNode;
  /** Changing this scrolls back to the top — e.g. the id of the selected post. */
  contentKey?: string;
};

/**
 * Detail panel for whatever is selected on the map. **Map only.**
 *
 * On a phone it's a draggable, scrollable bottom sheet; from tablet width up
 * it becomes a card down the side, because a sheet across a wide screen is
 * mostly empty space. Either way there is **no backdrop**: the map stays live
 * and interactive behind it, as it does in Google Maps, and selecting something
 * else swaps the contents rather than stacking another panel.
 *
 * That no-backdrop behaviour is the whole point of this component and the reason
 * it belongs to the map alone. Everywhere else — picking a language, renaming a
 * pet, seeing who looked at a post — wants the opposite: a modal that says the
 * rest of the screen is unavailable and gets out of the way once answered. That's
 * [`ModalSheet`](./modal-sheet.tsx), which is a different component rather than a
 * flag on this one, because almost nothing about them is shared: no backdrop
 * versus a backdrop, live content behind versus inert, a fixed resting height
 * versus sizing to content, and in-tree versus rendered through `Modal`.
 *
 * If you are reaching for this outside `app/(tabs)/index.tsx`, you want the other
 * one.
 */
export function BottomSheet({ open, onClose, header, children, contentKey }: Props) {
  const { width } = useWindowDimensions();
  return width >= SIDE_CARD_FROM ? (
    <SideCard open={open} onClose={onClose} header={header} contentKey={contentKey}>
      {children}
    </SideCard>
  ) : (
    <DragSheet open={open} onClose={onClose} header={header} contentKey={contentKey}>
      {children}
    </DragSheet>
  );
}

/** Scrolls back to the top whenever the selection changes. */
function useResetScroll(contentKey: string | undefined) {
  const ref = useRef<ScrollView>(null);
  useEffect(() => {
    ref.current?.scrollTo({ y: 0, animated: false });
  }, [contentKey]);
  return ref;
}

function DragSheet({ open, onClose, header, children, contentKey }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { setHidden } = useTabBarVisibility();

  const sheetHeight = Math.round(height * MAX_HEIGHT);
  const peek = Math.min(PEEK_HEIGHT, sheetHeight);
  // translateY: 0 is fully open, `collapsed` is the peek, `sheetHeight` is gone.
  const collapsed = sheetHeight - peek;

  const translateY = useSharedValue(sheetHeight);
  const startY = useSharedValue(0);
  // How far the content is scrolled, and whether the sheet is fully open —
  // both needed inside the gesture worklet to decide who gets the drag.
  const scrollY = useSharedValue(0);
  const atFullHeight = useSharedValue(false);
  const [scrollEnabled, setScrollEnabled] = useState(false);

  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [contentKey, scrollRef]);

  // The sheet covers the bottom of the screen, so the tab bar steps aside.
  useEffect(() => {
    setHidden(open);
    return () => setHidden(false);
  }, [open, setHidden]);

  useEffect(() => {
    translateY.value = withSpring(open ? collapsed : sheetHeight, SPRING);
    atFullHeight.value = false;
    setScrollEnabled(false);
  }, [open, collapsed, sheetHeight, translateY, atFullHeight]);

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const settle = (target: number) => {
    'worklet';
    atFullHeight.value = target === 0;
    // Keep scrolling off even at full height — the pan gesture stays in
    // control and hands off to the ScrollView only when the user drags up.
    // On web the browser's native scroll would otherwise capture the touch
    // before the pan gesture can decide what to do with it.
    runOnJS(setScrollEnabled)(false);
    translateY.value = withSpring(target, SPRING);
  };

  /**
   * Drag works anywhere on the sheet. Once it's fully open the content scrolls
   * instead — until you're back at the top and pulling down, which hands the
   * drag back to the sheet.
   */
  const drag = Gesture.Pan()
    .activeOffsetY([-DRAG_SLOP, DRAG_SLOP])
    .onStart(() => {
      startY.value = translateY.value;
      // Re-claim the gesture when the sheet is fully open and the content is
      // scrolled back to the top, so a downward drag moves the sheet.
      if (atFullHeight.value && scrollY.value <= 0) {
        runOnJS(setScrollEnabled)(false);
      }
    })
    .onUpdate((event) => {
      if (atFullHeight.value) {
        if (scrollY.value > 0 || event.translationY <= 0) {
          // Content is scrolled, or the user is dragging upward at the top —
          // hand the gesture to the ScrollView.
          runOnJS(setScrollEnabled)(true);
          return;
        }
      }
      translateY.value = Math.max(0, startY.value + event.translationY);
    })
    .onEnd((event) => {
      if (atFullHeight.value && translateY.value === 0) return;
      const projected = translateY.value + event.velocityY * 0.15;
      if (projected > collapsed + CLOSE_THRESHOLD) {
        runOnJS(setScrollEnabled)(false);
        atFullHeight.value = false;
        translateY.value = withTiming(sheetHeight, { duration: 180 }, (done) => {
          if (done) runOnJS(onClose)();
        });
        return;
      }
      settle(projected < collapsed / 2 ? 0 : collapsed);
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  return (
    <GestureDetector gesture={drag}>
      <Animated.View
        style={[styles.sheet, { height: sheetHeight, backgroundColor: theme.surface }, sheetStyle]}
        pointerEvents={open ? 'auto' : 'none'}>
        <View style={styles.head}>
          <View style={[styles.grabber, { backgroundColor: theme.line }]} />
          {header}
        </View>
        <Animated.ScrollView
          ref={scrollRef}
          style={styles.fill}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xxl }]}
          onScroll={onScroll}
          scrollEventThrottle={16}
          // Scrolling is enabled by the pan gesture when the user drags upward
          // at the top; disabled otherwise so the pan owns the touch everywhere
          // on the sheet (header and body alike).
          scrollEnabled={scrollEnabled}
          showsVerticalScrollIndicator={false}>
          {children}
        </Animated.ScrollView>
      </Animated.View>
    </GestureDetector>
  );
}

function SideCard({ open, onClose, header, children, contentKey }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const scrollRef = useResetScroll(contentKey);

  if (!open) return null;
  return (
    <View
      style={[
        styles.side,
        {
          backgroundColor: theme.surface,
          top: insets.top + Spacing.lg,
          bottom: insets.bottom + Spacing.lg,
        },
        Elevation.floating,
      ]}>
      <View style={styles.sideHead}>
        <View style={{ flex: 1, minWidth: 0 }}>{header}</View>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={({ pressed }) => [
            styles.close,
            { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.7 : 1 },
          ]}>
          <Icon name="close" size={18} />
        </Pressable>
      </View>
      <ScrollView
        ref={scrollRef}
        style={styles.fill}
        contentContainerStyle={[styles.content, { paddingBottom: Spacing.xl }]}
        showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: Radius.card,
    borderTopRightRadius: Radius.card,
    boxShadow: '0px -6px 24px rgba(43,31,22,0.18)',
  },
  head: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, gap: Spacing.md },
  grabber: { width: 44, height: 5, borderRadius: 3, alignSelf: 'center', marginTop: Spacing.sm },
  side: {
    position: 'absolute',
    right: Spacing.lg,
    width: SIDE_CARD_WIDTH,
    borderRadius: Radius.card,
    overflow: 'hidden',
  },
  sideHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    padding: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  close: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  fill: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg, gap: Spacing.md },
});
