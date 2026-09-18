import { useState, type ReactNode, type Ref } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { ControlHeight, FontFamily, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = TextInputProps & {
  ref?: Ref<TextInput>;
  leading?: ReactNode;
  trailing?: ReactNode;
  error?: boolean;
};

// Text input with focus ring and optional leading/trailing adornments.
export function Field({ ref, leading, trailing, error, multiline, style, onFocus, onBlur, ...props }: Props) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  // Filled input; the outline appears only when focused or wrong.
  const borderColor = error ? theme.red : focused ? theme.primaryPress : 'transparent';

  return (
    <View
      style={[
        styles.box,
        multiline && styles.multiline,
        {
          backgroundColor: focused ? theme.surface : theme.backgroundElement,
          borderColor,
          boxShadow: focused && !error ? `0px 0px 0px 4px ${theme.primarySoft}` : undefined,
        },
      ]}>
      {leading}
      <TextInput
        ref={ref}
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor={theme.textSecondary}
        multiline={multiline}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        {...props}
        style={[styles.input, { color: theme.text }, multiline && styles.inputMultiline, style]}
      />
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    minHeight: ControlHeight,
    borderRadius: Radius.field,
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 10,
  },
  multiline: { alignItems: 'flex-start', paddingVertical: 12 },
  input: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: 17,
    paddingVertical: 12,
    // Remove the web focus outline; the box shows focus instead.
    outlineStyle: 'none' as never,
  },
  inputMultiline: { minHeight: 72, textAlignVertical: 'top', paddingVertical: 0 },
});
