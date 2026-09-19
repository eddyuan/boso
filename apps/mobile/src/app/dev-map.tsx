import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { MapView } from '@/components/map/map-view';
import { MAP_SPECIES, type MapPost, type MapViewHandle } from '@/components/map/types';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card } from '@/components/ui/controls';
import { Radius } from '@/constants/theme';

// Dev-only preview of the map with fixed data, so the map can be checked
// without signing in. Not linked from anywhere in the app.
// The map opens west of the pet, so "find" has somewhere to go.
const CENTER = { latitude: 43.6524, longitude: -79.3855 };
const PET = { latitude: 43.6524, longitude: -79.3839 };
const base = {
  media: [],
  createdAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
  authoredByAgent: true,
  ownerName: null,
  ownerUsername: null,
  ownerImage: null,
  moderationStatus: 'approved' as const,
  sensitiveCategories: [] as string[],
  placeId: null,
};
const POSTS: MapPost[] = [
  { ...base, id: '1', content: 'Ramen weather.', latitude: 43.6529, longitude: -79.3831, petName: 'Mochi', species: 'cockatiel', placeName: 'Sansotei Ramen' },
  { ...base, id: '2', content: 'Found the sunniest bench.', latitude: 43.6519, longitude: -79.3846, petName: 'Biscuit', species: 'bunny', placeName: 'Nathan Phillips Square' },
];

export default function DevMapScreen() {
  const mapRef = useRef<MapViewHandle>(null);
  const [species, setSpecies] = useState<string>('cockatiel');
  if (!__DEV__) return null;
  return (
    <ThemedView style={styles.fill}>
      <MapView
        ref={mapRef}
        center={CENTER}
        pet={{ species, name: 'Mochi' }}
        petLocation={PET}
        posts={POSTS}
        onSelectPost={() => {}}
        onBoundsChange={() => {}}
      />
      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.row}>
          <Pressable
            onPress={() => mapRef.current?.focusOn(PET)}
            accessibilityRole="button"
            style={({ pressed }) => (pressed ? styles.pressed : null)}
          >
            <Card style={styles.chip}>
              <ThemedText type="smallBold">Find Mochi</ThemedText>
            </Card>
          </Pressable>
          {MAP_SPECIES.map((name) => (
            <Pressable
              key={name}
              onPress={() => setSpecies(name)}
              accessibilityRole="button"
              style={({ pressed }) => (pressed ? styles.pressed : null)}
            >
              <Card style={[styles.chip, species === name && { backgroundColor: '#FFC53D' }]}>
                <ThemedText type="smallBold">{name}</ThemedText>
              </Card>
            </Pressable>
          ))}
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  overlay: { position: 'absolute', top: 24, left: 16, right: 16 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: Radius.pill },
  pressed: { opacity: 0.75 },
});
