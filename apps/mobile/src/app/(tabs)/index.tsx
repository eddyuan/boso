import { categoryLabel, getPetSpecies, shouldBlur } from '@bsocial/shared';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomSheet } from '@/components/bottom-sheet';
import { MapView } from '@/components/map/map-view';
import type { LatLng, MapPost, MapViewHandle } from '@/components/map/types';
import { CompanionArt } from '@/components/mascot/companions';
import { MediaGallery } from '@/components/media-gallery';
import { SensitiveCover } from '@/components/sensitive-cover';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Badge, Card, ErrorText } from '@/components/ui/controls';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing, TabBar } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { apiFetch } from '@/lib/api';
import { authClient } from '@/lib/auth-client';
import { formatDistance } from '@/lib/distance';
import { timeAgo } from '@/lib/time';
import { FontFamily } from '@/constants/theme';

type Pet = { id: string; name: string; species: string; autoApprove: boolean };
type Whiskers = { line: string; sourcePostIds: string[] } | null;
type ErrandResult = { posts: MapPost[]; foundNothing: boolean };

// Main tab: the map, with your pet at your location and nearby posts shown
// as their photo.
export default function MapTab() {
  const theme = useTheme();
  const [pet, setPet] = useState<Pet | null>(null);
  const [location, setLocation] = useState<LatLng | null>(null);
  const [permission, setPermission] = useState<Location.PermissionStatus | null>(null);
  const [posts, setPosts] = useState<MapPost[]>([]);
  const [selected, setSelected] = useState<MapPost | null>(null);
  // Revealed for this session only — never persisted, so the cover comes back.
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [petAway, setPetAway] = useState<string | null>(null);
  const [whiskers, setWhiskers] = useState<Whiskers>(null);
  const [errand, setErrand] = useState<ErrandResult | null>(null);
  const [sending, setSending] = useState(false);
  const { data: session } = authClient.useSession();
  const showSensitive = session?.user?.showSensitiveContent ?? false;
  const sheetCovered =
    selected !== null && shouldBlur(selected.moderationStatus, showSensitive) && !revealed.has(selected.id);
  const lastBounds = useRef<string>('');
  const mapRef = useRef<MapViewHandle>(null);

  useFocusEffect(
    useCallback(() => {
      apiFetch<{ pet: Pet | null }>('/api/pets')
        .then((r) => setPet(r.pet))
        .catch(() => {});
      Location.getForegroundPermissionsAsync()
        .then((p) => {
          setPermission(p.status);
          if (p.granted) locate();
        })
        .catch(() => {});
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  async function locate() {
    try {
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const next = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      setLocation(next);
      // Today's gossip is generated once server-side and cached for the day, so
      // asking again on every focus is cheap and always returns the same line.
      apiFetch<{ whiskers: Whiskers }>(
        `/api/me/whiskers?latitude=${next.latitude}&longitude=${next.longitude}`,
      )
        .then((r) => setWhiskers(r.whiskers))
        .catch(() => {});
    } catch {
      setError("Couldn't get your location.");
    }
  }

  /** Send the pet off to fetch what's been happening within a few streets. */
  async function sendErrand() {
    if (!location || sending) return;
    setSending(true);
    setError(null);
    try {
      const r = await apiFetch<ErrandResult>('/api/me/errand', {
        method: 'POST',
        body: JSON.stringify(location),
      });
      setErrand(r);
    } catch {
      setError("Couldn't send them out just now.");
    }
    setSending(false);
  }

  async function askForLocation() {
    setError(null);
    const p = await Location.requestForegroundPermissionsAsync();
    setPermission(p.status);
    if (p.granted) await locate();
  }

  const loadPosts = useCallback(async (b: { west: number; south: number; east: number; north: number }) => {
    // Skip refetching for tiny map movements.
    const key = [b.west, b.south, b.east, b.north].map((v) => v.toFixed(3)).join(',');
    if (key === lastBounds.current) return;
    lastBounds.current = key;
    try {
      const r = await apiFetch<{ posts: MapPost[] }>(
        `/api/map/posts?west=${b.west}&south=${b.south}&east=${b.east}&north=${b.north}`,
      );
      setPosts(r.posts);
    } catch {
      // Keep the last set of posts on a transient failure.
    }
  }, []);

  // Stable identity, and only re-render when the shown distance actually
  // changes — the map reports about once a second.
  const handlePetMove = useCallback(({ distanceM }: { distanceM: number }) => {
    const next = formatDistance(distanceM);
    setPetAway((prev) => (prev === next ? prev : next));
  }, []);

  const species = pet ? getPetSpecies(pet.species) : null;

  return (
    <ThemedView style={styles.fill}>
      <MapView
        ref={mapRef}
        center={location}
        pet={pet}
        petLocation={location}
        posts={posts}
        onSelectPost={setSelected}
        onMapPress={() => setSelected(null)}
        onBoundsChange={loadPosts}
        onPetMove={handlePetMove}
      />

      <SafeAreaView style={styles.overlay} pointerEvents="box-none" edges={['top', 'bottom']}>
        <View style={styles.topRow} pointerEvents="box-none">
          <Pressable
            // Back to where you are.
            onPress={() => location && mapRef.current?.focusOn(location)}
            disabled={!location}
            accessibilityRole="button"
            accessibilityLabel="Centre the map on you"
            style={({ pressed }) => (pressed ? styles.pressed : null)}
          >
            <Card style={styles.youChip}>
              {session?.user?.image ? (
                <Image source={{ uri: session.user.image }} style={styles.youAvatar} />
              ) : (
                <View style={[styles.youAvatar, { backgroundColor: theme.primary }]}>
                  <ThemedText style={{ fontFamily: FontFamily.display, fontSize: 14, color: theme.onPrimary }}>
                    {(session?.user?.name?.trim() || session?.user?.username || '?').slice(0, 1).toUpperCase()}
                  </ThemedText>
                </View>
              )}
              <ThemedText type="smallBold">You</ThemedText>
            </Card>
          </Pressable>

          {pet && species && (
            <Pressable
              // Follow the pet to wherever it has wandered off to.
              onPress={() => mapRef.current?.focusOnPet()}
              accessibilityRole="button"
              accessibilityLabel={`Show ${pet.name} on the map`}
              style={({ pressed }) => (pressed ? styles.pressed : null)}
            >
              <Card style={styles.petChip}>
                <View style={[styles.petAvatar, { backgroundColor: theme.primarySoft }]}>
                  <CompanionArt species={pet.species} size={30} />
                </View>
                <View>
                  <ThemedText type="smallBold">{pet.name}</ThemedText>
                  <ThemedText type="caption" themeColor="textSecondary">
                    {!location
                      ? 'Waiting for your location'
                      : petAway === null
                        ? `${species.moves} near you`
                        : `${petAway} away`}
                  </ThemedText>
                </View>
                {location && <Icon name="pin" size={18} color={theme.primary} />}
              </Card>
            </Pressable>
          )}
        </View>

        <View style={styles.bottom} pointerEvents="box-none">
          <ErrorText message={error} />
          {!location ? (
            <Card style={styles.prompt}>
              <ThemedText type="label">Put your pet on the map</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {permission === 'denied'
                  ? 'Location is off. Turn it on in Settings to see your pet and nearby posts.'
                  : 'Share your location to see your pet and the posts around you.'}
              </ThemedText>
              {permission !== 'denied' && (
                <Button
                  label="Use my location"
                  onPress={askForLocation}
                  icon={<Icon name="pin" size={20} color={theme.onPrimary} />}
                />
              )}
            </Card>
          ) : (
            <>
              {/* One line of local news a day. Tappable through to the posts it
                  came from, so it's never a claim you can't check. */}
              {whiskers && (
                <Card style={styles.whiskers}>
                  <Icon name="sparkle" size={16} color={theme.primaryInk} />
                  <ThemedText type="small" style={{ flex: 1 }}>
                    {whiskers.line}
                  </ThemedText>
                </Card>
              )}
              <View style={styles.bottomRow} pointerEvents="box-none">
                {posts.length > 0 && (
                  <Badge tone="brand" label={`${posts.length} post${posts.length === 1 ? '' : 's'} around you`} />
                )}
                {pet && (
                  <Button
                    variant="secondary"
                    label={sending ? 'Off they go…' : `Send ${pet.name} out`}
                    onPress={sendErrand}
                    disabled={sending}
                    icon={<Icon name="shuffle" size={18} color={theme.primaryInk} />}
                  />
                )}
              </View>
            </>
          )}
        </View>
      </SafeAreaView>

      <BottomSheet
        open={!!selected}
        onClose={() => setSelected(null)}
        contentKey={selected?.id}
        header={
          selected && (
            <View style={styles.postHead}>
              <View style={[styles.petAvatar, { backgroundColor: theme.primarySoft }]}>
                <CompanionArt species={selected.species} size={30} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.postNameRow}>
                  <ThemedText type="label" numberOfLines={1} style={{ flexShrink: 1 }}>
                    {selected.authoredByAgent ? selected.petName : selected.ownerName?.trim() || selected.petName}
                  </ThemedText>
                  {selected.authoredByAgent && (
                    <Badge
                      tone="brand"
                      label="by pet"
                      icon={<Icon name="sparkle" size={11} color={theme.primaryInk} strokeWidth={2.6} />}
                    />
                  )}
                </View>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {[
                    selected.ownerUsername ? `@${selected.ownerUsername}` : null,
                    timeAgo(selected.createdAt),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </ThemedText>
              </View>
            </View>
          )
        }>
        {selected && (
          <>
            {selected.placeName && (
              <View style={[styles.placeRow, { backgroundColor: theme.backgroundElement }]}>
                <Icon name="pin" size={18} color={theme.primaryInk} />
                <ThemedText type="smallBold" numberOfLines={1} style={{ flex: 1 }}>
                  {selected.placeName}
                </ThemedText>
              </View>
            )}
            <ThemedText>{selected.content}</ThemedText>
            {selected.media.length > 0 && (
              <View>
                <MediaGallery media={selected.media} height={220} blurred={sheetCovered} />
                {sheetCovered && (
                  <SensitiveCover
                    categories={selected.sensitiveCategories.map(categoryLabel)}
                    onReveal={() => setRevealed((prev) => new Set(prev).add(selected.id))}
                  />
                )}
              </View>
            )}
          </>
        )}
      </BottomSheet>

      <BottomSheet
        open={errand !== null}
        onClose={() => setErrand(null)}
        header={
          <View style={{ gap: 2 }}>
            <ThemedText type="label">
              {errand?.foundNothing ? 'Nothing doing' : `${errand?.posts.length} thing${errand?.posts.length === 1 ? '' : 's'} nearby`}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {errand?.foundNothing
                ? `${pet?.name ?? 'Your pet'} had a good look around and came back empty-pawed.`
                : `${pet?.name ?? 'Your pet'} brought these back from a few streets away.`}
            </ThemedText>
          </View>
        }>
        {/* Finding nothing is a real outcome, not an error — the pet still went. */}
        {errand?.posts.map((post) => (
          <View key={post.id} style={[styles.errandPost, { backgroundColor: theme.backgroundElement }]}>
            <View style={styles.postHead}>
              <View style={[styles.petAvatar, { backgroundColor: theme.primarySoft }]}>
                <CompanionArt species={post.species} size={26} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <ThemedText type="smallBold" numberOfLines={1}>
                  {post.authoredByAgent ? post.petName : post.ownerName?.trim() || post.petName}
                </ThemedText>
                <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
                  {[post.placeName, timeAgo(post.createdAt)].filter(Boolean).join(' · ')}
                </ThemedText>
              </View>
            </View>
            <ThemedText type="small" numberOfLines={4}>
              {post.content}
            </ThemedText>
          </View>
        ))}
      </BottomSheet>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'space-between' },
  topRow: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  youChip: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 8, paddingLeft: 8, paddingRight: 14, borderRadius: Radius.pill },
  youAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  petChip: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingLeft: 12, paddingRight: 14, borderRadius: Radius.pill },
  pressed: { opacity: 0.75 },
  petAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  bottom: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    // The tab bar floats over the map, so the card has to clear it.
    paddingBottom: TabBar.contentInset,
    gap: Spacing.sm,
    alignItems: 'flex-start',
  },
  prompt: { padding: Spacing.lg, gap: Spacing.sm, alignSelf: 'stretch' },
  whiskers: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    alignSelf: 'stretch',
  },
  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  errandPost: { padding: Spacing.md, borderRadius: Radius.field, gap: Spacing.sm },
  postCard: { padding: Spacing.lg, gap: Spacing.sm, alignSelf: 'stretch' },
  postHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  postNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.field,
  },
});
