import { parseBirthday } from '@bsocial/shared';
import { useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Field } from '@/components/auth-form';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { formatBirthday, type BirthdayPickerProps } from '@/lib/birthday';

// Web has no native wheel picker; typed fields work everywhere.
export function BirthdayPicker({ value, onChange }: BirthdayPickerProps) {
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const [year, setYear] = useState('');
  const dayRef = useRef<TextInput>(null);
  const yearRef = useRef<TextInput>(null);

  function update(m: string, d: string, y: string) {
    const parsed =
      y.length === 4 ? parseBirthday(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`) : null;
    // Picker contract uses local dates (like the native pickers).
    onChange(parsed ? new Date(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()) : null);
  }

  const digits = (v: string, n: number) => v.replace(/\D/g, '').slice(0, n);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.part}>
          <ThemedText type="small" themeColor="textSecondary">
            Month
          </ThemedText>
          <Field
            placeholder="MM"
            value={month}
            maxLength={2}
            keyboardType="number-pad"
            autoComplete="birthdate-month"
            onChangeText={(v) => {
              const m = digits(v, 2);
              setMonth(m);
              update(m, day, year);
              if (m.length === 2) dayRef.current?.focus();
            }}
          />
        </View>
        <View style={styles.part}>
          <ThemedText type="small" themeColor="textSecondary">
            Day
          </ThemedText>
          <Field
            ref={dayRef}
            placeholder="DD"
            value={day}
            maxLength={2}
            keyboardType="number-pad"
            autoComplete="birthdate-day"
            onChangeText={(v) => {
              const d = digits(v, 2);
              setDay(d);
              update(month, d, year);
              if (d.length === 2) yearRef.current?.focus();
            }}
          />
        </View>
        <View style={[styles.part, styles.year]}>
          <ThemedText type="small" themeColor="textSecondary">
            Year
          </ThemedText>
          <Field
            ref={yearRef}
            placeholder="YYYY"
            value={year}
            maxLength={4}
            keyboardType="number-pad"
            autoComplete="birthdate-year"
            onChangeText={(v) => {
              const y = digits(v, 4);
              setYear(y);
              update(month, day, y);
            }}
          />
        </View>
      </View>
      {value && (
        <ThemedText type="small" themeColor="textSecondary">
          {formatBirthday(value)}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm },
  row: { flexDirection: 'row', gap: Spacing.sm },
  part: { flex: 1, gap: Spacing.xs },
  year: { flex: 1.5 },
});
