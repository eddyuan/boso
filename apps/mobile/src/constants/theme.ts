/**
 * Tielo design tokens (see design/app-ui "UI kit"): playful & warm, golden
 * theme taken from the lutino cockatiel mascot, light + dark.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    // Surfaces
    background: '#FFF6EC',
    surface: '#FFFFFF',
    backgroundElement: '#F7EADA',
    backgroundSelected: '#EEDDC9',
    line: '#EEDDC9',
    // Text
    text: '#2B1F16',
    textSecondary: '#7D6B5B',
    // Brand
    primary: '#FFC53D',
    primaryPress: '#E09E00',
    primarySoft: '#FFF0C2',
    primaryInk: '#8A5A00',
    onPrimary: '#2B1F16',
    cheek: '#FF8A4C',
    // Status
    green: '#2F9E5E',
    greenSoft: '#DDF2E4',
    red: '#D9453F',
    redSoft: '#FCE3E1',
  },
  dark: {
    background: '#1A1410',
    surface: '#251D17',
    backgroundElement: '#30261E',
    backgroundSelected: '#3D3128',
    line: '#3D3128',
    text: '#FAF1E7',
    textSecondary: '#B6A594',
    primary: '#FFCB4D',
    primaryPress: '#B88312',
    primarySoft: '#3A2E12',
    primaryInk: '#FFD36B',
    onPrimary: '#1A1410',
    cheek: '#FF9A5E',
    green: '#5BC98A',
    greenSoft: '#1E3A2A',
    red: '#FF7A73',
    redSoft: '#41211E',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;
export type Theme = { [K in ThemeColor]: string };

// Loaded in app/_layout.tsx via @expo-google-fonts. Use the family per weight
// (custom fonts ignore fontWeight on Android).
export const FontFamily = {
  display: 'Fredoka_600SemiBold',
  displayMedium: 'Fredoka_500Medium',
  body: 'Nunito_600SemiBold',
  bodyBold: 'Nunito_700Bold',
  bodyHeavy: 'Nunito_800ExtraBold',
} as const;

export const Fonts = Platform.select({
  ios: { mono: 'ui-monospace' },
  web: { mono: 'var(--font-mono)' },
  default: { mono: 'monospace' },
});

export const Spacing = {
  /** 4 — icon to its own label, title to subtitle. */
  xs: 4,
  /** 8 — chips, badges, tight inline groups. */
  sm: 8,
  /** 12 — icon to text in a row, cards in a group. */
  md: 12,
  /** 16 — screen side padding, card padding, gap between posts. */
  lg: 16,
  /** 24 — gap between sections. */
  xl: 24,
  /** 32 — above a pinned bottom button. */
  xxl: 32,
  /** 48 — empty-state breathing room. */
  xxxl: 48,
} as const;

export const Radius = {
  icon: 14,
  field: 16,
  button: 18,
  card: 20,
  pill: 999,
} as const;

// Chunky "3D" edge under primary/secondary buttons.
export const ButtonEdge = { primary: 4, secondary: 3 } as const;

export const ControlHeight = 56;
export const MaxContentWidth = 520;

/**
 * Surfaces are told apart by fill and a little elevation rather than outlines —
 * borders are kept for selection and focus only, so screens don't read as busy.
 */
export const Elevation = {
  card: Platform.select({
    android: { elevation: 1 },
    default: { shadowColor: '#2B1F16', shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  }),
  /** Things that float over content: the tab bar, map cards. */
  floating: Platform.select({
    android: { elevation: 8 },
    default: { shadowColor: '#2B1F16', shadowOpacity: 0.2, shadowRadius: 15, shadowOffset: { width: 0, height: 8 } },
  }),
} as const;

/** Screen frame (see design/app-ui "Layout & spacing"). */
export const ScreenPadding = { horizontal: Spacing.lg, top: Spacing.xl } as const;

/**
 * The tab bar floats, so it sits over the content instead of reserving space.
 * Scrolling tabs pad their content by `contentInset` (plus the safe area) so the
 * last row is never hidden under it.
 */
export const TabBar = {
  height: 56,
  /** Above the safe-area inset. */
  bottomOffset: 20,
  itemWidth: 48,
  itemHeight: 40,
  contentInset: 56 + 20 + 16,
} as const;
