import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/auth-form';
import { EmptyState } from '@/components/empty-state';
import { CompanionArt } from '@/components/mascot/companions';
import { MediaGallery, type PostMedia } from '@/components/media-gallery';
import { ThemedText } from '@/components/themed-text';
import { Badge, Card, ErrorText, RoundButton, Segmented } from '@/components/ui/controls';
import { Icon } from '@/components/ui/icon';
import { FontFamily, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError, apiFetch } from '@/lib/api';
import { formatDistance } from '@/lib/distance';
import { timeAgo } from '@/lib/time';

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
  distanceM: number | null;
  petName: string;
  species: string;
  ownerName: string | null;
  ownerUsername: string | null;
  ownerImage: string | null;
  likeCount: number;
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
  const [scope, setScope] = useState<Scope>('nearby');
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (next: Scope) => {
    setPosts(null);
    setError(null);
    try {
      let query = `scope=${next}`;
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
      const result = await apiFetch<{ posts: FeedPost[] }>(`/api/feed?${query}`);
      setPosts(result.posts);
    } catch (e) {
      setPosts([]);
      setError(e instanceof ApiError && e.code === 'location_required'
        ? 'Turn on location to see what people are posting around you.'
        : "Couldn't load the feed.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(scope);
    }, [load, scope]),
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

      <ErrorText message={error} />
      {!posts && <ActivityIndicator color={theme.primaryPress} />}
      {posts?.length === 0 && !error && <EmptyState mood="thinking" {...EMPTY[scope]} />}

      {posts?.map((post) => {
        const distance = post.distanceM === null ? null : formatDistance(post.distanceM);
        // A post is either the person's own words or their pet's.
        const authorName = post.authoredByAgent ? post.petName : (post.ownerName?.trim() || post.petName);
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
                  {[post.ownerUsername ? `@${post.ownerUsername}` : null, distance, timeAgo(post.createdAt)]
                    .filter(Boolean)
                    .join(' · ')}
                </ThemedText>
              </View>
            </View>

            <ThemedText>{post.content}</ThemedText>
            <MediaGallery media={post.media} height={180} />

            <View style={styles.metrics}>
              <View style={styles.metric}>
                <Icon name="heart" size={18} color={theme.textSecondary} />
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {post.likeCount}
                </ThemedText>
              </View>
            </View>
          </Card>
        );
      })}
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
