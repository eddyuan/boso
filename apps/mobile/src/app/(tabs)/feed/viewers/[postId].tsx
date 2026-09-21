import { useLocalSearchParams } from 'expo-router';

import { ViewersBody } from '@/components/viewers-body';

/** Who looked, owned by the feed. The sheet itself is `ViewersBody`. */
export default function FeedViewersScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  return <ViewersBody postId={postId} />;
}
