import { Image } from 'expo-image';
import { useState } from 'react';
import { ScrollView, StyleSheet, View, type LayoutChangeEvent, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type PostMedia = { url: string; thumbUrl: string | null; kind: 'image' | 'video' };

/**
 * A post's photos — one image, or a swipeable, paged gallery with dots when
 * there's more than one. Videos aren't playable yet, so a video item just
 * shows its poster frame (thumbUrl).
 */
export function MediaGallery({ media, height = 180 }: { media: PostMedia[]; height?: number }) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(0);

  if (media.length === 0) return null;

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width > 0) setPage(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  if (media.length === 1) {
    return (
      <Image
        source={{ uri: media[0]!.url ?? media[0]!.thumbUrl ?? undefined }}
        style={[styles.single, { height, borderRadius: Radius.field }]}
        contentFit="cover"
      />
    );
  }

  return (
    <View onLayout={onLayout} style={{ height }}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={32}
        style={StyleSheet.absoluteFill}>
        {media.map((m, i) => (
          <Image
            key={`${m.url}-${i}`}
            source={{ uri: m.url ?? m.thumbUrl ?? undefined }}
            style={{ width, height, borderRadius: Radius.field }}
            contentFit="cover"
          />
        ))}
      </ScrollView>
      <View style={styles.dots} pointerEvents="none">
        {media.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              { backgroundColor: i === page ? theme.surface : 'rgba(255,255,255,0.5)' },
              i === page && styles.dotActive,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  single: { width: '100%' },
  dots: {
    position: 'absolute',
    bottom: Spacing.sm,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  dot: { width: 5, height: 5, borderRadius: 3 },
  dotActive: { width: 14 },
});
