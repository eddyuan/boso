import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, Pressable, StyleSheet, useColorScheme, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/controls';
import { Icon } from '@/components/ui/icon';
import { ControlHeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatBirthday, type BirthdayPickerProps } from '@/lib/birthday';

function SelectedDate({ value }: { value: Date | null }) {
  const theme = useTheme();
  return (
    <View style={styles.selected}>
      <Icon name="calendar" size={18} color={value ? theme.primaryInk : theme.textSecondary} />
      <ThemedText type="label" style={{ color: value ? theme.primaryInk : theme.textSecondary }}>
        {value ? formatBirthday(value) : 'Scroll to select your birthday'}
      </ThemedText>
    </View>
  );
}

// iOS: inline spinner wheels. Android: the system date dialog.
// `initialDate` only positions the picker; `value` stays null until the user
// actually picks, so nobody "accepts" a default date by accident.
export function BirthdayPicker({ value, onChange, initialDate, minimumDate, maximumDate }: BirthdayPickerProps) {
  const theme = useTheme();
  const colorScheme = useColorScheme();

  if (Platform.OS === 'ios') {
    return (
      <View style={styles.wrap}>
        <Card style={styles.card}>
          <DateTimePicker
            mode="date"
            display="spinner"
            value={value ?? initialDate}
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            themeVariant={colorScheme === 'dark' ? 'dark' : 'light'}
            textColor={theme.text}
            onChange={(event, date) => {
              if (event.type === 'set' && date) onChange(date);
            }}
          />
        </Card>
        <SelectedDate value={value} />
      </View>
    );
  }

  function openAndroidDialog() {
    DateTimePickerAndroid.open({
      mode: 'date',
      value: value ?? initialDate,
      minimumDate,
      maximumDate,
      onChange: (event, date) => {
        if (event.type === 'set' && date) onChange(date);
      },
    });
  }

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={openAndroidDialog}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.field,
          { backgroundColor: theme.surface, borderColor: value ? theme.primaryPress : theme.line, opacity: pressed ? 0.8 : 1 },
        ]}>
        <Icon name="calendar" size={20} color={value ? theme.primaryInk : theme.textSecondary} />
        <ThemedText style={{ color: value ? theme.text : theme.textSecondary }}>
          {value ? formatBirthday(value) : 'Select your birthday'}
        </ThemedText>
      </Pressable>
      <ThemedText type="small" themeColor="textSecondary">
        Tip: tap the year at the top of the calendar to jump to your birth year.
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.lg },
  card: { paddingVertical: Spacing.sm },
  selected: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  field: {
    minHeight: ControlHeight,
    borderRadius: Radius.field,
    borderWidth: 2,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
});
