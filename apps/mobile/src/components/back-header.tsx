import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/lib/i18n';

/**
 * The back arrow and title every pushed screen wears.
 *
 * Six screens had their own identical copy of this, which is six places to
 * translate the word "Back" and six chances to miss one. The title stays a prop
 * rather than a key because several are composed from data — "Bond with Mochi",
 * "Miso & Pepper".
 */
export function BackHeader({ title, trailing }: { title: string; trailing?: ReactNode }) {
  const theme = useTheme();
  const { t } = useT();

  return (
    <View style={styles.top}>
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel={t('action.back')}
        style={({ pressed }) => [
          styles.back,
          { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.7 : 1 },
        ]}>
        <Icon name="back" />
      </Pressable>
      <ThemedText type="subtitle" style={{ flex: 1 }} numberOfLines={1}>
        {title}
      </ThemedText>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  back: { width: 44, height: 44, borderRadius: Radius.icon, alignItems: 'center', justifyContent: 'center' },
});
