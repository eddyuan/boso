import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card, Divider, ErrorText } from '@/components/ui/controls';
import { Icon, type IconName } from '@/components/ui/icon';
import { FontFamily, Radius, ScreenPadding, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/lib/i18n';
import { apiFetch } from '@/lib/api';

const DEBOUNCE_MS = 300;

export type Place = {
  id: string;
  name: string;
  category: string | null;
  latitude: number;
  longitude: number;
  address: string | null;
  distanceM: number | null;
};

const CATEGORY_ICON: Record<string, IconName> = {
  food: 'pet',
  drink: 'sparkle',
  park: 'map',
  shop: 'feed',
  landmark: 'pin',
};

/** Pick somewhere to attach a post to. Place data comes from Google. */
export function PlacePicker({
  visible,
  near,
  onClose,
  onPick,
}: {
  visible: boolean;
  near: { latitude: number; longitude: number } | null;
  onClose: () => void;
  onPick: (place: Place) => void;
}) {
  const theme = useTheme();
  const { distance } = useT();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(
    async (term: string) => {
      setError(null);
      try {
        const params = new URLSearchParams();
        if (term.trim()) params.set('q', term.trim());
        if (near) {
          params.set('latitude', String(near.latitude));
          params.set('longitude', String(near.longitude));
        }
        const result = await apiFetch<{ places: Place[] }>(`/api/places/search?${params}`);
        setResults(result.places);
      } catch {
        setResults([]);
        setError("Couldn't load places.");
      }
    },
    [near],
  );

  useEffect(() => {
    if (!visible) return;
    setResults(null);
    const timer = setTimeout(() => search(query), query ? DEBOUNCE_MS : 0);
    return () => clearTimeout(timer);
  }, [visible, query, search]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent={false}>
      <ThemedView style={styles.fill}>
        <SafeAreaView style={styles.fill} edges={['top', 'bottom']}>
          <View style={styles.header}>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={({ pressed }) => [
                styles.close,
                { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.7 : 1 },
              ]}>
              <Icon name="close" />
            </Pressable>
            <View style={[styles.searchBar, { backgroundColor: theme.backgroundElement }]}>
              <Icon name="search" size={20} color={theme.textSecondary} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search for a place"
                placeholderTextColor={theme.textSecondary}
                autoFocus
                autoCorrect={false}
                style={[styles.input, { color: theme.text }]}
              />
            </View>
          </View>

          <View style={styles.body}>
            <ErrorText message={error} />
            {!results && <ActivityIndicator color={theme.primaryPress} />}
            {results?.length === 0 && (
              <ThemedText type="small" themeColor="textSecondary">
                {query.trim() ? `Nothing here called “${query.trim()}”.` : 'No places mapped around you yet.'}
              </ThemedText>
            )}

            {results && results.length > 0 && (
              <Card>
                {results.map((place, index) => (
                  <View key={place.id}>
                    {index > 0 && <Divider />}
                    <Pressable
                      onPress={() => onPick(place)}
                      accessibilityRole="button"
                      style={({ pressed }) => (pressed ? { opacity: 0.7 } : null)}>
                      <View style={styles.row}>
                        <View style={[styles.tile, { backgroundColor: theme.primarySoft }]}>
                          <Icon
                            name={CATEGORY_ICON[place.category ?? ''] ?? 'pin'}
                            size={20}
                            color={theme.primaryInk}
                          />
                        </View>
                        <View style={styles.rowText}>
                          <ThemedText type="label" numberOfLines={1}>
                            {place.name}
                          </ThemedText>
                          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                            {[place.address, place.distanceM === null ? null : distance(place.distanceM)]
                              .filter(Boolean)
                              .join(' · ')}
                          </ThemedText>
                        </View>
                      </View>
                    </Pressable>
                  </View>
                ))}
              </Card>
            )}

            <ThemedText type="caption" themeColor="textSecondary" style={styles.attribution}>
              Powered by Google
            </ThemedText>
          </View>
        </SafeAreaView>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: ScreenPadding.horizontal,
    paddingTop: Spacing.lg,
  },
  close: { width: 44, height: 44, borderRadius: Radius.icon, alignItems: 'center', justifyContent: 'center' },
  searchBar: {
    flex: 1,
    height: 48,
    borderRadius: Radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  input: { flex: 1, fontFamily: FontFamily.body, fontSize: 16, outlineStyle: 'none' as never },
  body: { flex: 1, padding: ScreenPadding.horizontal, gap: Spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  tile: { width: 40, height: 40, borderRadius: Radius.icon, alignItems: 'center', justifyContent: 'center' },
  attribution: { textAlign: 'center' },
});
