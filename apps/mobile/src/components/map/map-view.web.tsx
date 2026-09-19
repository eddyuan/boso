import mapboxgl, { type CustomLayerInterface } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { API_URL } from '@/lib/auth-client';
import { distanceBetween } from '@/lib/distance';
import { getPetSpecies } from '@bsocial/shared';

import { Wander } from './wander';
import {
  MAPBOX_TOKEN,
  modelUrl,
  PET_FOCUS_ZOOM,
  type LatLng,
  type MapPost,
  type MapViewProps,
} from './types';

const PET_HEIGHT_M = 8; // exaggerated so the pet reads at street zoom
const DEFAULT_CENTER: [number, number] = [-79.3839, 43.6524];
const GHOST_OPACITY = 0.5;
const WALK_SPEED_MPS = 4;
const FLY_SPEED_MPS = 11;
const MARKER_STYLE_ID = 'tielo-pet-marker';
const YOU_BLUE = '#2F7BEA';
const EARTH_CIRCUMFERENCE_M = 40075016.686;
// How tall the pet has to be on screen (in px) before the pin and ring fade
// out: past this you can see the pet itself, so they'd just be clutter. The two
// values are a hysteresis band, so hovering at the threshold doesn't flicker.
const MARKERS_HIDE_ABOVE_PX = 36;
const MARKERS_SHOW_BELOW_PX = 28;

/**
 * Keyframes for the pet's pin and ground ring. Injected once: these live on raw
 * DOM inside Mapbox markers, which react-native-web styles can't reach.
 */
function ensureMarkerStyles() {
  if (document.getElementById(MARKER_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = MARKER_STYLE_ID;
  // The marker root carries Mapbox's own transform, so anything animated with a
  // transform has to be a child of it.
  style.textContent = `
.tielo-fade{transition:opacity .25s ease}
.tielo-you{position:absolute;left:0;top:0;box-sizing:border-box;width:24px;height:24px;margin:-12px 0 0 -12px;border-radius:50%;background:#2F7BEA;border:3px solid #fff;box-shadow:0 2px 6px rgba(20,40,80,.45)}
.tielo-ring{position:absolute;left:0;top:0;box-sizing:border-box;width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:50%;border:5px solid;opacity:0;animation:tielo-ring 2.4s ease-out infinite}
.tielo-ring--late{animation-delay:1.2s}
@keyframes tielo-ring{0%{transform:scale(.4);opacity:.85}70%{opacity:.18}100%{transform:scale(1.15);opacity:0}}
.tielo-bob{display:block;animation:tielo-bob 1.8s ease-in-out infinite}
@keyframes tielo-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
.tielo-pin{display:block;width:22px;height:22px;border-radius:50% 50% 50% 0;border:3px solid;transform:rotate(-45deg);box-shadow:0 3px 8px rgba(43,31,22,.3)}
@media (prefers-reduced-motion: reduce){.tielo-ring,.tielo-bob{animation:none}.tielo-ring{opacity:.5}}
`;
  document.head.appendChild(style);
}

/**
 * Web map: Mapbox GL JS with the pet's glTF model rendered by three.js in a
 * custom layer (so its animations play), and one HTML marker per post.
 * The native build uses map-view.tsx instead.
 */
export function MapView({
  ref,
  center,
  pet,
  petLocation,
  posts,
  onSelectPost,
  places = [],
  onSelectPlace,
  onBoundsChange,
  onPetMove,
  onMapPress,
}: MapViewProps) {
  const theme = useTheme();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const placeMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const petRef = useRef<{
    group: THREE.Group;
    setSpecies: (species: string) => void;
    setHome: (x: number, z: number, snap?: boolean) => void;
  } | null>(null);
  // Lets the render loop drag the pin and ring along with the wandering pet.
  const petMarkersRef = useRef<{ follow: (x: number, z: number) => void } | null>(null);
  // The scene is anchored to where the map opened; the pet's position is
  // measured from here, so it stays put as the map moves.
  const originRef = useRef<mapboxgl.MercatorCoordinate | null>(null);
  const startedRef = useRef(false);
  // Where the pet is right now, kept fresh by the render loop.
  const petLngLatRef = useRef<mapboxgl.LngLat | null>(null);
  const youDotRef = useRef<{ dot: mapboxgl.Marker; rings: mapboxgl.Marker } | null>(null);
  // Kept so the markers can be recoloured when the theme changes.
  const markerElsRef = useRef<{ rings: HTMLElement[]; pin: HTMLElement } | null>(null);
  // Latest props for the render loop. Map objects are built once; re-creating
  // them whenever a prop identity changed made the pet's markers flash back to
  // the user's location mid-gesture.
  const onPetMoveRef = useRef(onPetMove);
  const onMapPressRef = useRef(onMapPress);
  const userLocationRef = useRef<LatLng | null>(petLocation);
  onPetMoveRef.current = onPetMove;
  onMapPressRef.current = onMapPress;
  userLocationRef.current = petLocation;

  useImperativeHandle(ref, () => ({
    focusOn(target: LatLng, zoom = PET_FOCUS_ZOOM) {
      const map = mapRef.current;
      if (!map) return;
      map.easeTo({
        center: [target.longitude, target.latitude],
        // Zoom in only; don't pull the user back out if they're closer already.
        zoom: Math.max(map.getZoom(), zoom),
        duration: 900,
      });
    },
    focusOnPet(zoom = PET_FOCUS_ZOOM) {
      const map = mapRef.current;
      const at = petLngLatRef.current;
      if (!map || !at) return;
      map.easeTo({ center: at, zoom: Math.max(map.getZoom(), zoom), duration: 900 });
    },
  }));

  // Map + pet layer (created once).
  useEffect(() => {
    if (!MAPBOX_TOKEN || !hostRef.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;

    const start: [number, number] = center ? [center.longitude, center.latitude] : DEFAULT_CENTER;
    const map = new mapboxgl.Map({
      container: hostRef.current,
      style: 'mapbox://styles/mapbox/standard',
      center: start,
      zoom: 17.5,
      pitch: 60,
      antialias: true,
    });
    mapRef.current = map;

    const origin = mapboxgl.MercatorCoordinate.fromLngLat(start, 0);
    const metersToMerc = origin.meterInMercatorCoordinateUnits();
    originRef.current = origin;

    const petGroup = new THREE.Group();
    petGroup.scale.setScalar(PET_HEIGHT_M);
    // Drawn in a second pass, only where the depth buffer says something is in
    // front of the pet — so a hidden pet reads as a silhouette through the
    // building rather than disappearing.
    const ghostMaterial = new THREE.MeshBasicMaterial({
      color: theme.primary,
      transparent: true,
      opacity: GHOST_OPACITY,
      depthFunc: THREE.GreaterDepth,
      depthWrite: false,
    });
    const scene = new THREE.Scene();
    const camera = new THREE.Camera();
    const clock = new THREE.Clock();
    let renderer: THREE.WebGLRenderer;
    let mixer: THREE.AnimationMixer | null = null;
    let loadedSpecies = '';
    let actions: Record<string, THREE.AnimationAction> = {};
    let playing: THREE.AnimationAction | undefined;
    let wander = new Wander({ flies: true, speedMps: FLY_SPEED_MPS });

    /** Crossfade to a clip, ignoring species that don't have it. */
    function fadeTo(name: string) {
      const next = actions[name];
      if (!next || next === playing) return;
      next.reset().setLoop(THREE.LoopRepeat, Infinity).play();
      playing?.crossFadeTo(next, 0.25, false);
      playing = next;
    }

    function loadSpecies(species: string) {
      if (species === loadedSpecies) return;
      loadedSpecies = species;
      petGroup.clear();
      actions = {};
      playing = undefined;
      const flies = getPetSpecies(species).moves === 'Flies';
      wander = new Wander({ flies, speedMps: flies ? FLY_SPEED_MPS : WALK_SPEED_MPS });
      wander.setHome(petGroup.position.x, petGroup.position.z, true);
      new GLTFLoader().load(
        modelUrl(species, API_URL),
        (gltf) => {
          petGroup.add(gltf.scene);
          mixer = new THREE.AnimationMixer(gltf.scene);
          for (const clip of gltf.animations) actions[clip.name] = mixer.clipAction(clip);
          fadeTo('Idle');
        },
        undefined,
        (err) => console.warn('[Tielo] pet model failed to load', err),
      );
    }
    petRef.current = {
      group: petGroup,
      setSpecies: loadSpecies,
      setHome: (x, z, snap) => wander.setHome(x, z, snap),
    };

    // Pin, ground ring and the blue "you" dot. Built once with the map: these
    // are DOM markers, so they keep their size on screen as the 3D pet shrinks.
    ensureMarkerStyles();
    const ringEl = document.createElement('div');
    ringEl.style.pointerEvents = 'none';
    ringEl.innerHTML =
      `<div class="tielo-fade" style="opacity:0">` +
      `<span class="tielo-ring" style="border-color:${theme.primary}"></span>` +
      `<span class="tielo-ring tielo-ring--late" style="border-color:${theme.primary}"></span>` +
      `</div>`;
    const pinEl = document.createElement('div');
    pinEl.style.pointerEvents = 'none';
    pinEl.setAttribute('aria-hidden', 'true');
    pinEl.innerHTML =
      `<div class="tielo-fade" style="opacity:0"><span class="tielo-bob"><span class="tielo-pin" ` +
      `style="background:${theme.primary};border-color:${theme.surface}"></span></span></div>`;
    const fades = [ringEl.firstElementChild as HTMLElement, pinEl.firstElementChild as HTMLElement];
    markerElsRef.current = {
      rings: Array.from(ringEl.querySelectorAll<HTMLElement>('.tielo-ring')),
      pin: pinEl.querySelector<HTMLElement>('.tielo-pin')!,
    };

    // pitchAlignment 'map' lays the ring flat on the ground; the pin stays
    // upright and facing the camera.
    const ring = new mapboxgl.Marker({ element: ringEl, pitchAlignment: 'map', rotationAlignment: 'map' })
      .setLngLat(start)
      .addTo(map);
    const pin = new mapboxgl.Marker({ element: pinEl, anchor: 'bottom' }).setLngLat(start).addTo(map);

    // You get the same treatment as the pet — ground rings pulsing outwards,
    // flat on the map — in blue, with the dot itself on top.
    const youAt: [number, number] = petLocation ? [petLocation.longitude, petLocation.latitude] : start;
    const youRingEl = document.createElement('div');
    youRingEl.style.pointerEvents = 'none';
    youRingEl.innerHTML =
      `<span class="tielo-ring" style="border-color:${YOU_BLUE}"></span>` +
      `<span class="tielo-ring tielo-ring--late" style="border-color:${YOU_BLUE}"></span>`;
    const youRings = new mapboxgl.Marker({
      element: youRingEl,
      pitchAlignment: 'map',
      rotationAlignment: 'map',
    }).setLngLat(youAt);

    const dotEl = document.createElement('div');
    dotEl.style.pointerEvents = 'none';
    dotEl.setAttribute('aria-label', 'Your location');
    dotEl.innerHTML = '<span class="tielo-you"></span>';
    const dot = new mapboxgl.Marker({ element: dotEl }).setLngLat(youAt);
    if (petLocation) {
      youRings.addTo(map);
      dot.addTo(map);
    }
    youDotRef.current = { dot, rings: youRings };

    // The pin sits above the pet's head, and both markers fade out once the pet
    // itself is big enough to see. They stay hidden until the pet has actually
    // been placed, so they never sit at a stale spot.
    let hidden = false;
    let positioned = false;
    let latitude = petLocation?.latitude ?? start[1];
    const place = () => {
      const metresPerPixel =
        (EARTH_CIRCUMFERENCE_M * Math.cos((latitude * Math.PI) / 180)) / (512 * 2 ** map.getZoom());
      const petPx = (PET_HEIGHT_M / metresPerPixel) * Math.sin((map.getPitch() * Math.PI) / 180);
      // No minimum: zoomed out the pet is sub-pixel, and the pin should point
      // at the spot itself rather than float above nothing.
      pin.setOffset([0, -Math.min(petPx, 140) - 6]);

      const next = !positioned || (hidden ? petPx > MARKERS_SHOW_BELOW_PX : petPx >= MARKERS_HIDE_ABOVE_PX);
      if (next !== hidden) {
        hidden = next;
        for (const el of fades) el.style.opacity = hidden ? '0' : '1';
      }
    };
    place();
    map.on('move', place);

    // Called from the render loop with the pet's wandering position, in scene
    // metres. Reporting back to React every frame would re-render the app 60
    // times a second, so that part is throttled.
    let lastReport = 0;
    petMarkersRef.current = {
      follow: (x, z) => {
        const origin = originRef.current;
        if (!origin) return;
        const scale = origin.meterInMercatorCoordinateUnits();
        const here = new mapboxgl.MercatorCoordinate(origin.x + x * scale, origin.y + z * scale, 0).toLngLat();
        latitude = here.lat;
        petLngLatRef.current = here;
        ring.setLngLat(here);
        pin.setLngLat(here);
        positioned = true;
        place();

        const report = onPetMoveRef.current;
        const user = userLocationRef.current;
        const now = Date.now();
        if (report && user && now - lastReport > 700) {
          lastReport = now;
          const at = { latitude: here.lat, longitude: here.lng };
          report({ location: at, distanceM: distanceBetween(user, at) });
        }
      },
    };

    const layer: CustomLayerInterface = {
      id: 'tielo-pet',
      type: 'custom',
      // The Standard style draws its own layers in slots; without this the pet
      // renders underneath the basemap.
      slot: 'top',
      renderingMode: '3d',
      onAdd(_map, gl) {
        scene.add(new THREE.HemisphereLight('#FFF7E6', '#9C8F7A', 2.4));
        const sun = new THREE.DirectionalLight('#FFFFFF', 2);
        sun.position.set(40, 120, -60);
        scene.add(sun, petGroup);
        renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
        renderer.autoClear = false;
      },
      render(_gl, matrix) {
        const dt = Math.min(clock.getDelta(), 0.1);
        mixer?.update(dt);

        // The pet wanders on its own; this is decoration, not state.
        const step = wander.update(dt);
        petGroup.position.set(step.x, step.y, step.z);
        petGroup.rotation.y = step.heading;
        fadeTo(step.moving ? 'Move' : 'Idle');
        petMarkersRef.current?.follow(step.x, step.z);
        const model = new THREE.Matrix4()
          .makeTranslation(origin.x, origin.y, origin.z)
          .scale(new THREE.Vector3(metersToMerc, -metersToMerc, metersToMerc))
          .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
        camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix).multiply(model);
        camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
        renderer.resetState();
        // Pass 1 — the x-ray silhouette, drawn only where the basemap is in
        // front of the pet. It runs first, while the depth buffer still holds
        // just the map: after pass 2 the buffer holds the pet itself, and the
        // model's own back faces would x-ray over its front.
        scene.overrideMaterial = ghostMaterial;
        renderer.render(scene, camera);
        scene.overrideMaterial = null;
        // Pass 2 — the real pet, depth-tested, so buildings still hide whatever
        // is genuinely behind them and the silhouette shows through instead.
        renderer.render(scene, camera);
        map.triggerRepaint();
      },
    };

    map.on('style.load', () => map.addLayer(layer));
    const report = () => {
      const b = map.getBounds();
      if (b) onBoundsChange?.({ west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() });
    };
    map.on('load', report);
    map.on('moveend', report);
    // A tap on the map itself (markers stop propagation) closes the panel.
    map.on('click', () => onMapPressRef.current?.());

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();
      placeMarkersRef.current.forEach((m) => m.remove());
      placeMarkersRef.current.clear();
      map.off('move', place);
      petMarkersRef.current = null;
      youDotRef.current = null;
      markerElsRef.current = null;
      map.remove();
      mapRef.current = null;
      petRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The pet wanders around wherever you are, so a location fix moves its home
  // rather than the pet itself.
  useEffect(() => {
    const origin = originRef.current;
    if (!pet || !petRef.current || !origin) return;
    petRef.current.setSpecies(pet.species);
    if (!petLocation) return;
    const here = mapboxgl.MercatorCoordinate.fromLngLat([petLocation.longitude, petLocation.latitude], 0);
    const scale = origin.meterInMercatorCoordinateUnits();
    const x = (here.x - origin.x) / scale;
    const z = (here.y - origin.y) / scale;
    // Snap on the first fix so the pet starts beside you, then let it roam.
    petRef.current.setHome(x, z, !startedRef.current);
    startedRef.current = true;
  }, [pet, petLocation]);

  // Recolour the markers when the theme flips, without rebuilding them.
  useEffect(() => {
    const els = markerElsRef.current;
    if (!els) return;
    for (const ring of els.rings) ring.style.borderColor = theme.primary;
    els.pin.style.background = theme.primary;
    els.pin.style.borderColor = theme.surface;
  }, [theme.primary, theme.surface]);

  // Blue dot follows your location fixes (the marker itself is built with the map).
  useEffect(() => {
    const map = mapRef.current;
    const you = youDotRef.current;
    if (!map || !you || !petLocation) return;
    const at: [number, number] = [petLocation.longitude, petLocation.latitude];
    you.rings.setLngLat(at).addTo(map);
    you.dot.setLngLat(at).addTo(map);
  }, [petLocation]);

  // Recentre when the caller's centre changes (e.g. after a location fix).
  useEffect(() => {
    if (center) mapRef.current?.easeTo({ center: [center.longitude, center.latitude], duration: 800 });
  }, [center]);

  // Post markers: the post's image is the marker.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set<string>();
    for (const post of posts) {
      seen.add(post.id);
      if (markersRef.current.has(post.id)) continue;
      const el = document.createElement('button');
      el.setAttribute('aria-label', `Post by ${post.petName}`);
      el.style.cssText = `width:52px;height:52px;border-radius:50%;border:3px solid ${theme.surface};background:${theme.primarySoft} center/cover no-repeat;cursor:pointer;box-shadow:0 4px 10px rgba(43,31,22,0.25);padding:0`;
      // Markers are 52px: the first photo's thumbnail, not the full card image.
      const icon = post.media[0]?.thumbUrl ?? post.media[0]?.url;
      if (icon) el.style.backgroundImage = `url(${icon})`;
      else el.textContent = post.petName.slice(0, 1).toUpperCase();
      el.onclick = (event) => {
        // Keep this off the map, or selecting a post would immediately deselect it.
        event.stopPropagation();
        onSelectPost?.(post);
      };
      markersRef.current.set(
        post.id,
        new mapboxgl.Marker({ element: el }).setLngLat([post.longitude, post.latitude]).addTo(map),
      );
    }
    // Drop markers for posts no longer in view.
    for (const [id, marker] of markersRef.current) {
      if (!seen.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    }
  }, [posts, onSelectPost, theme.primarySoft, theme.surface]);

  /**
   * Place markers: deliberately small, flat and label-led, so a venue can never
   * be mistaken for a post. Posts are 52px photographs; these are pills.
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set<string>();
    for (const place of places) {
      seen.add(place.id);
      if (placeMarkersRef.current.has(place.id)) continue;
      const el = document.createElement('button');
      el.setAttribute('aria-label', `See what's happening at ${place.name}`);
      const accent = place.isHotspot ? theme.primary : theme.surface;
      const ink = place.isHotspot ? theme.onPrimary : theme.text;
      el.style.cssText = `display:flex;align-items:center;gap:5px;max-width:150px;padding:5px 10px;border-radius:999px;border:1.5px solid ${theme.line};background:${accent};color:${ink};font:600 12px/1.2 system-ui,sans-serif;cursor:pointer;box-shadow:0 2px 6px rgba(43,31,22,0.18);white-space:nowrap;overflow:hidden;text-overflow:ellipsis`;
      // A 22px thumbnail inside the pill. Posts are 52px photo circles; keeping
      // places pill-shaped and label-led is what stops the two being confused.
      if (place.photo) {
        const img = document.createElement('span');
        img.style.cssText = `flex:0 0 auto;width:22px;height:22px;border-radius:50%;background:${theme.backgroundElement} center/cover no-repeat;background-image:url(${place.photo.thumbUrl})`;
        el.appendChild(img);
      }
      const label = document.createElement('span');
      label.style.cssText = 'overflow:hidden;text-overflow:ellipsis';
      label.textContent = place.name;
      el.appendChild(label);
      el.onclick = (event) => {
        event.stopPropagation();
        onSelectPlace?.(place);
      };
      placeMarkersRef.current.set(
        place.id,
        new mapboxgl.Marker({ element: el }).setLngLat([place.longitude, place.latitude]).addTo(map),
      );
    }
    for (const [id, marker] of placeMarkersRef.current) {
      if (!seen.has(id)) {
        marker.remove();
        placeMarkersRef.current.delete(id);
      }
    }
  }, [places, onSelectPlace, theme.backgroundElement, theme.line, theme.onPrimary, theme.primary, theme.surface, theme.text]);

  if (!MAPBOX_TOKEN) return <MissingToken />;
  // react-native-web renders this View as a div; the map fills it.
  return <View style={styles.fill} ref={hostRef as never} />;
}

function MissingToken() {
  return (
    <View style={[styles.fill, styles.center]}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.message}>
        Add EXPO_PUBLIC_MAPBOX_TOKEN to apps/mobile/.env.local to show the map.
      </ThemedText>
    </View>
  );
}

export type { MapPost };

const styles = StyleSheet.create({
  fill: { flex: 1, overflow: 'hidden' },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  message: { textAlign: 'center', maxWidth: 320 },
});
