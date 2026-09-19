import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { FontFamily, Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useLocaleOrDefault } from '@/lib/i18n';

export type ThemedTextProps = TextProps & {
  type?:
    | 'default'
    | 'hero'
    | 'title'
    | 'header'
    | 'subtitle'
    | 'small'
    | 'smallBold'
    | 'label'
    | 'section'
    | 'caption'
    | 'link'
    | 'linkPrimary'
    | 'code';
  themeColor?: ThemeColor;
};

/**
 * Languages the bundled fonts can't draw.
 *
 * Fredoka and Nunito have no CJK glyphs at all. Left alone, the platform falls
 * back per *glyph*, so one Chinese sentence with a name or a number in it comes
 * out in two typefaces at two apparent weights. Handing the whole run to the
 * system face instead is the lesser evil — PingFang and Noto Sans CJK are both
 * good, and consistency beats keeping the rounded look on the Latin characters
 * that happen to be in the string.
 *
 * Keyed by the **language subtag**, not the locale, because what the fonts lack is
 * a script: `zh-Hant` and `zh-Hans` are equally uncovered, and listing locales
 * would mean this file silently needs editing every time one is added.
 */
const NO_LATIN_FONT_COVERAGE = new Set(['zh', 'ja', 'ko']);

/**
 * With the family gone, so is the weight — Nunito_700Bold carried it in the name.
 * These put it back explicitly, so a label still reads as a label.
 */
const FALLBACK_WEIGHT: Partial<Record<NonNullable<ThemedTextProps['type']>, TextStyle>> = {
  hero: { fontWeight: '700' },
  title: { fontWeight: '700' },
  header: { fontWeight: '600' },
  subtitle: { fontWeight: '600' },
  smallBold: { fontWeight: '700' },
  label: { fontWeight: '700' },
  // Uppercasing and letter-spacing a run of Han characters just spreads them out.
  section: { fontWeight: '700', textTransform: 'none', letterSpacing: 0 },
  link: { fontWeight: '700' },
  linkPrimary: { fontWeight: '700' },
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const locale = useLocaleOrDefault();
  const defaultColor =
    type === 'link' || type === 'linkPrimary'
      ? theme.primaryInk
      : type === 'section' || type === 'caption'
        ? theme.textSecondary
        : theme.text;

  // `code` keeps its mono family: monospace is the point of it, and the system
  // mono faces cover CJK.
  const systemFace = NO_LATIN_FONT_COVERAGE.has(locale.split('-')[0]!) && type !== 'code';

  return (
    <Text
      style={[
        { color: themeColor ? theme[themeColor] : defaultColor },
        styles[type],
        systemFace && { fontFamily: undefined },
        systemFace && FALLBACK_WEIGHT[type],
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: { fontFamily: FontFamily.body, fontSize: 16, lineHeight: 24 },
  hero: { fontFamily: FontFamily.display, fontSize: 34, lineHeight: 40 },
  title: { fontFamily: FontFamily.display, fontSize: 30, lineHeight: 36 },
  header: { fontFamily: FontFamily.display, fontSize: 20, lineHeight: 26 },
  subtitle: { fontFamily: FontFamily.display, fontSize: 22, lineHeight: 28 },
  small: { fontFamily: FontFamily.body, fontSize: 14, lineHeight: 20 },
  smallBold: { fontFamily: FontFamily.bodyHeavy, fontSize: 14, lineHeight: 20 },
  label: { fontFamily: FontFamily.bodyHeavy, fontSize: 14, lineHeight: 20 },
  section: { fontFamily: FontFamily.bodyHeavy, fontSize: 13, lineHeight: 16, letterSpacing: 0.8, textTransform: 'uppercase' },
  caption: { fontFamily: FontFamily.body, fontSize: 12, lineHeight: 17 },
  link: { fontFamily: FontFamily.bodyHeavy, fontSize: 16, lineHeight: 24 },
  linkPrimary: { fontFamily: FontFamily.bodyHeavy, fontSize: 14, lineHeight: 20 },
  code: { fontFamily: Fonts.mono, fontSize: 12 },
});
