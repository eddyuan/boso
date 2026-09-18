import { StyleSheet, Text, type TextProps } from 'react-native';

import { FontFamily, Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

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

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const defaultColor =
    type === 'link' || type === 'linkPrimary'
      ? theme.primaryInk
      : type === 'section' || type === 'caption'
        ? theme.textSecondary
        : theme.text;

  return <Text style={[{ color: themeColor ? theme[themeColor] : defaultColor }, styles[type], style]} {...rest} />;
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
