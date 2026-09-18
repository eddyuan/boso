import { StyleSheet, View } from 'react-native';

import { Mascot, type MascotMood } from '@/components/mascot/mascot';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

// Friendly placeholder for screens with nothing to show yet.
export function EmptyState({
  mood = 'shy',
  title,
  message,
}: {
  mood?: MascotMood;
  title: string;
  message: string;
}) {
  return (
    <View style={styles.wrap}>
      <Mascot mood={mood} size={120} />
      <ThemedText type="header" style={styles.center}>
        {title}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={[styles.center, styles.message]}>
        {message}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xxl },
  center: { textAlign: 'center' },
  message: { maxWidth: 300 },
});
