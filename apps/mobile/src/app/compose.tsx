import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

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
/**
 * The API accepts 20, but a compose screen that can hold 20 thumbnails isn't a
 * compose screen. Four fills the strip without scrolling on a phone.
 */
const MAX_PHOTOS = 4;

type LatLng = { latitude: number; longitude: number };
type Photo = { url: string; thumbUrl: string; kind: 'image' };

/** Writing a post as yourself. Your pet writes its own — see the pet's activity. */
export default function ComposeScreen() {
  const theme = useTheme();
  // Arriving from a place's thread ("be the first to post here"), the venue is
  // already decided — carried as params so compose doesn't have to re-fetch it.
  const params = useLocalSearchParams<{ placeId?: string; placeName?: string }>();
  const [content, setContent] = useState('');
  const [place, setPlace] = useState<LatLng | null>(null);
  const [venue, setVenue] = useState<Place | null>(
    params.placeId && params.placeName
      ? {
          id: params.placeId,
          name: params.placeName,
          category: null,
          latitude: 0,
          longitude: 0,
          address: null,
          distanceM: null,
        }
      : null,
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [posting, setPosting] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const trimmed = content.trim();
  const tooLong = trimmed.length > MAX_LENGTH;
  // A photo still needs words: the feed and the map both lead with the text.
  const canPost = trimmed.length > 0 && !tooLong && !posting && uploading === 0;

  /**
   * Photos upload as they're picked rather than on Post, so publishing is a
   * single small request and a failed post never loses the pictures.
   */
  async function addPhotos() {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo access is off. Turn it on in Settings to add pictures.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS - photos.length,
      quality: 0.9,
    });
    if (result.canceled) return;

    setUploading(result.assets.length);
    for (const asset of result.assets) {
      try {
        const form = new FormData();
        // React Native's FormData takes this shape rather than a Blob.
        form.append('file', {
          uri: asset.uri,
          name: asset.fileName ?? 'photo.jpg',
          type: asset.mimeType ?? 'image/jpeg',
        } as unknown as Blob);
        const stored = await apiFetch<Photo>('/api/uploads/post-media', { method: 'POST', body: form });
        setPhotos((prev) => [...prev, { url: stored.url, thumbUrl: stored.thumbUrl, kind: 'image' }]);
      } catch {
        setError("Couldn't add one of those photos.");
      }
      setUploading((n) => n - 1);
    }
  }

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
        body: JSON.stringify({
          content: trimmed,
          media: photos,
          ...(venue ? { placeId: venue.id } : (place ?? {})),
        }),
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

      {(photos.length > 0 || uploading > 0) && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
          {photos.map((photo) => (
            <View key={photo.url}>
              <Image source={{ uri: photo.thumbUrl }} style={styles.thumb} contentFit="cover" />
              <Pressable
                onPress={() => setPhotos((prev) => prev.filter((p) => p.url !== photo.url))}
                accessibilityRole="button"
                accessibilityLabel="Remove photo"
                hitSlop={8}
                style={[styles.remove, { backgroundColor: theme.background }]}>
                <Icon name="close" size={14} strokeWidth={3} />
              </Pressable>
            </View>
          ))}
          {Array.from({ length: uploading }).map((_, i) => (
            <View key={`pending-${i}`} style={[styles.thumb, styles.pending, { backgroundColor: theme.backgroundElement }]}>
              <ActivityIndicator color={theme.primaryPress} />
            </View>
          ))}
        </ScrollView>
      )}

      {photos.length + uploading < MAX_PHOTOS && (
        <Pressable onPress={addPhotos} accessibilityRole="button" accessibilityLabel="Add photos">
          <Card style={styles.place}>
            <Icon name="camera" color={theme.textSecondary} />
            <ThemedText type="small" style={{ flex: 1 }}>
              {photos.length === 0 ? 'Add photos' : `Add another (${photos.length}/${MAX_PHOTOS})`}
            </ThemedText>
          </Card>
        </Pressable>
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
  strip: { gap: Spacing.sm, paddingVertical: 2 },
  thumb: { width: 96, height: 96, borderRadius: Radius.field },
  pending: { alignItems: 'center', justifyContent: 'center' },
  remove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
