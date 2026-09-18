import { useImperativeHandle } from 'react';
import { StyleSheet, View } from 'react-native';

import { CompanionArt } from '@/components/mascot/companions';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { MapPost, MapViewProps } from './types';

/**
 * Native placeholder. The real map uses @rnmapbox/maps with a ModelLayer for
 * the pet, which needs a development build (Expo Go can't load it) and a
 * Mapbox secret download token at build time. The web build already shows the
 * full map — see map-view.web.tsx.
 */
export function MapView({ ref, pet, posts }: MapViewProps) {
  const theme = useTheme();
  // Nothing to focus on until there's a real map here.
  useImperativeHandle(ref, () => ({ focusOn: () => {}, focusOnPet: () => {} }));
  return (
    <View style={[styles.fill, { backgroundColor: theme.backgroundElement }]}>
      <View style={[styles.halo, { backgroundColor: theme.primarySoft }]}>
        <CompanionArt species={pet?.species ?? 'cockatiel'} size={110} />
      </View>
      <ThemedText type="header">Map coming to this build</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.message}>
        The native map needs a development build. It already works in the web version, where{' '}
        {pet?.name ?? 'your pet'} walks around in 3D.
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {posts.length} post{posts.length === 1 ? '' : 's'} nearby
      </ThemedText>
    </View>
  );
}

export type { MapPost };

const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.xl },
  halo: { width: 150, height: 150, borderRadius: 75, alignItems: 'center', justifyContent: 'center' },
  message: { textAlign: 'center', maxWidth: 320 },
});
