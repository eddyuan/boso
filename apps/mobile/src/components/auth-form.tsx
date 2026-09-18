import { type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, ScreenPadding, Spacing, TabBar } from '@/constants/theme';

export { Field } from '@/components/ui/field';
export { ErrorText } from '@/components/ui/controls';

/**
 * Standard full-screen layout: optional header row, scrollable content, and a
 * footer pinned to the bottom (primary action within thumb reach).
 */
export function Screen({
  header,
  children,
  footer,
  centered = false,
  underTabBar = false,
}: {
  header?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  centered?: boolean;
  /** Set on tab screens: the floating bar sits over the content, so the last row needs room. */
  underTabBar?: boolean;
}) {
  return (
    <ThemedView style={styles.fill}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {header && <View style={styles.header}>{header}</View>}
          <ScrollView
            contentContainerStyle={[
              styles.content,
              centered && styles.centered,
              underTabBar && { paddingBottom: TabBar.contentInset },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer && <View style={styles.footer}>{footer}</View>}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

// Title + optional subtitle block used at the top of most screens.
export function TitleBlock({ title, subtitle, align = 'left' }: { title: string; subtitle?: string; align?: 'left' | 'center' }) {
  return (
    <View style={{ gap: Spacing.sm, alignItems: align === 'center' ? 'center' : 'stretch' }}>
      <ThemedText type="title" style={{ textAlign: align }}>
        {title}
      </ThemedText>
      {subtitle && (
        <ThemedText themeColor="textSecondary" style={{ textAlign: align }}>
          {subtitle}
        </ThemedText>
      )}
    </View>
  );
}

export function AuthScreen({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Screen footer={footer}>
      <TitleBlock title={title} subtitle={subtitle} />
      <View style={styles.body}>{children}</View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  safe: { flex: 1, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  header: { paddingHorizontal: ScreenPadding.horizontal, paddingTop: Spacing.lg },
  content: { flexGrow: 1, paddingHorizontal: ScreenPadding.horizontal, paddingTop: ScreenPadding.top, paddingBottom: Spacing.lg, gap: Spacing.xl },
  centered: { justifyContent: 'center' },
  body: { marginTop: Spacing.lg, gap: Spacing.lg },
  footer: { paddingHorizontal: ScreenPadding.horizontal, paddingBottom: Spacing.lg, paddingTop: Spacing.sm, gap: Spacing.xs },
});
