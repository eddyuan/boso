import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { CompanionArt } from '@/components/mascot/companions';
import { ThemedText } from '@/components/themed-text';
import { Badge, Card } from '@/components/ui/controls';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type WhiskersSource = {
  id: string;
  content: string;
  authoredByAgent: boolean;
  petName: string;
  species: string;
  ownerName: string | null;
};

export type Whiskers = { line: string; sourcePostIds: string[]; sources: WhiskersSource[] };

/**
 * Today's whisper, and the posts behind it.
 *
 * A rumour you can't check is something the app made up, so every source is here
 * and each one opens its thread. That's the whole reason the line is tappable
 * rather than decoration.
 */
export function WhiskersSheet({
  whiskers,
  petName,
  open,
  onClose,
}: {
  whiskers: Whiskers | null;
  petName: string;
  open: boolean;
  onClose: () => void;
}) {
  const theme = useTheme();

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      header={
        <View style={{ gap: 2 }}>
          <View style={styles.titleRow}>
            <ThemedText type="label" style={{ flex: 1 }}>
              Whiskers
            </ThemedText>
            <Badge label="One a day" />
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            What {petName} picked up nearby
          </ThemedText>
        </View>
      }>
      {whiskers && (
        <>
          <Card style={[styles.line, { backgroundColor: theme.primarySoft }]}>
            <ThemedText style={styles.lineText}>{whiskers.line}</ThemedText>
          </Card>

          {whiskers.sources.length > 0 && (
            <>
              <ThemedText type="label" style={styles.section}>
                {petName} heard it from
              </ThemedText>
              {whiskers.sources.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => {
                    onClose();
                    router.push(`/post/${s.id}`);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Open the post from ${s.ownerName ?? s.petName}`}>
                  <View style={[styles.source, { backgroundColor: theme.backgroundElement }]}>
                    <View style={[styles.art, { backgroundColor: theme.primarySoft }]}>
                      <CompanionArt species={s.species} size={24} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <ThemedText type="smallBold" numberOfLines={1}>
                        {s.authoredByAgent ? s.petName : s.ownerName?.trim() || s.petName}
                      </ThemedText>
                      <ThemedText type="caption" themeColor="textSecondary" numberOfLines={2}>
                        &ldquo;{s.content}&rdquo;
                      </ThemedText>
                    </View>
                    <Icon name="chevron" size={18} color={theme.textSecondary} />
                  </View>
                </Pressable>
              ))}
            </>
          )}

          {/* Cached posts can be deleted afterwards; the line stays true about
              what was said at the time, so a short list isn't an error. */}
          {whiskers.sources.length < whiskers.sourcePostIds.length && (
            <ThemedText type="caption" themeColor="textSecondary" style={styles.note}>
              {whiskers.sourcePostIds.length - whiskers.sources.length} of the posts behind this have since
              been removed.
            </ThemedText>
          )}

          <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
            Written once each morning and kept for the day — it&apos;s the same news all day, and it needs
            at least three posts nearby before there&apos;s a pattern worth repeating.
          </ThemedText>
        </>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  line: { padding: Spacing.lg },
  lineText: { fontSize: 16, lineHeight: 24 },
  section: { paddingTop: Spacing.xs },
  source: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.field,
  },
  art: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  note: { paddingTop: Spacing.xs },
});
