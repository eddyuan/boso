import { useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FontFamily } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// Six separate boxes over one hidden input, so paste and OS one-time-code
// autofill keep working.
export function CodeInput({
  value,
  onChange,
  length = 6,
  autoFocus = true,
}: {
  value: string;
  onChange: (code: string) => void;
  length?: number;
  autoFocus?: boolean;
}) {
  const theme = useTheme();
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  return (
    <Pressable onPress={() => inputRef.current?.focus()} accessibilityLabel="Verification code">
      <View style={styles.row}>
        {Array.from({ length }, (_, i) => {
          const active = focused && i === Math.min(value.length, length - 1);
          return (
            <View
              key={i}
              style={[
                styles.box,
                {
                  backgroundColor: active ? theme.surface : theme.backgroundElement,
                  borderColor: active ? theme.primaryPress : 'transparent',
                  boxShadow: active ? `0px 0px 0px 4px ${theme.primarySoft}` : undefined,
                },
              ]}>
              <ThemedText style={styles.digit}>{value[i] ?? ''}</ThemedText>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, length))}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={length}
        autoFocus={autoFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        caretHidden
        style={styles.hidden}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  box: { flex: 1, maxWidth: 52, height: 60, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  digit: { fontFamily: FontFamily.display, fontSize: 26, lineHeight: 32 },
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0 },
});
