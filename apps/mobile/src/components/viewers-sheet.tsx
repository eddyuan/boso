import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ModalSheet } from '@/components/modal-sheet';
import { CompanionArt } from '@/components/mascot/companions';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/lib/i18n';
import { apiFetch } from '@/lib/api';

type Viewer = {
  petId: string;
  petName: string;
  species: string;
  ownerName: string | null;
  ownerImage: string | null;
  viewedAt: string;
};

/**
 * Who sniffed around your post.
 *
 * Only ever shown to the author — the endpoint enforces that too. It's a
 * curiosity about your own post rather than a public read receipt, which is why
 * there's no equivalent view of "posts you looked at".
 */
export function ViewersSheet({
  postId,
  open,
  onClose,
}: {
  postId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const theme = useTheme();
  const { t, n, timeAgo } = useT();
  const [viewers, setViewers] = useState<Viewer[] | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!open || !postId) return;
    setViewers(null);
    apiFetch<{ viewers: Viewer[]; total: number }>(`/api/posts/${postId}/viewers`)
      .then((r) => {
        setViewers(r.viewers);
        setTotal(r.total);
      })
      .catch(() => setViewers([]));
  }, [open, postId]);

  return (
    <ModalSheet
      open={open}
      onClose={onClose}
      scrollable
      title={
        <View style={{ gap: 2 }}>
          <ThemedText type="label">{t('viewers.title')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {viewers === null
              ? t('viewers.looking')
              : total === 0
                ? t('viewers.none')
                : total > viewers.length
                  ? t('viewers.showingLast', { count: total, shown: viewers.length })
                  : n('viewers.count', total)}
          </ThemedText>
        </View>
      }>
      {viewers === null ? (
        <ActivityIndicator color={theme.primaryPress} />
      ) : (
        viewers.map((v) => (
          <View key={`${v.petId}-${v.viewedAt}`} style={styles.row}>
            {v.ownerImage ? (
              <Image source={{ uri: v.ownerImage }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: theme.primarySoft }]}>
                <CompanionArt species={v.species} size={26} />
              </View>
            )}
            <View style={styles.rowText}>
              <ThemedText type="smallBold" numberOfLines={1}>
                {v.ownerName?.trim() || v.petName}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {`${t('viewers.camePast', { name: v.petName })} · ${timeAgo(v.viewedAt)}`}
              </ThemedText>
            </View>
          </View>
        ))
      )}
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  rowText: { flex: 1, minWidth: 0, gap: 1 },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
