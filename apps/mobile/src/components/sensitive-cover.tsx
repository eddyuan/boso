import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The tap-to-reveal interstitial over a post the classifier marked `sensitive`.
 *
 * It sits on top of already-blurred media rather than replacing it, so the
 * layout doesn't jump when someone reveals — and it names the category, because
 * "sensitive" alone doesn't tell anyone whether they want to look.
 */
export function SensitiveCover({
  categories,
  onReveal,
}: {
  categories: string[];
  onReveal: () => void;
}) {
  const theme = useTheme();
  const label = categories.length > 0 ? categories.join(' · ') : 'Sensitive content';

  return (
    <Pressable
      onPress={onReveal}
      accessibilityRole="button"
      accessibilityLabel={`Show ${label.toLowerCase()}`}
      accessibilityHint="Reveals media that may be sensitive"
      style={[StyleSheet.absoluteFill, styles.cover, { borderRadius: Radius.field }]}>
      <View style={[styles.pill, { backgroundColor: theme.surface }]}>
        <Icon name="eye" size={16} color={theme.textSecondary} />
        <ThemedText type="smallBold" style={styles.label}>
          {label}
        </ThemedText>
      </View>
      <ThemedText themeColor="textSecondary" style={styles.hint}>
        Tap to view
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cover: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: 'rgba(43,31,22,0.35)',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
  },
  label: { fontSize: 13 },
  hint: { fontSize: 12 },
});
