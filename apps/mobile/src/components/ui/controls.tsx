import { type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Elevation, FontFamily, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// ---------------------------------------------------------------------------
// Chips
// ---------------------------------------------------------------------------

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      style={({ pressed }) => [
        styles.chip,
        {
          // Selection reads from the fill, not an outline.
          backgroundColor: selected ? theme.primarySoft : theme.backgroundElement,
          opacity: pressed ? 0.75 : 1,
        },
      ]}>
      <ThemedText style={[styles.chipText, { color: selected ? theme.primaryInk : theme.text }]}>{label}</ThemedText>
    </Pressable>
  );
}

export function ChipGroup({ children, gap = 10 }: { children: ReactNode; gap?: number }) {
  return <View style={[styles.chipGroup, { gap }]}>{children}</View>;
}

// ---------------------------------------------------------------------------
// Option card (single choice)
// ---------------------------------------------------------------------------

export function OptionCard({
  title,
  description,
  selected,
  onPress,
  leading,
  trailing,
}: {
  title: string;
  description?: string;
  selected?: boolean;
  onPress: () => void;
  leading?: ReactNode;
  trailing?: ReactNode;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={selected === undefined ? 'button' : 'radio'}
      accessibilityState={selected === undefined ? undefined : { selected }}
      style={({ pressed }) => [
        styles.option,
        {
          backgroundColor: selected ? theme.primarySoft : theme.backgroundElement,
          // The one border we keep: it marks the chosen option.
          borderColor: selected ? theme.primaryPress : 'transparent',
          opacity: pressed ? 0.85 : 1,
        },
      ]}>
      {leading ??
        (selected !== undefined && (
          <View
            style={[
              styles.radio,
              selected ? { borderWidth: 7, borderColor: theme.primaryPress } : { borderColor: theme.line },
            ]}
          />
        ))}
      <View style={styles.optionText}>
        <ThemedText type="label" style={{ fontSize: 16 }}>
          {title}
        </ThemedText>
        {description && <ThemedText type="small" themeColor="textSecondary">{description}</ThemedText>}
      </View>
      {trailing}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Segmented control
// ---------------------------------------------------------------------------

/** Filled track with the active segment raised on a surface pill. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.segTrack, { backgroundColor: theme.backgroundElement }]}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [
              styles.segItem,
              active && [{ backgroundColor: theme.surface }, Elevation.card],
              pressed && !active && { opacity: 0.6 },
            ]}>
            <ThemedText style={[styles.segLabel, { color: active ? theme.text : theme.textSecondary }]}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Round icon button used in screen headers. */
export function RoundButton({
  icon,
  onPress,
  tone = 'muted',
  accessibilityLabel,
}: {
  icon: ReactNode;
  onPress: () => void;
  tone?: 'muted' | 'brand';
  accessibilityLabel: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.round,
        { backgroundColor: tone === 'brand' ? theme.primary : theme.backgroundElement },
        tone === 'brand' && { boxShadow: `0px 3px 0px ${theme.primaryPress}` },
        pressed && { opacity: 0.8, transform: [{ translateY: tone === 'brand' ? 3 : 0 }] },
      ]}>
      {icon}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------

export function Badge({
  label,
  tone = 'muted',
  icon,
}: {
  label: string;
  tone?: 'muted' | 'brand' | 'success';
  icon?: ReactNode;
}) {
  const theme = useTheme();
  const colors = {
    muted: { bg: theme.backgroundElement, fg: theme.textSecondary },
    brand: { bg: theme.primarySoft, fg: theme.primaryInk },
    success: { bg: theme.greenSoft, fg: theme.green },
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      {icon}
      <ThemedText style={[styles.badgeText, { color: colors.fg }]}>{label}</ThemedText>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Cards, rows, icon tiles
// ---------------------------------------------------------------------------

/** A plain surface. No outline — the fill and a whisper of elevation carry it. */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return <View style={[styles.card, { backgroundColor: theme.surface }, Elevation.card, style]}>{children}</View>;
}

export function Divider() {
  const theme = useTheme();
  return <View style={[styles.divider, { backgroundColor: theme.line }]} />;
}

export function IconTile({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'brand' }) {
  const theme = useTheme();
  return (
    <View
      style={[styles.iconTile, { backgroundColor: tone === 'brand' ? theme.primarySoft : theme.backgroundElement }]}>
      {children}
    </View>
  );
}

export function ListRow({
  icon,
  title,
  subtitle,
  trailing,
  onPress,
}: {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  onPress?: () => void;
}) {
  const content = (
    <View style={styles.row}>
      {icon}
      <View style={styles.rowText}>
        <ThemedText type="label">{title}</ThemedText>
        {subtitle && (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {subtitle}
          </ThemedText>
        )}
      </View>
      {trailing}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      {content}
    </Pressable>
  );
}

export function RowAction({ label, onPress, tone = 'brand' }: { label: string; onPress: () => void; tone?: 'brand' | 'danger' }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={10}>
      <ThemedText type="linkPrimary" style={{ fontSize: 15, color: tone === 'danger' ? theme.red : theme.primaryInk }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

export function SectionTitle({ children }: { children: string }) {
  return (
    <ThemedText type="section" style={{ paddingHorizontal: 4 }}>
      {children}
    </ThemedText>
  );
}

// ---------------------------------------------------------------------------
// Progress + back button (onboarding header)
// ---------------------------------------------------------------------------

export function ProgressBar({ value }: { value: number }) {
  const theme = useTheme();
  return (
    <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
      <View style={[styles.fill, { backgroundColor: theme.primaryPress, width: `${Math.round(value * 100)}%` }]} />
    </View>
  );
}

export function BackButton({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Back"
      style={({ pressed }) => [
        styles.back,
        { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.7 : 1 },
      ]}>
      <Icon name="back" />
    </Pressable>
  );
}

export function ErrorText({ message }: { message: string | null | undefined }) {
  const theme = useTheme();
  if (!message) return null;
  return (
    <ThemedText type="smallBold" style={{ color: theme.red }}>
      {message}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  chipGroup: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { height: 42, borderRadius: Radius.pill, paddingHorizontal: 14, justifyContent: 'center' },
  chipText: { fontFamily: FontFamily.bodyBold, fontSize: 15, lineHeight: 20 },
  option: { borderRadius: 18, borderWidth: 2, padding: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: 14 },
  optionText: { flex: 1, gap: 2 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2 },
  segTrack: { flexDirection: 'row', gap: Spacing.xs, padding: Spacing.xs, borderRadius: Radius.pill },
  segItem: { flex: 1, height: 36, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  segLabel: { fontFamily: FontFamily.bodyHeavy, fontSize: 14, lineHeight: 18 },
  round: { width: 44, height: 44, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 24, paddingHorizontal: 10, borderRadius: Radius.pill, alignSelf: 'flex-start' },
  badgeText: { fontFamily: FontFamily.bodyHeavy, fontSize: 12, lineHeight: 16 },
  card: { borderRadius: Radius.card, overflow: 'hidden' },
  divider: { height: 1, marginHorizontal: Spacing.lg },
  iconTile: { width: 44, height: 44, borderRadius: Radius.icon, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: Spacing.lg, paddingVertical: 14 },
  rowText: { flex: 1, minWidth: 0, gap: 1 },
  track: { flex: 1, height: 12, borderRadius: Radius.pill, overflow: 'hidden' },
  fill: { height: 12, borderRadius: Radius.pill },
  back: { width: 44, height: 44, borderRadius: Radius.icon, alignItems: 'center', justifyContent: 'center' },
});
