import { LOCALES, type Locale } from '@bsocial/shared';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ModalSheet } from '@/components/modal-sheet';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { apiFetch } from '@/lib/api';
import { refreshSession } from '@/lib/auth-client';
import { useT } from '@/lib/i18n';

/**
 * Picking a language, including the option not to.
 *
 * "Match my device" is a real choice rather than a way of saying English: it
 * stores `null`, so somebody who picks it keeps following their phone — when they
 * change its language, and when we add a language they speak. Choosing a specific
 * one pins it, which is what somebody reading in their second language on a phone
 * set to their first actually wants.
 *
 * Each language is listed in itself, not in yours. Somebody looking for their
 * language is looking for the word they'd recognise.
 */
export function LanguageSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const theme = useTheme();
  const { t, locale, chosen } = useT();
  const [saving, setSaving] = useState(false);

  async function choose(next: Locale | null) {
    setSaving(true);
    try {
      await apiFetch('/api/me/account', { method: 'PATCH', body: JSON.stringify({ locale: next }) });
      // `refreshSession()`, not `getSession()`. The latter fetches and returns the
      // session but never touches the atom `useSession` reads from — better-auth
      // only refills that atom for a fixed list of paths (`/update-user`,
      // `/sign-in/email`…) and `/get-session` isn't one of them. So the PATCH
      // landed, the column changed, and the app carried on in the old language.
      // Notifying `$sessionSignal` is what actually triggers the refetch.
      refreshSession();
      onClose();
    } catch {
      // Left open on failure: the row the person tapped is still unselected,
      // which says more than an error would.
    }
    setSaving(false);
  }

  const rows: { key: string; label: string; selected: boolean; onPress: () => void }[] = [
    {
      key: 'system',
      label: t('profile.languageSystem'),
      selected: !chosen,
      onPress: () => choose(null),
    },
    ...LOCALES.map((l) => ({
      key: l.code,
      label: l.endonym,
      selected: chosen && locale === l.code,
      onPress: () => choose(l.code),
    })),
  ];

  return (
    <ModalSheet open={open} onClose={onClose} title={t('profile.language')}>
      {rows.map((row) => (
        <Pressable
          key={row.key}
          onPress={row.onPress}
          disabled={saving}
          accessibilityRole="button"
          accessibilityState={{ selected: row.selected }}
          style={({ pressed }) => [styles.row, { opacity: pressed || saving ? 0.7 : 1 }]}>
          <ThemedText style={{ flex: 1 }}>{row.label}</ThemedText>
          {row.selected && <Icon name="check" size={18} color={theme.primaryInk} strokeWidth={3} />}
        </Pressable>
      ))}
      <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
        {t('profile.languageNote')}
      </ThemedText>
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
  note: { paddingTop: Spacing.sm },
});
