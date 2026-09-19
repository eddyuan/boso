import type { ModerationStatus, PetSpecies } from '@bsocial/shared';
import type { Ref } from 'react';

export type LatLng = { latitude: number; longitude: number };

export type MapPostMedia = { url: string; thumbUrl: string | null; kind: 'image' | 'video'; blurred?: boolean };

export type MapPost = {
  id: string;
  content: string;
  /** Up to MAX_POST_MEDIA photos/videos, in display order. The marker icon uses media[0]. */
  media: MapPostMedia[];
  latitude: number;
  longitude: number;
  createdAt: string;
  authoredByAgent: boolean;
  moderationStatus: ModerationStatus;
  sensitiveCategories: string[];
  petName: string;
  species: string;
  ownerName: string | null;
  ownerUsername: string | null;
  ownerImage: string | null;
  /** The venue the post is about, when it was attached to one. */
  placeId: string | null;
  placeName: string | null;
};

/** Zoom used when the map is asked to focus on the pet. */
export const PET_FOCUS_ZOOM = 18.5;

export type MapViewHandle = {
  /** Recentre on a point and zoom in (never out) — used by the "You" pill. */
  focusOn: (target: LatLng, zoom?: number) => void;
  /** Recentre on the pet wherever it has wandered to. */
  focusOnPet: (zoom?: number) => void;
};

export type MapViewProps = {
  ref?: Ref<MapViewHandle>;
  /** Where the map opens, usually the user's location. */
  center: LatLng | null;
  /** The user's pet, drawn as its 3D model. */
  pet: { species: PetSpecies | string; name: string } | null;
  /** Where the pet stands; normally the user's location. */
  petLocation: LatLng | null;
  posts: MapPost[];
  onSelectPost?: (post: MapPost) => void;
  /** Tapping the map itself, away from any marker — dismisses the detail panel. */
  onMapPress?: () => void;
  /** Called when the visible area changes, so the caller can load posts. */
  onBoundsChange?: (bounds: { west: number; south: number; east: number; north: number }) => void;
  /** The pet's position as it wanders, throttled — for the "x m away" pill. */
  onPetMove?: (pet: { location: LatLng; distanceM: number }) => void;
};

export const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '';

/** Companions with a 3D model on the map. */
export const MAP_SPECIES = ['cockatiel', 'puppy', 'bunny', 'cat'] as const;

// Models are served by the web app (apps/web/public/models).
export const modelUrl = (species: string, apiUrl: string) =>
  `${apiUrl}/models/${(MAP_SPECIES as readonly string[]).includes(species) ? species : 'cockatiel'}.glb`;
