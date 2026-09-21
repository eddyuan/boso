import { useLocalSearchParams } from 'expo-router';

import { ViewersBody } from '@/components/viewers-body';

/** Who looked, owned by the post screen. The sheet itself is `ViewersBody`. */
export default function PostViewersScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  return <ViewersBody postId={postId} />;
}
