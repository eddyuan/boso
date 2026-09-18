import { type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ButtonEdge, ControlHeight, FontFamily, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ButtonVariant = 'primary' | 'secondary' | 'apple' | 'danger';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  /** Shorter button for headers and inline actions (design: 44px tall). */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

// Chunky button with a solid bottom edge that "presses in" on tap.
export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  compact,
  style,
  accessibilityLabel,
}: Props) {
  const theme = useTheme();

  const palette = {
    primary: { bg: theme.primary, fg: theme.onPrimary, edge: theme.primaryPress, border: 'transparent' },
    secondary: { bg: theme.surface, fg: theme.text, edge: theme.line, border: theme.line },
    apple: { bg: theme.text, fg: theme.background, edge: '#00000040', border: 'transparent' },
    danger: { bg: theme.surface, fg: theme.red, edge: theme.line, border: theme.line },
  }[variant];
  const edge = variant === 'primary' ? ButtonEdge.primary : ButtonEdge.secondary;
  const inactive = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      style={style}>
      {({ pressed }) => {
        const flat = disabled || pressed;
        return (
          <View
            style={[
              styles.base,
              compact && styles.compact,
              disabled
                ? { backgroundColor: theme.backgroundElement, borderColor: 'transparent' }
                : {
                    backgroundColor: palette.bg,
                    borderColor: palette.border,
                    borderWidth: 0,
                    // Solid edge (not a blurred shadow) for the playful chunky look.
                    boxShadow: flat ? undefined : `0px ${edge}px 0px ${palette.edge}`,
                  },
              { transform: [{ translateY: pressed && !disabled ? edge : 0 }], marginBottom: edge },
            ]}>
            {loading ? (
              <ActivityIndicator color={palette.fg} />
            ) : (
              <>
                {icon}
                <ThemedText
                  style={[styles.label, compact && styles.labelCompact, { color: disabled ? theme.textSecondary : palette.fg }]}>
                  {label}
                </ThemedText>
              </>
            )}
          </View>
        );
      }}
    </Pressable>
  );
}

// Square icon-only secondary button (e.g. shuffle).
export function IconButton({
  children,
  onPress,
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel: string;
}) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
      {({ pressed }) => (
        <View
          style={[
            styles.iconButton,
            {
              backgroundColor: theme.backgroundElement,
              borderColor: 'transparent',
              boxShadow: pressed ? undefined : `0px ${ButtonEdge.secondary}px 0px ${theme.line}`,
              transform: [{ translateY: pressed ? ButtonEdge.secondary : 0 }],
            },
          ]}>
          {children}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: ControlHeight,
    borderRadius: Radius.button,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20,
  },
  compact: { height: 44, paddingHorizontal: 20 },
  label: { fontFamily: FontFamily.display, fontSize: 18, lineHeight: 24 },
  labelCompact: { fontSize: 16 },
  iconButton: {
    width: ControlHeight,
    height: ControlHeight,
    borderRadius: Radius.button,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: ButtonEdge.secondary,
  },
});
