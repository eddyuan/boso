import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Screen } from '@/components/auth-form';
import { PlacePicker, type Place } from '@/components/place-picker';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card, ErrorText } from '@/components/ui/controls';
import { Icon } from '@/components/ui/icon';
import { FontFamily, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { apiFetch } from '@/lib/api';

const MAX_LENGTH = 500;
// Show the counter only once it's worth worrying about.
const COUNTER_FROM = 400;

type LatLng = { latitude: number; longitude: number };

/** Writing a post as yourself. Your pet writes its own — see the pet's activity. */
export default function ComposeScreen() {
  const theme = useTheme();
  const [content, setContent] = useState('');
  const [place, setPlace] = useState<LatLng | null>(null);
  const [venue, setVenue] = useState<Place | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = content.trim();
  const tooLong = trimmed.length > MAX_LENGTH;
  const canPost = trimmed.length > 0 && !tooLong && !posting;

  async function attachLocation() {
    if (place) {
      setPlace(null);
      return;
    }
    setError(null);
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setError('Location is off, so this post will not appear on the map.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setPlace({ latitude: position.coords.latitude, longitude: position.coords.longitude });
    } catch {
      setError("Couldn't get your location.");
    } finally {
      setLocating(false);
    }
  }

  async function post() {
    setPosting(true);
    setError(null);
    try {
      await apiFetch('/api/posts', {
        method: 'POST',
        // A chosen place carries its own coordinates, so it replaces the raw fix.
        body: JSON.stringify(venue ? { content: trimmed, placeId: venue.id } : { content: trimmed, ...(place ?? {}) }),
      });
      router.back();
    } catch {
      setError("Couldn't post that. Try again.");
      setPosting(false);
    }
  }

  return (
    <Screen
      header={
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={({ pressed }) => [
              styles.close,
              { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.7 : 1 },
            ]}>
            <Icon name="close" />
          </Pressable>
          <ThemedText type="subtitle" style={{ flex: 1 }}>
            New post
          </ThemedText>
          <Button label="Post" onPress={post} disabled={!canPost} loading={posting} compact />
        </View>
      }>
      <View style={styles.author}>
        <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
          <Icon name="person" color={theme.onPrimary} />
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          Posting as you, not your pet
        </ThemedText>
      </View>

      <TextInput
        value={content}
        onChangeText={setContent}
        placeholder="What's happening?"
        placeholderTextColor={theme.textSecondary}
        multiline
        autoFocus
        style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
      />

      {trimmed.length >= COUNTER_FROM && (
        <ThemedText type="small" style={{ color: tooLong ? theme.red : theme.textSecondary, textAlign: 'right' }}>
          {trimmed.length} / {MAX_LENGTH}
        </ThemedText>
      )}

      <Pressable
        onPress={() => setPickerOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Add a place">
        <Card style={[styles.place, venue ? { backgroundColor: theme.primarySoft } : null]}>
          <Icon name="pin" color={venue ? theme.primaryInk : theme.textSecondary} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <ThemedText type="small" style={{ color: venue ? theme.primaryInk : theme.text }} numberOfLines={1}>
              {venue ? venue.name : 'Add a place'}
            </ThemedText>
            {venue?.address ? (
              <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
                {venue.address}
              </ThemedText>
            ) : null}
          </View>
          {venue && (
            <Pressable
              onPress={() => setVenue(null)}
              accessibilityRole="button"
              accessibilityLabel="Remove place"
              hitSlop={10}>
              <Icon name="close" size={18} color={theme.primaryInk} />
            </Pressable>
          )}
        </Card>
      </Pressable>

      <PlacePicker
        visible={pickerOpen}
        near={place}
        onClose={() => setPickerOpen(false)}
        onPick={(picked) => {
          setVenue(picked);
          setPickerOpen(false);
        }}
      />

      <Pressable onPress={attachLocation} accessibilityRole="button" disabled={locating || !!venue}>
        <Card style={[styles.place, place && !venue ? { backgroundColor: theme.primarySoft } : null]}>
          <Icon name="pin" color={place && !venue ? theme.primaryInk : theme.textSecondary} />
          <ThemedText
            type="small"
            style={{ flex: 1, color: place && !venue ? theme.primaryInk : theme.text }}
            numberOfLines={1}>
            {venue
              ? 'Using the place above'
              : locating
                ? 'Finding you…'
                : place
                  ? 'This post will show on the map'
                  : 'Or just use where you are'}
          </ThemedText>
          {place && !venue && <Icon name="check" size={18} color={theme.primaryInk} strokeWidth={3} />}
        </Card>
      </Pressable>

      <ErrorText message={error} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  close: { width: 44, height: 44, borderRadius: Radius.icon, alignItems: 'center', justifyContent: 'center' },
  author: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  input: {
    minHeight: 160,
    borderRadius: Radius.field,
    padding: Spacing.lg,
    fontFamily: FontFamily.body,
    fontSize: 17,
    lineHeight: 25,
    textAlignVertical: 'top',
    outlineStyle: 'none' as never,
  },
  place: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg },
});
