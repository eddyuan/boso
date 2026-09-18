"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import mapboxgl, { type CustomLayerInterface } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { getPetSpecies } from "@bsocial/shared";
import { SPECIES, modelUrl } from "./model-viewer";

const START: [number, number] = [-79.3839, 43.6524]; // Nathan Phillips Square, Toronto (open plaza)
const PET_HEIGHT_M = 10; // exaggerated so it's visible at street zoom
const FLY_SPEED_MPS = 22;
const GROUND_SPEED_MPS = 9; // running, not flying
const CRUISE_ALTITUDE_M = 9; // flight height above the ground
const LANDING_DISTANCE_M = 30; // start gliding down this far from the target
const CLIMB_RATE = 3; // how quickly altitude eases toward its goal
const TURN_RATE = 8; // radians/sec toward heading
const EARTH_CIRCUMFERENCE_M = 40075016.686;
// Screen height of the pet (px) at which the pin and ring fade out; two values
// so hovering at the threshold doesn't flicker. Mirrors the app's map.
const MARKERS_HIDE_ABOVE_PX = 36;
const MARKERS_SHOW_BELOW_PX = 28;
const MARKER_STYLE_ID = "tielo-pet-marker";

/** Keyframes for the pin and ground ring; injected once (see map-view.web.tsx). */
function ensureMarkerStyles() {
  if (document.getElementById(MARKER_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = MARKER_STYLE_ID;
  style.textContent = `
.tielo-fade{transition:opacity .25s ease}
.tielo-ring{position:absolute;left:0;top:0;width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:50%;border:3px solid #FFC53D;opacity:0;animation:tielo-ring 2.4s ease-out infinite}
.tielo-ring--late{animation-delay:1.2s}
@keyframes tielo-ring{0%{transform:scale(.4);opacity:.85}70%{opacity:.18}100%{transform:scale(1.15);opacity:0}}
.tielo-bob{display:block;animation:tielo-bob 1.8s ease-in-out infinite}
@keyframes tielo-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
.tielo-pin{display:block;width:22px;height:22px;border-radius:50% 50% 50% 0;border:3px solid #FFFDF8;background:#FFC53D;transform:rotate(-45deg);box-shadow:0 3px 8px rgba(43,31,22,.3)}
@media (prefers-reduced-motion: reduce){.tielo-ring,.tielo-bob{animation:none}.tielo-ring{opacity:.5}}
`;
  document.head.appendChild(style);
}

/**
 * Renders the glTF mascot inside Mapbox GL JS via a three.js custom layer.
 * The three.js scene uses local meters around a fixed origin:
 * +X = east, +Y = up, +Z = south (see the model matrix in render()).
 */
export function MapWalker({ token }: { token: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("Loading…");
  // ?species= picks which companion walks the map. Read through the router hook
  // so the server and client agree — reading window during render leaves the
  // switcher showing the default while a different model is actually loaded.
  const species = useSearchParams().get("species") ?? "cockatiel";

  useEffect(() => {
    if (!token) return;
    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: hostRef.current!,
      style: "mapbox://styles/mapbox/standard",
      center: START,
      zoom: 18,
      pitch: 62,
      bearing: -20,
      antialias: true,
    });

    const origin = mapboxgl.MercatorCoordinate.fromLngLat(START, 0);
    const metersToMerc = origin.meterInMercatorCoordinateUnits();

    ensureMarkerStyles();
    // Mapbox owns the marker root's opacity (terrain occlusion), so the
    // show/hide fade goes on an inner wrapper.
    const ringEl = document.createElement("div");
    ringEl.style.pointerEvents = "none";
    ringEl.innerHTML = `<div class="tielo-fade"><span class="tielo-ring"></span><span class="tielo-ring tielo-ring--late"></span></div>`;
    const pinEl = document.createElement("div");
    pinEl.style.pointerEvents = "none";
    pinEl.innerHTML = `<div class="tielo-fade"><span class="tielo-bob"><span class="tielo-pin"></span></span></div>`;
    const fades = [ringEl.firstElementChild as HTMLElement, pinEl.firstElementChild as HTMLElement];
    // The ring lies flat on the ground; the pin stays upright facing the camera.
    const ring = new mapboxgl.Marker({
      element: ringEl,
      pitchAlignment: "map",
      rotationAlignment: "map",
    })
      .setLngLat(START)
      .addTo(map);
    const pin = new mapboxgl.Marker({ element: pinEl, anchor: "bottom" }).setLngLat(START).addTo(map);
    let markersHidden = false;

    /** Keep the markers under the pet as it flies, and hide them up close. */
    const placeMarkers = () => {
      const here = new mapboxgl.MercatorCoordinate(
        origin.x + pet.position.x * metersToMerc,
        origin.y + pet.position.z * metersToMerc,
        0,
      ).toLngLat();
      ring.setLngLat(here);
      pin.setLngLat(here);

      const metresPerPixel =
        (EARTH_CIRCUMFERENCE_M * Math.cos((here.lat * Math.PI) / 180)) / (512 * 2 ** map.getZoom());
      // Clear the pet's head, which is its altitude plus its own height.
      const petPx =
        ((pet.position.y + PET_HEIGHT_M) / metresPerPixel) * Math.sin((map.getPitch() * Math.PI) / 180);
      pin.setOffset([0, -Math.min(petPx, 140) - 6]);

      const next = markersHidden ? petPx > MARKERS_SHOW_BELOW_PX : petPx >= MARKERS_HIDE_ABOVE_PX;
      if (next !== markersHidden) {
        markersHidden = next;
        for (const el of fades) el.style.opacity = markersHidden ? "0" : "1";
      }
    };

    // Only a bird takes off; everything else keeps its feet on the ground and
    // simply runs, hops or trots there.
    const flies = getPetSpecies(species).moves === "Flies";

    const pet = new THREE.Group();
    pet.scale.setScalar(PET_HEIGHT_M);
    const target = new THREE.Vector3();
    let moving = false;
    let landing = false;
    let mixer: THREE.AnimationMixer | null = null;
    const actions: Record<string, THREE.AnimationAction> = {};
    let current: THREE.AnimationAction | undefined;

    const fadeTo = (name: string, once = false) => {
      const next = actions[name];
      if (!next || next === current) return;
      next.reset();
      if (once) {
        next.setLoop(THREE.LoopOnce, 1);
        next.clampWhenFinished = true;
      } else {
        next.setLoop(THREE.LoopRepeat, Infinity);
      }
      next.play();
      current?.crossFadeTo(next, 0.15, false);
      current = next;
    };

    let renderer: THREE.WebGLRenderer;
    const camera = new THREE.Camera();
    const scene = new THREE.Scene();
    const clock = new THREE.Clock();
    // Silhouette shown where the basemap hides the pet (see render()).
    const ghostMaterial = new THREE.MeshBasicMaterial({
      color: "#FFC53D",
      transparent: true,
      opacity: 0.5,
      depthFunc: THREE.GreaterDepth,
      depthWrite: false,
    });

    const layer: CustomLayerInterface = {
      id: "mascot-3d",
      type: "custom",
      renderingMode: "3d",
      onAdd(_map, gl) {
        scene.add(new THREE.HemisphereLight("#FFF7E6", "#9C8F7A", 2.4));
        const sun = new THREE.DirectionalLight("#FFFFFF", 2);
        sun.position.set(40, 120, -60);
        scene.add(sun);
        scene.add(pet);

        new GLTFLoader().load(modelUrl(species), (gltf) => {
          pet.add(gltf.scene);
          mixer = new THREE.AnimationMixer(gltf.scene);
          for (const clip of gltf.animations) actions[clip.name] = mixer.clipAction(clip);
          mixer.addEventListener("finished", () => !moving && !landing && fadeTo("Idle"));
          fadeTo("Idle");
          setStatus(flies ? "Click the map to fly the pet there" : "Click the map to send the pet there");
        });

        renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
        renderer.autoClear = false;
      },
      render(_gl, matrix) {
        const dt = Math.min(clock.getDelta(), 0.1);

        if (moving) {
          const toTarget = new THREE.Vector3(target.x - pet.position.x, 0, target.z - pet.position.z);
          const distance = toTarget.length();
          // Face the direction of travel (model faces +Z).
          const desired = Math.atan2(toTarget.x, toTarget.z);
          let diff = desired - pet.rotation.y;
          diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          pet.rotation.y += diff * Math.min(1, TURN_RATE * dt);

          // Climb to cruise height after take-off, glide down near the target.
          const goalY = flies ? CRUISE_ALTITUDE_M * Math.min(1, distance / LANDING_DISTANCE_M) : 0;
          pet.position.y += (goalY - pet.position.y) * Math.min(1, CLIMB_RATE * dt);

          const step = (flies ? FLY_SPEED_MPS : GROUND_SPEED_MPS) * dt;
          if (distance <= step) {
            pet.position.set(target.x, pet.position.y, target.z);
            moving = false;
            landing = true;
            setStatus(flies ? "Landing…" : "Almost there…");
          } else {
            pet.position.add(toTarget.multiplyScalar(step / distance));
          }
        } else if (landing) {
          // Settle onto the ground, then look around.
          pet.position.y = Math.max(0, pet.position.y - FLY_SPEED_MPS * 0.4 * dt);
          if (pet.position.y === 0) {
            landing = false;
            fadeTo("Look", true);
            setStatus("Arrived");
          }
        }
        mixer?.update(dt);
        placeMarkers();

        const modelMatrix = new THREE.Matrix4()
          .makeTranslation(origin.x, origin.y, origin.z)
          .scale(new THREE.Vector3(metersToMerc, -metersToMerc, metersToMerc))
          .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
        camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix).multiply(modelMatrix);
        camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();

        renderer.resetState();
        // Two passes so a hidden pet reads as an x-ray silhouette instead of
        // vanishing behind buildings (see map-view.web.tsx for the details).
        scene.overrideMaterial = ghostMaterial;
        renderer.render(scene, camera);
        scene.overrideMaterial = null;
        renderer.render(scene, camera);
        map.triggerRepaint();
      },
    };

    map.on("style.load", () => map.addLayer(layer));

    map.on("click", (e) => {
      const m = mapboxgl.MercatorCoordinate.fromLngLat(e.lngLat, 0);
      target.set((m.x - origin.x) / metersToMerc, 0, (m.y - origin.y) / metersToMerc);
      const distance = Math.hypot(target.x - pet.position.x, target.z - pet.position.z);
      if (distance < 1) return;
      moving = true;
      landing = false;
      fadeTo(flies ? "Fly" : "Move");
      setStatus(`${flies ? "Flying" : "Running"} ${distance.toFixed(0)} m…`);
      map.easeTo({
        center: e.lngLat,
        duration: (distance / (flies ? FLY_SPEED_MPS : GROUND_SPEED_MPS)) * 1000,
        easing: (t) => t,
      });
    });

    return () => {
      ring.remove();
      pin.remove();
      map.remove();
    };
  }, [token, species]);

  if (!token) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <p className="max-w-md">
          Add <code className="rounded bg-[#F7EADA] px-1">NEXT_PUBLIC_MAPBOX_TOKEN</code> to{" "}
          <code className="rounded bg-[#F7EADA] px-1">apps/web/.env.local</code> and restart the dev server.
        </p>
      </div>
    );
  }

  return (
    <div className="absolute inset-0">
      {/* Inline size: mapbox-gl.css sets .mapboxgl-map { position: relative }, which
          overrides Tailwind's `absolute inset-0` and collapses the map to 0px tall. */}
      <div ref={hostRef} style={{ position: "absolute", inset: 0 }} />
      <div className="absolute top-3 right-3 flex gap-2">
        {SPECIES.map((name) => (
          <a
            key={name}
            href={`?tab=map&species=${name}`}
            className={`rounded-xl px-3 py-1.5 text-sm font-semibold shadow ${
              species === name ? "bg-[#2B1F16] text-white" : "bg-white/90 text-[#2B1F16]"
            }`}>
            {name}
          </a>
        ))}
      </div>
      <div className="absolute top-3 left-3 rounded-xl bg-white/90 px-3 py-1.5 text-sm font-semibold shadow">
        {status}
      </div>
    </div>
  );
}
