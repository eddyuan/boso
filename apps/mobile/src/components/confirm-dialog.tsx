import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/lib/i18n';

export type ConfirmRequest = {
  title: string;
  message?: string;
  /** The label on the affirmative button. Defaults to "Confirm". */
  action?: string;
  /** Renders the affirmative button as destructive. */
  destructive?: boolean;
};

const ConfirmContext = createContext<((request: ConfirmRequest) => Promise<boolean>) | null>(null);

/**
 * One themed confirmation dialog, asked for imperatively.
 *
 * This replaced four copies of the same `Platform.OS === 'web' ? window.confirm(…)
 * : Alert.alert(…)` helper. Both halves of that were wrong for us: `window.confirm`
 * is a browser chrome box that ignores the app's typography and can't render a
 * destructive action differently, and `Alert.alert` is the OS's own dialog, which
 * on Android can't be styled at all. A confirmation is often the last thing
 * somebody sees before losing data, so it's worth it looking like the app that's
 * about to do it.
 *
 * The API is a promise rather than a callback because that's how the call sites
 * already read — `if (await confirm({…})) doTheThing()` is the shape they wanted
 * and had to write around.
 *
 * A dialog, not a sheet: centred, small, and dismissed by answering. The sheets are
 * routes because back should close them; a confirmation isn't a place you navigate
 * to, and back cancelling it is the safe default rather than a gap.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const { t } = useT();
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback((next: ConfirmRequest) => {
    setRequest(next);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = useCallback((ok: boolean) => {
    setRequest(null);
    resolver.current?.(ok);
    resolver.current = null;
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {request && (
        <Modal visible transparent animationType="none" onRequestClose={() => settle(false)} statusBarTranslucent>
          <Animated.View entering={FadeIn.duration(140)} exiting={FadeOut.duration(120)} style={styles.backdrop}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => settle(false)}
              accessibilityRole="button"
              accessibilityLabel={t('dialog.cancel')}
            />
            <Animated.View
              entering={ZoomIn.duration(160).springify().damping(18)}
              style={[styles.dialog, { backgroundColor: theme.background }]}
              accessibilityViewIsModal
              accessibilityRole="alert">
              <ThemedText type="header">{request.title}</ThemedText>
              {request.message ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {request.message}
                </ThemedText>
              ) : null}
              <View style={styles.actions}>
                <Button
                  variant="secondary"
                  label={t('dialog.cancel')}
                  onPress={() => settle(false)}
                  style={{ flex: 1 }}
                />
                <Button
                  variant={request.destructive ? 'danger' : 'primary'}
                  label={request.action ?? t('dialog.confirmAction')}
                  onPress={() => settle(true)}
                  style={{ flex: 1 }}
                />
              </View>
            </Animated.View>
          </Animated.View>
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
}

/**
 * `const ok = await confirm({ title, message, action, destructive })`.
 *
 * Resolves `false` on cancel, on a backdrop tap and on Android back — every way
 * out that isn't the affirmative button means no.
 */
export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return confirm;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(43,31,22,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  // `background`, not `surface`: the secondary and danger button variants are both
  // surface-coloured, so on a surface card they'd read as the same button with
  // differently coloured text — on a confirmation, of all places. Buttons sit on
  // `background` everywhere else in the app for the same reason.
  dialog: {
    width: '100%',
    maxWidth: 380,
    borderRadius: Radius.card,
    padding: Spacing.lg,
    gap: Spacing.md,
    boxShadow: '0px 12px 32px rgba(43,31,22,0.22)',
  },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
});
