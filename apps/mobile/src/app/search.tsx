import { INTERESTS } from '@bsocial/shared';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Screen } from '@/components/auth-form';
import { CompanionArt } from '@/components/mascot/companions';
import { ThemedText } from '@/components/themed-text';
import { Card, Divider, ErrorText, SectionTitle } from '@/components/ui/controls';
import { Icon } from '@/components/ui/icon';
import { FontFamily, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { apiFetch } from '@/lib/api';
import { formatDistance } from '@/lib/distance';

const DEBOUNCE_MS = 300;

type Person = {
  userId: string;
  name: string | null;
  username: string | null;
  image: string | null;
  petName: string;
  species: string;
  distanceM?: number;
};

/** Find people: by name while typing, or whoever has posted near you. */
export default function SearchScreen() {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState<Person[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (term: string) => {
    setError(null);
    try {
      let path = '/api/search';
      if (term.trim()) {
        path += `?q=${encodeURIComponent(term.trim())}`;
      } else {
        const permission = await Location.getForegroundPermissionsAsync();
        if (permission.granted) {
          const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          path += `?latitude=${position.coords.latitude}&longitude=${position.coords.longitude}`;
        }
      }
      const result = await apiFetch<{ people: Person[] }>(path);
      setPeople(result.people);
    } catch {
      setPeople([]);
      setError("Couldn't search right now.");
    }
  }, []);

  // Debounced so every keystroke doesn't hit the API.
  useEffect(() => {
    setPeople(null);
    const timer = setTimeout(() => search(query), query ? DEBOUNCE_MS : 0);
    return () => clearTimeout(timer);
  }, [query, search]);

  return (
    <Screen
      header={
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={({ pressed }) => [
              styles.back,
              { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.7 : 1 },
            ]}>
            <Icon name="back" />
          </Pressable>
          <View style={[styles.searchBar, { backgroundColor: theme.backgroundElement }]}>
            <Icon name="search" size={20} color={theme.textSecondary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search people and pets"
              placeholderTextColor={theme.textSecondary}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              style={[styles.input, { color: theme.text }]}
            />
          </View>
        </View>
      }>
      <ErrorText message={error} />
      <SectionTitle>{query.trim() ? 'Results' : 'People near you'}</SectionTitle>
      {!people && <ActivityIndicator color={theme.primaryPress} />}

      {people?.length === 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          {query.trim()
            ? `No one matches “${query.trim()}”.`
            : 'No one has posted near you yet. Try searching by nickname.'}
        </ThemedText>
      )}

      {people && people.length > 0 && (
        <Card>
          {people.map((person, index) => (
            <View key={person.userId}>
              {index > 0 && <Divider />}
              <View style={styles.row}>
                {person.image ? (
                  <Image source={{ uri: person.image }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
                    <ThemedText style={{ fontFamily: FontFamily.display, fontSize: 18, color: theme.onPrimary }}>
                      {(person.name?.trim() || person.username || '?').slice(0, 1).toUpperCase()}
                    </ThemedText>
                  </View>
                )}
                <View style={styles.rowText}>
                  <ThemedText type="label" numberOfLines={1}>
                    {person.name?.trim() || (person.username ? `@${person.username}` : 'Someone')}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {[person.username ? `@${person.username}` : null, person.distanceM === undefined ? null : `${formatDistance(person.distanceM)} away`]
                      .filter(Boolean)
                      .join(' · ')}
                  </ThemedText>
                </View>
                <View style={[styles.petBadge, { backgroundColor: theme.primarySoft }]}>
                  <CompanionArt species={person.species} size={26} />
                </View>
              </View>
            </View>
          ))}
        </Card>
      )}

      <SectionTitle>Browse by interest</SectionTitle>
      <View style={styles.interests}>
        {INTERESTS.slice(0, 8).map((interest) => (
          <Pressable
            key={interest.value}
            onPress={() => setQuery('')}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.interest,
              { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.7 : 1 },
            ]}>
            <ThemedText type="small" style={{ fontFamily: FontFamily.bodyBold }}>
              {interest.emoji} {interest.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  back: { width: 44, height: 44, borderRadius: Radius.icon, alignItems: 'center', justifyContent: 'center' },
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
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  petBadge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  interests: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  interest: { height: 36, paddingHorizontal: Spacing.md, borderRadius: Radius.pill, justifyContent: 'center' },
});
