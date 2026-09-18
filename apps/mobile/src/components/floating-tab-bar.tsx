import { router } from 'expo-router';
import { Fragment, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTabBarVisibility } from '@/components/tab-bar-visibility';
import { Icon, type IconName } from '@/components/ui/icon';
import { Elevation, Radius, Spacing, TabBar } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** How far the bar drops on its way out, in px. */
const EXIT_TRAVEL = 120;
const EXIT_MS = 220;
// Loose enough to overshoot a little on arrival.
const HIGHLIGHT_SPRING = { damping: 15, stiffness: 190, mass: 0.7 };
// The squash settles with a lowish-damping spring, which is what reads as "jello".
const SQUISH_SPRING = { damping: 11, stiffness: 190, mass: 0.6 };
const SQUISH_MS = 130;
/** How much it stretches along the travel and pinches across it. */
const STRETCH = 0.16;
const PINCH = 0.1;
/** Its own button beside the pill, matching the bar's height. */
const COMPOSE_SIZE = TabBar.height;
/**
 * The gap between a tab and the edge of the pill. Derived from the heights so
 * the space around the highlight is the same on all four sides.
 */
const EDGE = (TabBar.height - TabBar.itemHeight) / 2;

/**
 * Where a tab sits inside the pill, for the sliding highlight: `Spacing.sm` of
 * padding, then one step per tab.
 */
function tabOffset(index: number): number {
  return EDGE + index * (TabBar.itemWidth + Spacing.xs / 2);
}

const ICONS: Record<string, IconName> = {
  index: 'map',
  feed: 'feed',
  activity: 'bell',
  profile: 'person',
};

/**
 * The part of @react-navigation's BottomTabBarProps this bar uses. Typed here
 * rather than imported: expo-router owns that package, so it isn't a direct
 * dependency of the app.
 */
type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  descriptors: Record<string, { options: { title?: string } }>;
  navigation: { navigate(name: string): void };
};

/**
 * A pill that hugs its tabs and floats over the content, rather than a
 * full-width bar welded to the bottom edge. Because it floats, scrolling
 * screens pad their content by `TabBar.contentInset` (see the Screen component).
 *
 * Icons only, with writing a post as the raised button in the middle: it's the
 * one thing here that isn't a destination, so it shouldn't look like one.
 *
 * It slides down and fades out when a screen needs the space — the map's detail
 * sheet does this, since it covers the bottom of the screen.
 */
export function FloatingTabBar({ state, descriptors, navigation }: TabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { hidden } = useTabBarVisibility();

  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(hidden ? 1 : 0, { duration: EXIT_MS });
  }, [hidden, progress]);
  const hideStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [{ translateY: progress.value * EXIT_TRAVEL }],
  }));

  // One highlight that slides between tabs, rather than each tab lighting up.
  // It stretches along the way and wobbles back to shape on arrival.
  const highlightX = useSharedValue(tabOffset(state.index));
  const squish = useSharedValue(0);
  const firstRender = useRef(true);
  useEffect(() => {
    const target = tabOffset(state.index);
    if (firstRender.current) {
      // Don't animate in from the left on mount.
      highlightX.value = target;
      firstRender.current = false;
      return;
    }
    highlightX.value = withSpring(target, HIGHLIGHT_SPRING);
    squish.value = withSequence(withTiming(1, { duration: SQUISH_MS }), withSpring(0, SQUISH_SPRING));
  }, [state.index, highlightX, squish]);

  const highlightStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: highlightX.value },
      { scaleX: 1 + squish.value * STRETCH },
      { scaleY: 1 - squish.value * PINCH },
    ],
  }));

  return (
    <Animated.View
      // The bar is centred and only as wide as its tabs, so taps either side of
      // it must reach the map underneath.
      style={[styles.wrap, { bottom: insets.bottom + TabBar.bottomOffset }, hideStyle]}
      pointerEvents={hidden ? 'none' : 'box-none'}>
      <View style={[styles.bar, { backgroundColor: theme.surface }, Elevation.floating]}>
        <Animated.View
          style={[styles.highlight, { backgroundColor: theme.primarySoft }, highlightStyle]}
          pointerEvents="none"
        />
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label = typeof options.title === 'string' ? options.title : route.name;
          const focused = state.index === index;

          return (
            <Fragment key={route.key}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={focused ? { selected: true } : {}}
                // The label is gone from the UI, so it only exists here now.
                accessibilityLabel={label}
                onPress={() => {
                  if (!focused) navigation.navigate(route.name);
                }}
                style={({ pressed }) => [styles.tab, pressed && !focused && { opacity: 0.6 }]}>
                <Icon
                  name={ICONS[route.name] ?? 'sparkle'}
                  size={22}
                  color={focused ? theme.primaryInk : theme.textSecondary}
                  strokeWidth={focused ? 2.6 : 2.1}
                />
              </Pressable>
            </Fragment>
          );
        })}
      </View>

      {/* Its own button, outside the pill — same surface, elevation and icon
          size as the tabs, so it reads as part of the same control. */}
      <Pressable
        onPress={() => router.push('/compose')}
        accessibilityRole="button"
        accessibilityLabel="New post"
        style={({ pressed }) => [
          styles.compose,
          { backgroundColor: theme.surface },
          Elevation.floating,
          pressed && { opacity: 0.6 },
        ]}>
        <Icon name="plus" size={22} color={theme.textSecondary} strokeWidth={2.4} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs / 2,
    height: TabBar.height,
    paddingHorizontal: EDGE,
    borderRadius: Radius.pill,
  },
  tab: {
    width: TabBar.itemWidth,
    height: TabBar.itemHeight,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlight: {
    position: 'absolute',
    left: 0,
    top: (TabBar.height - TabBar.itemHeight) / 2,
    width: TabBar.itemWidth,
    height: TabBar.itemHeight,
    borderRadius: Radius.pill,
  },
  compose: {
    width: COMPOSE_SIZE,
    height: COMPOSE_SIZE,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
