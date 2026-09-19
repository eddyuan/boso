import { categoryLabel, shouldBlur, type ModerationStatus } from '@bsocial/shared';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { Button } from '@/components/ui/button';
import { CompanionArt } from '@/components/mascot/companions';
import { MediaGallery, type PostMedia } from '@/components/media-gallery';
import { SensitiveCover } from '@/components/sensitive-cover';
import { ThemedText } from '@/components/themed-text';
import { Badge } from '@/components/ui/controls';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { apiFetch } from '@/lib/api';
import { timeAgo } from '@/lib/time';

type ThreadPost = {
  id: string;
  content: string;
  media: PostMedia[];
  createdAt: string;
  authoredByAgent: boolean;
  moderationStatus: ModerationStatus;
  sensitiveCategories: string[];
  petName: string;
  species: string;
  ownerName: string | null;
};

type Thread = {
  place: { id: string; name: string; address: string | null; isHotspot: boolean };
  windowHours: number;
  posts: ThreadPost[];
  showSensitiveContent: boolean;
};

/**
 * What's being said at one place right now.
 *
 * A window, not an archive — the server only returns the last couple of days,
 * because a park's thread is interesting for being current. Kept forever it
 * would open on a year-old post and read as abandoned.
 */
export function PlaceThread({
  placeId,
  open,
  onClose,
}: {
  placeId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const theme = useTheme();
  const [thread, setThread] = useState<Thread | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open || !placeId) return;
    setThread(null);
    setRevealed(new Set());
    apiFetch<Thread>(`/api/places/${placeId}/posts`)
      .then(setThread)
      .catch(() => setThread(null));
  }, [open, placeId]);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      contentKey={placeId ?? undefined}
      header={
        <View style={{ gap: 2 }}>
          <View style={styles.titleRow}>
            <ThemedText type="label" numberOfLines={1} style={{ flexShrink: 1 }}>
              {thread?.place.name ?? 'Here'}
            </ThemedText>
            {thread?.place.isHotspot && <Badge tone="brand" label="Gathering spot" />}
          </View>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {thread === null
              ? 'Looking…'
              : thread.posts.length === 0
                ? 'Nothing said here in the last couple of days.'
                : `${thread.posts.length} in the last ${thread.windowHours} hours`}
          </ThemedText>
        </View>
      }>
      {thread === null ? (
        <ActivityIndicator color={theme.primaryPress} />
      ) : thread.posts.length === 0 ? (
        /* The point of showing a quiet venue at all: it's an invitation, not a
           dead end. The place comes along so compose opens already attached. */
        <Button
          label={`Be the first to post at ${thread.place.name}`}
          onPress={() => {
            onClose();
            router.push({
              pathname: '/compose',
              params: { placeId: thread.place.id, placeName: thread.place.name },
            });
          }}
        />
      ) : (
        thread.posts.map((post) => {
          const covered =
            shouldBlur(post.moderationStatus, thread.showSensitiveContent) && !revealed.has(post.id);
          return (
            <View key={post.id} style={[styles.post, { backgroundColor: theme.backgroundElement }]}>
              <View style={styles.head}>
                <View style={[styles.art, { backgroundColor: theme.primarySoft }]}>
                  <CompanionArt species={post.species} size={26} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <ThemedText type="smallBold" numberOfLines={1}>
                    {post.authoredByAgent ? post.petName : post.ownerName?.trim() || post.petName}
                  </ThemedText>
                  <ThemedText type="caption" themeColor="textSecondary">
                    {timeAgo(post.createdAt)}
                  </ThemedText>
                </View>
              </View>
              <ThemedText type="small">{post.content}</ThemedText>
              {post.media.length > 0 && (
                <View>
                  <MediaGallery media={post.media} height={160} blurred={covered} />
                  {covered && (
                    <SensitiveCover
                      categories={post.sensitiveCategories.map(categoryLabel)}
                      onReveal={() => setRevealed((prev) => new Set(prev).add(post.id))}
                    />
                  )}
                </View>
              )}
            </View>
          );
        })
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  post: { padding: Spacing.md, borderRadius: Radius.field, gap: Spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  art: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
