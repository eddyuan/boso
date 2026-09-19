import { shouldBlur, type ModerationStatus, type SensitiveCategory } from '@bsocial/shared';
import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CommentComposer, CommentList, useCommentThread } from '@/components/comment-thread';
import { CompanionArt } from '@/components/mascot/companions';
import { MediaGallery, type PostMedia } from '@/components/media-gallery';
import { SensitiveCover } from '@/components/sensitive-cover';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Badge, ErrorText } from '@/components/ui/controls';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/lib/i18n';
import { apiFetch } from '@/lib/api';
import { ViewersSheet } from '@/components/viewers-sheet';

type Post = {
  id: string;
  content: string;
  media: PostMedia[];
  createdAt: string;
  authoredByAgent: boolean;
  moderationStatus: ModerationStatus;
  sensitiveCategories: SensitiveCategory[];
  placeId: string | null;
  placeName: string | null;
  petName: string;
  species: string;
  ownerName: string | null;
  ownerUsername: string | null;
  ownerImage: string | null;
  likeCount: number;
  likedByMe: boolean;
  mine: boolean;
  viewCount: number;
};

/**
 * One post and its whole conversation.
 *
 * A screen rather than a sheet, because a flat Tieba-style thread gets long and
 * because this has to be reachable by id — from a notification, a whisper's
 * source, a shared link. A sheet can't be a destination.
 *
 * Reached by tapping a post anywhere: the feed, or the map's marker preview.
 */
export default function PostScreen() {
  const theme = useTheme();
  const { t, timeAgo } = useT();
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [showSensitive, setShowSensitive] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewers, setViewers] = useState(false);

  const thread = useCommentThread(postId ?? null);

  const load = useCallback(() => {
    apiFetch<{ post: Post; showSensitiveContent: boolean }>(`/api/posts/${postId}`)
      .then((r) => {
        setPost(r.post);
        setShowSensitive(r.showSensitiveContent);
      })
      // A post can be gone, or hidden by a rule the reader can't see. Both read
      // as missing: "you may not see this" is itself information.
      .catch(() => setError(t('post.unavailable')));
  }, [postId]);

  // Refetched on focus so a like or reply made elsewhere is reflected on return.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleLike = async () => {
    if (!post) return;
    const next = !post.likedByMe;
    setPost({ ...post, likedByMe: next, likeCount: Math.max(0, post.likeCount + (next ? 1 : -1)) });
    try {
      const r = await apiFetch<{ likeCount: number }>(`/api/posts/${post.id}/like`, {
        method: next ? 'POST' : 'DELETE',
      });
      setPost((p) => (p ? { ...p, likeCount: r.likeCount } : p));
    } catch {
      setPost((p) => (p ? { ...p, likedByMe: !next } : p));
    }
  };

  const covered = post ? shouldBlur(post.moderationStatus, showSensitive) && !revealed : false;
  const author = post?.authoredByAgent ? post.petName : post?.ownerName?.trim() || post?.petName;

  return (
    <ThemedView style={styles.fill}>
      <SafeAreaView style={styles.fill} edges={['top']}>
        <View style={styles.top}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t('action.back')}
            style={({ pressed }) => [styles.back, { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.7 : 1 }]}>
            <Icon name="back" />
          </Pressable>
          <ThemedText type="subtitle" style={{ flex: 1 }}>
            {t('post.title')}
          </ThemedText>
        </View>

        <KeyboardAvoidingView
          style={styles.fill}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={8}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <ErrorText message={error} />
            {!post && !error && <ActivityIndicator color={theme.primaryPress} />}

            {post && (
              <>
                <View style={styles.head}>
                  {post.authoredByAgent ? (
                    <View style={[styles.avatar, { backgroundColor: theme.primarySoft }]}>
                      <CompanionArt species={post.species} size={32} />
                    </View>
                  ) : post.ownerImage ? (
                    <Image source={{ uri: post.ownerImage }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, { backgroundColor: theme.primary }]} />
                  )}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={styles.nameRow}>
                      <ThemedText type="label" numberOfLines={1} style={{ flexShrink: 1 }}>
                        {author}
                      </ThemedText>
                      {post.authoredByAgent && (
                        <Badge
                          tone="brand"
                          label={t('feed.byPet')}
                          icon={<Icon name="sparkle" size={11} color={theme.primaryInk} strokeWidth={2.6} />}
                        />
                      )}
                    </View>
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                      {[post.ownerUsername ? `@${post.ownerUsername}` : null, timeAgo(post.createdAt)]
                        .filter(Boolean)
                        .join(' · ')}
                    </ThemedText>
                  </View>
                </View>

                {/* The venue is a destination of its own — tapping through to what
                    else is being said there is the whole point of place threads. */}
                {post.placeName && post.placeId && (
                  <Pressable
                    onPress={() => router.push({ pathname: '/', params: { placeId: post.placeId } })}
                    accessibilityRole="button">
                    <View style={[styles.placeRow, { backgroundColor: theme.backgroundElement }]}>
                      <Icon name="pin" size={18} color={theme.primaryInk} />
                      <ThemedText type="smallBold" numberOfLines={1} style={{ flex: 1 }}>
                        {post.placeName}
                      </ThemedText>
                    </View>
                  </Pressable>
                )}

                <ThemedText style={styles.body}>{post.content}</ThemedText>

                {post.media.length > 0 && (
                  <View>
                    <MediaGallery media={post.media} height={220} blurred={covered} />
                    {covered && (
                      <SensitiveCover
                        categories={post.sensitiveCategories}
                        onReveal={() => setRevealed(true)}
                      />
                    )}
                  </View>
                )}

                <View style={styles.metrics}>
                  <Pressable onPress={toggleLike} hitSlop={8} style={styles.metric} accessibilityRole="button">
                    <Icon name="heart" size={20} color={post.likedByMe ? theme.red : theme.textSecondary} />
                    <ThemedText type="smallBold" themeColor={post.likedByMe ? 'red' : 'textSecondary'}>
                      {post.likeCount}
                    </ThemedText>
                  </Pressable>
                  <View style={styles.metric}>
                    <Icon name="bubble" size={20} color={theme.textSecondary} />
                    <ThemedText type="smallBold" themeColor="textSecondary">
                      {thread.total}
                    </ThemedText>
                  </View>
                  {post.mine && (
                    <Pressable onPress={() => setViewers(true)} hitSlop={8} style={styles.metric} accessibilityRole="button">
                      <Icon name="eye" size={20} color={theme.textSecondary} />
                      <ThemedText type="smallBold" themeColor="textSecondary">
                        {post.viewCount}
                      </ThemedText>
                    </Pressable>
                  )}
                </View>

                <View style={[styles.divider, { backgroundColor: theme.line }]} />
                <CommentList state={thread} />
              </>
            )}
          </ScrollView>

          {post && <CommentComposer state={thread} />}
        </KeyboardAvoidingView>
      </SafeAreaView>

      <ViewersSheet postId={post?.mine ? post.id : null} open={viewers} onClose={() => setViewers(false)} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm },
  back: { width: 44, height: 44, borderRadius: Radius.icon, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xl },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  body: { fontSize: 17, lineHeight: 25 },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.field,
  },
  metrics: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xl },
  metric: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  divider: { height: 1, marginVertical: Spacing.xs },
});
