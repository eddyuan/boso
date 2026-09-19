import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/auth-form';
import { EmptyState } from '@/components/empty-state';
import { CompanionArt } from '@/components/mascot/companions';
import { MediaGallery, type PostMedia } from '@/components/media-gallery';
import { SensitiveCover } from '@/components/sensitive-cover';
import { ThemedText } from '@/components/themed-text';
import { ViewersSheet } from '@/components/viewers-sheet';
import { Badge, Card, Chip, ChipGroup, ErrorText, RoundButton, Segmented } from '@/components/ui/controls';
import { Icon } from '@/components/ui/icon';
import { FontFamily, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/lib/i18n';
import { ApiError, apiFetch } from '@/lib/api';
import { categoryLabel, shouldBlur, type ModerationStatus } from '@bsocial/shared';

type Scope = 'nearby' | 'following' | 'discover';

const SCOPES = [
  { value: 'nearby' as const, label: 'Nearby' },
  { value: 'following' as const, label: 'Following' },
  { value: 'discover' as const, label: 'Discover' },
];

type FeedPost = {
  id: string;
  content: string;
  media: PostMedia[];
  createdAt: string;
  authoredByAgent: boolean;
  moderationStatus: ModerationStatus;
  sensitiveCategories: string[];
  distanceM: number | null;
  petName: string;
  species: string;
  ownerName: string | null;
  ownerUsername: string | null;
  ownerImage: string | null;
  likeCount: number;
  likedByMe: boolean;
  commentCount: number;
  mine: boolean;
  viewCount: number;
};

const EMPTY: Record<Scope, { title: string; message: string }> = {
  nearby: {
    title: 'Nothing around you yet',
    message: 'Posts within 5 km show up here. Be the first — tap + to post something.',
  },
  following: {
    title: 'You follow no one yet',
    message: 'Follow people you meet nearby and their posts land here.',
  },
  discover: {
    title: 'No one new nearby',
    message: 'People near you who share your interests will show up here.',
  },
};

export default function FeedTab() {
  const theme = useTheme();
  const { distance, timeAgo } = useT();
  const [scope, setScope] = useState<Scope>('nearby');
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewersFor, setViewersFor] = useState<string | null>(null);
  // The reader's standing preference, and the posts they've revealed this session.
  const [showSensitive, setShowSensitive] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [topics, setTopics] = useState<{ slug: string; label: string }[]>([]);
  const [topic, setTopic] = useState<string | null>(null);

  const load = useCallback(async (next: Scope, forTopic: string | null) => {
    setPosts(null);
    setError(null);
    try {
      let query = `scope=${next}`;
      if (forTopic) query += `&topic=${encodeURIComponent(forTopic)}`;
      if (next !== 'following') {
        // Nearby and Discover are answered relative to where you are.
        const permission = await Location.getForegroundPermissionsAsync();
        if (!permission.granted) {
          const asked = await Location.requestForegroundPermissionsAsync();
          if (!asked.granted) {
            setPosts([]);
            setError('Turn on location to see what people are posting around you.');
            return;
          }
        }
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        query += `&latitude=${position.coords.latitude}&longitude=${position.coords.longitude}`;
      }
      const result = await apiFetch<{ posts: FeedPost[]; showSensitiveContent: boolean }>(`/api/feed?${query}`);
      setPosts(result.posts);
      setShowSensitive(result.showSensitiveContent);
    } catch (e) {
      setPosts([]);
      setError(e instanceof ApiError && e.code === 'location_required'
        ? 'Turn on location to see what people are posting around you.'
        : "Couldn't load the feed.");
    }
  }, []);

  const toggleLike = useCallback(async (post: FeedPost) => {
    // Optimistic — the round trip is what makes a heart feel unresponsive.
    const next = !post.likedByMe;
    setPosts((prev) =>
      (prev ?? []).map((p) =>
        p.id === post.id ? { ...p, likedByMe: next, likeCount: Math.max(0, p.likeCount + (next ? 1 : -1)) } : p,
      ),
    );
    try {
      const r = await apiFetch<{ likeCount: number }>(`/api/posts/${post.id}/like`, {
        method: next ? 'POST' : 'DELETE',
      });
      setPosts((prev) => (prev ?? []).map((p) => (p.id === post.id ? { ...p, likeCount: r.likeCount } : p)));
    } catch {
      setPosts((prev) =>
        (prev ?? []).map((p) =>
          p.id === post.id ? { ...p, likedByMe: !next, likeCount: Math.max(0, p.likeCount + (next ? -1 : 1)) } : p,
        ),
      );
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(scope, topic);
      // Ranked by recent use server-side, so a chip always returns something.
      apiFetch<{ topics: { slug: string; label: string }[] }>('/api/topics?limit=12')
        .then((r) => setTopics(r.topics))
        .catch(() => {});
    }, [load, scope, topic]),
  );

  return (
    <Screen
      underTabBar
      header={
        <View style={styles.header}>
          <ThemedText type="title" style={{ flex: 1 }}>
            Feed
          </ThemedText>
          {/* Writing a post lives in the tab bar, so it isn't repeated here. */}
          <RoundButton
            icon={<Icon name="search" size={20} />}
            onPress={() => router.push('/search')}
            accessibilityLabel="Search"
          />
        </View>
      }>
      <Segmented options={SCOPES} value={scope} onChange={setScope} />

      {/* Only offered once there's a vocabulary to offer; an empty filter row
          is worse than none. Tapping the selected chip clears it. */}
      {topics.length > 0 && (
        <ChipGroup gap={8}>
          {topics.map((t) => (
            <Chip
              key={t.slug}
              label={t.label}
              selected={topic === t.slug}
              onPress={() => setTopic((prev) => (prev === t.slug ? null : t.slug))}
            />
          ))}
        </ChipGroup>
      )}

      <ErrorText message={error} />
      {!posts && <ActivityIndicator color={theme.primaryPress} />}
      {posts?.length === 0 &&
        !error &&
        // With a filter on, the scope's empty copy would blame the wrong thing:
        // the neighbourhood isn't quiet, the topic is.
        (topic ? (
          <EmptyState
            mood="thinking"
            title={`Nothing about ${topics.find((t) => t.slug === topic)?.label ?? 'that'} yet`}
            message="Tap the topic again to see everything."
          />
        ) : (
          <EmptyState mood="thinking" {...EMPTY[scope]} />
        ))}

      {posts?.map((post) => {
        const away = post.distanceM === null ? null : distance(post.distanceM);
        // A post is either the person's own words or their pet's.
        const authorName = post.authoredByAgent ? post.petName : (post.ownerName?.trim() || post.petName);
        const covered = shouldBlur(post.moderationStatus, showSensitive) && !revealed.has(post.id);
        return (
          <Card key={post.id} style={styles.post}>
            <View style={styles.head}>
              {post.authoredByAgent ? (
                <View style={[styles.avatar, { backgroundColor: theme.primarySoft }]}>
                  <CompanionArt species={post.species} size={34} />
                </View>
              ) : post.ownerImage ? (
                <Image source={{ uri: post.ownerImage }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
                  <ThemedText style={{ fontFamily: FontFamily.display, fontSize: 18, color: theme.onPrimary }}>
                    {authorName.slice(0, 1).toUpperCase()}
                  </ThemedText>
                </View>
              )}
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.nameRow}>
                  <ThemedText type="label" numberOfLines={1} style={{ flexShrink: 1 }}>
                    {authorName}
                  </ThemedText>
                  {post.authoredByAgent && (
                    <Badge
                      tone="brand"
                      label="by pet"
                      icon={<Icon name="sparkle" size={11} color={theme.primaryInk} strokeWidth={2.6} />}
                    />
                  )}
                </View>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {[post.ownerUsername ? `@${post.ownerUsername}` : null, away, timeAgo(post.createdAt)]
                    .filter(Boolean)
                    .join(' · ')}
                </ThemedText>
              </View>
            </View>

            <Pressable
              onPress={() => router.push(`/post/${post.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`Open ${authorName}'s post`}
              style={{ gap: Spacing.md }}>
              <ThemedText>{post.content}</ThemedText>
              {post.media.length > 0 && (
                <View>
                  <MediaGallery media={post.media} height={180} blurred={covered} />
                  {covered && (
                    <SensitiveCover
                      categories={post.sensitiveCategories.map(categoryLabel)}
                      onReveal={() => setRevealed((prev) => new Set(prev).add(post.id))}
                    />
                  )}
                </View>
              )}
            </Pressable>

            <View style={styles.metrics}>
              <Pressable
                onPress={() => toggleLike(post)}
                hitSlop={8}
                style={styles.metric}
                accessibilityRole="button"
                accessibilityLabel={post.likedByMe ? 'Unlike post' : 'Like post'}>
                <Icon name="heart" size={18} color={post.likedByMe ? theme.red : theme.textSecondary} />
                <ThemedText type="smallBold" themeColor={post.likedByMe ? 'red' : 'textSecondary'}>
                  {post.likeCount}
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => router.push(`/post/${post.id}`)}
                hitSlop={8}
                style={styles.metric}
                accessibilityRole="button"
                accessibilityLabel="Replies">
                <Icon name="bubble" size={18} color={theme.textSecondary} />
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {post.commentCount}
                </ThemedText>
              </Pressable>
              {/* Only on your own posts: this is a curiosity about your post,
                  not a read receipt anyone else is owed. */}
              {post.mine && (
                <Pressable
                  onPress={() => setViewersFor(post.id)}
                  hitSlop={8}
                  style={styles.metric}
                  accessibilityRole="button"
                  accessibilityLabel="Who looked at this post">
                  <Icon name="eye" size={18} color={theme.textSecondary} />
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    {post.viewCount}
                  </ThemedText>
                </Pressable>
              )}
            </View>
          </Card>
        );
      })}

      <ViewersSheet postId={viewersFor} open={viewersFor !== null} onClose={() => setViewersFor(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  post: { padding: Spacing.lg, gap: Spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  metrics: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  metric: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
