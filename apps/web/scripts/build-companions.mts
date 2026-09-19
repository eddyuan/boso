/**
 * Builds the Tielo companions (cockatiel, bunny, cat, chick) as glTF binaries
 * with animations, from three.js primitives. Mirrors the 2D design in
 * design/app-ui (MascotEmotions).
 *
 *   pnpm --filter @bsocial/web mascot:build
 *
 * Output: apps/web/public/models/{cockatiel-primitive,bunny,cat,chick}.glb and the same
 *         files under apps/mobile/assets/models/. The shipped cockatiel comes
 *         from scripts/rig-tripo-bird.mts instead.
 *
 * Scale: ~1 unit tall, feet at y = 0, facing +Z. Animation clips:
 *   Idle (loop), Hop (one hop, ~0.6s), Flap (wing flap, ~0.45s), Look (head tilt),
 *   Fly (loop, ~0.42s: flapping, leaning forward, feet tucked; altitude is up to the caller)
 *
 * The chick is a code-only reconstruction from a reference photo, authored with the
 * img2threejs skill's image-analysis discipline (identify → decompose → materials →
 * screenshot-verify against the reference) rather than its full photoreal-object JSON
 * spec schema, which is disproportionate for a flat-shaded toy this simple. It's a
 * dev/mascot demo entry only — not wired into onboarding's random-pet pool or the
 * pets.species enum.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

// GLTFExporter uses the browser FileReader API; Node has Blob but not FileReader.
class NodeFileReader {
  result: ArrayBuffer | string | null = null;
  onloadend: (() => void) | null = null;
  readAsArrayBuffer(blob: Blob) {
    blob.arrayBuffer().then((buf) => {
      this.result = buf;
      this.onloadend?.();
    });
  }
  readAsDataURL(blob: Blob) {
    blob.arrayBuffer().then((buf) => {
      this.result = `data:${blob.type || "application/octet-stream"};base64,${Buffer.from(buf).toString("base64")}`;
      this.onloadend?.();
    });
  }
}
(globalThis as unknown as { FileReader: typeof NodeFileReader }).FileReader = NodeFileReader;

// ---------------------------------------------------------------------------
// Palette (same as the 2D mascot)
// ---------------------------------------------------------------------------
const C = {
  body: "#FFD84D",
  deep: "#F2B72C",
  face: "#FFF7D6",
  cheek: "#FF8A4C",
  beak: "#F29C38",
  ink: "#2B1F16",
  feet: "#F49AB0",
  white: "#FFFFFF",
};

const mat = (color: string, roughness = 0.75) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, name: color });

const materials = {
  body: mat(C.body),
  deep: mat(C.deep),
  face: mat(C.face, 0.85),
  cheek: mat(C.cheek, 0.9),
  beak: mat(C.beak, 0.6),
  ink: mat(C.ink, 0.35),
  feet: mat(C.feet, 0.8),
  white: mat(C.white, 0.2),
};

// Chick: from a reference photo (round toy-plushie chick) via the img2threejs
// skill — see tmp/img2threejs-chick/ for the sculpt spec this was authored from.
const CHICK_C = {
  body: "#F5C94A",
  tuft: "#F8D874",
  face: "#FBF3E1",
  cheek: "#F2775A",
  beakLeg: "#E8875B",
  ink: "#2B1F16",
  white: "#FFFFFF",
};
const chickMaterials = {
  body: mat(CHICK_C.body, 0.6),
  tuft: mat(CHICK_C.tuft, 0.6),
  face: mat(CHICK_C.face, 0.75),
  cheek: mat(CHICK_C.cheek, 0.85),
  beakLeg: mat(CHICK_C.beakLeg, 0.55),
  ink: mat(CHICK_C.ink, 0.3),
  white: mat(CHICK_C.white, 0.2),
};

function mesh(name: string, geometry: THREE.BufferGeometry, material: THREE.Material) {
  const m = new THREE.Mesh(geometry, material);
  m.name = name;
  return m;
}

// Tube along a curve that tapers from `r0` at the base to `r1` at the tip.
function taperedTube(points: THREE.Vector3[], r0: number, r1: number, segments = 32, radial = 12) {
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, segments, 1, radial, false);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const center = curve.getPointAt(t);
    const radius = r0 + (r1 - r0) * t;
    for (let j = 0; j <= radial; j++) {
      const idx = i * (radial + 1) + j;
      v.fromBufferAttribute(pos, idx).sub(center).multiplyScalar(radius).add(center);
      pos.setXYZ(idx, v.x, v.y, v.z);
    }
  }
  geo.computeVertexNormals();
  // Round tip cap
  const tip = new THREE.SphereGeometry(r1, 12, 8);
  tip.translate(...curve.getPointAt(1).toArray());
  return { tube: geo, tip };
}

function buildCockatiel() {
  const root = new THREE.Group();
  root.name = "Cockatiel";

  // Everything that bobs/hops moves with `body`; feet stay planted.
  const body = new THREE.Group();
  body.name = "body";
  body.position.y = 0.52;
  root.add(body);

  // Round body
  const torsoGeo = new THREE.SphereGeometry(0.5, 48, 32);
  torsoGeo.scale(1, 0.96, 0.94);
  body.add(mesh("torso", torsoGeo, materials.body));

  // Face disc (front, slightly above center)
  const faceGeo = new THREE.SphereGeometry(0.36, 40, 24);
  faceGeo.scale(1, 0.8, 0.42);
  const face = mesh("face", faceGeo, materials.face);
  face.position.set(0, 0.08, 0.34);
  body.add(face);

  // Cheeks
  for (const side of [-1, 1]) {
    const g = new THREE.SphereGeometry(0.1, 24, 16);
    g.scale(1, 1, 0.45);
    const cheek = mesh(side < 0 ? "cheekL" : "cheekR", g, materials.cheek);
    cheek.position.set(0.26 * side, -0.01, 0.43);
    cheek.lookAt(cheek.position.clone().multiplyScalar(2));
    body.add(cheek);
  }

  // Eyes with highlights
  const eyes = new THREE.Group();
  eyes.name = "eyes";
  body.add(eyes);
  for (const side of [-1, 1]) {
    const eye = mesh(side < 0 ? "eyeL" : "eyeR", new THREE.SphereGeometry(0.068, 24, 16), materials.ink);
    eye.scale.z = 0.6;
    eye.position.set(0.13 * side, 0.13, 0.455);
    eyes.add(eye);
    const hl = mesh(side < 0 ? "eyeHighlightL" : "eyeHighlightR", new THREE.SphereGeometry(0.024, 12, 8), materials.white);
    hl.position.set(0.13 * side + 0.024, 0.155, 0.495);
    eyes.add(hl);
  }

  // Beak: a small downward-pointing cone
  const beakGeo = new THREE.ConeGeometry(0.055, 0.13, 20);
  beakGeo.rotateX(Math.PI); // point down
  const beak = mesh("beak", beakGeo, materials.beak);
  beak.position.set(0, 0.03, 0.5);
  beak.rotation.x = -0.35;
  body.add(beak);

  // Crest: pivot at the top of the head so it can bounce/sway
  const crest = new THREE.Group();
  crest.name = "crest";
  crest.position.set(0, 0.44, 0.02);
  body.add(crest);
  const feathers: [THREE.Vector3[], number, number, THREE.Material][] = [
    // big curl, sweeping forward over the face
    [[new THREE.Vector3(0.02, -0.04, -0.04), new THREE.Vector3(0.03, 0.14, -0.06), new THREE.Vector3(0.05, 0.28, 0.0), new THREE.Vector3(0.06, 0.32, 0.14), new THREE.Vector3(0.05, 0.24, 0.22)], 0.065, 0.024, materials.body],
    // smaller side feather
    [[new THREE.Vector3(-0.06, -0.04, -0.05), new THREE.Vector3(-0.1, 0.1, -0.08), new THREE.Vector3(-0.13, 0.2, -0.04), new THREE.Vector3(-0.12, 0.25, 0.04)], 0.045, 0.02, materials.deep],
    // tiny back feather
    [[new THREE.Vector3(0.08, -0.04, -0.08), new THREE.Vector3(0.13, 0.06, -0.12), new THREE.Vector3(0.16, 0.14, -0.1)], 0.035, 0.016, materials.body],
  ];
  feathers.forEach(([pts, r0, r1, m], i) => {
    const { tube, tip } = taperedTube(pts, r0, r1);
    crest.add(mesh(`crestFeather${i}`, tube, m), mesh(`crestTip${i}`, tip, m));
  });

  // Wings: pivot at the shoulder for flapping
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.name = side < 0 ? "wingL" : "wingR";
    pivot.position.set(0.4 * side, 0.08, -0.04);
    body.add(pivot);
    const g = new THREE.SphereGeometry(0.2, 32, 20);
    g.scale(0.36, 1, 0.8);
    g.translate(0.03 * side, -0.16, 0);
    const wing = mesh(side < 0 ? "wingMeshL" : "wingMeshR", g, materials.deep);
    wing.rotation.z = 0.18 * side;
    pivot.add(wing);
  }

  // Feet (planted on the ground)
  for (const side of [-1, 1]) {
    const foot = new THREE.Group();
    foot.name = side < 0 ? "footL" : "footR";
    foot.position.set(0.12 * side, 0, 0.06);
    root.add(foot);
    const leg = new THREE.CapsuleGeometry(0.025, 0.08, 4, 10);
    leg.translate(0, 0.07, 0);
    foot.add(mesh(`leg${side < 0 ? "L" : "R"}`, leg, materials.feet));
    for (const toe of [-0.5, 0, 0.5]) {
      const tg = new THREE.CapsuleGeometry(0.018, 0.06, 4, 8);
      tg.rotateX(Math.PI / 2);
      tg.translate(0, 0.018, 0.045);
      const t = mesh(`toe${side < 0 ? "L" : "R"}${toe}`, tg, materials.feet);
      t.rotation.y = toe;
      foot.add(t);
    }
  }

  return root;
}

function buildChick() {
  const m = chickMaterials;
  const root = new THREE.Group();
  root.name = "Chick";

  const body = new THREE.Group();
  body.name = "body";
  body.position.y = 0.5;
  root.add(body);

  // One continuous ball for body+head — the reference shows no neck break.
  const torsoGeo = new THREE.SphereGeometry(0.5, 48, 32);
  torsoGeo.scale(1, 1.0, 0.98);
  body.add(mesh("torso", torsoGeo, m.body));

  // Face disc: large, flattened, inset into the front of the sphere.
  const faceGeo = new THREE.SphereGeometry(0.4, 40, 24);
  faceGeo.scale(1, 0.92, 0.32);
  const face = mesh("face", faceGeo, m.face);
  face.position.set(0, 0.02, 0.36);
  body.add(face);

  // Big cheek blushes — the dominant identity feature after the eyes.
  for (const side of [-1, 1]) {
    const g = new THREE.SphereGeometry(0.13, 24, 16);
    g.scale(1, 1, 0.35);
    const cheek = mesh(side < 0 ? "cheekL" : "cheekR", g, m.cheek);
    cheek.position.set(0.24 * side, -0.08, 0.42);
    cheek.lookAt(cheek.position.clone().multiplyScalar(2));
    body.add(cheek);
  }

  // Big glossy eyes with an offset catchlight.
  const eyes = new THREE.Group();
  eyes.name = "eyes";
  body.add(eyes);
  for (const side of [-1, 1]) {
    const eye = mesh(side < 0 ? "eyeL" : "eyeR", new THREE.SphereGeometry(0.088, 24, 16), m.ink);
    eye.scale.z = 0.55;
    eye.position.set(0.15 * side, 0.09, 0.46);
    eyes.add(eye);
    const hl = mesh(side < 0 ? "eyeHighlightL" : "eyeHighlightR", new THREE.SphereGeometry(0.03, 12, 8), m.white);
    hl.position.set(0.15 * side + 0.03, 0.12, 0.5);
    eyes.add(hl);
  }

  // Beak: a flattened, squat sphere rather than a cone — a cone's flat triangular
  // facets catch the key light as a hard-edged highlight and read as a paper dart,
  // where the reference shows a soft rounded toy beak. The back half embeds into
  // the face disc, which is fine — it's never visible. Plus a thin mouth-line groove.
  const beakGeo = new THREE.SphereGeometry(0.075, 24, 16);
  beakGeo.scale(1, 0.62, 0.75);
  const beak = mesh("beak", beakGeo, m.beakLeg);
  beak.position.set(0, -0.02, 0.5);
  body.add(beak);
  const mouthLine = mesh("mouthLine", new THREE.BoxGeometry(0.045, 0.007, 0.01), m.ink);
  mouthLine.position.set(0, -0.062, 0.565);
  body.add(mouthLine);

  // Head tuft: three rounded lobes, centre tallest, sides shorter and splayed.
  const tuft = new THREE.Group();
  tuft.name = "tuft";
  tuft.position.set(0, 0.46, 0.02);
  body.add(tuft);
  const lobes: [THREE.Vector3[], number, number][] = [
    [[new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.16, -0.01), new THREE.Vector3(0, 0.32, 0)], 0.06, 0.045],
    [[new THREE.Vector3(-0.07, 0, -0.01), new THREE.Vector3(-0.1, 0.12, -0.02), new THREE.Vector3(-0.12, 0.22, -0.01)], 0.05, 0.035],
    [[new THREE.Vector3(0.07, 0, -0.01), new THREE.Vector3(0.1, 0.12, -0.02), new THREE.Vector3(0.12, 0.22, -0.01)], 0.05, 0.035],
  ];
  lobes.forEach(([pts, r0, r1], i) => {
    const { tube, tip } = taperedTube(pts, r0, r1, 24, 10);
    tuft.add(mesh(`tuftLobe${i}`, tube, m.tuft), mesh(`tuftTip${i}`, tip, m.tuft));
  });

  // Wing nubs — small and mostly tucked against the body, matching the reference's
  // thin frontal slivers rather than the cockatiel's fuller spread wings.
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.name = side < 0 ? "wingL" : "wingR";
    pivot.position.set(0.44 * side, 0.0, -0.02);
    body.add(pivot);
    const g = new THREE.SphereGeometry(0.13, 24, 16);
    g.scale(0.32, 0.85, 0.6);
    g.translate(0.03 * side, -0.06, 0);
    const wing = mesh(side < 0 ? "wingMeshL" : "wingMeshR", g, m.body);
    wing.rotation.z = 0.12 * side;
    pivot.add(wing);
  }

  // Short stub legs and feet — no distinct toes visible in the reference.
  for (const side of [-1, 1]) {
    const foot = new THREE.Group();
    foot.name = side < 0 ? "footL" : "footR";
    foot.position.set(0.14 * side, 0, 0.02);
    root.add(foot);
    const leg = new THREE.CapsuleGeometry(0.028, 0.05, 4, 10);
    leg.translate(0, 0.045, 0);
    foot.add(mesh(`leg${side < 0 ? "L" : "R"}`, leg, m.beakLeg));
    const toeball = new THREE.SphereGeometry(0.032, 16, 12);
    toeball.scale(1.3, 0.6, 1.5);
    toeball.translate(0, 0.014, 0.02);
    foot.add(mesh(`foot${side < 0 ? "L" : "R"}Mesh`, toeball, m.beakLeg));
  }

  return root;
}

// ---------------------------------------------------------------------------
// Animations (TRS tracks only, so they survive glTF export)
// ---------------------------------------------------------------------------
const q = (x: number, y: number, z: number) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z)).toArray();
const flat = (arr: number[][]) => arr.flat();

function buildAnimations() {
  const BODY_Y = 0.52;

  const idle = new THREE.AnimationClip("Idle", 2, [
    new THREE.VectorKeyframeTrack("body.position", [0, 1, 2], [0, BODY_Y, 0, 0, BODY_Y + 0.025, 0, 0, BODY_Y, 0]),
    new THREE.VectorKeyframeTrack("body.scale", [0, 1, 2], [1, 1, 1, 0.99, 1.02, 0.99, 1, 1, 1]),
    new THREE.QuaternionKeyframeTrack("crest.quaternion", [0, 0.7, 1.4, 2], flat([q(0, 0, 0), q(-0.08, 0, 0.05), q(0.04, 0, -0.04), q(0, 0, 0)])),
    new THREE.QuaternionKeyframeTrack("wingL.quaternion", [0, 1, 2], flat([q(0, 0, 0), q(0, 0, -0.06), q(0, 0, 0)])),
    new THREE.QuaternionKeyframeTrack("wingR.quaternion", [0, 1, 2], flat([q(0, 0, 0), q(0, 0, 0.06), q(0, 0, 0)])),
  ]);

  // Squash, leap, stretch, land, settle. Played repeatedly while walking.
  const t = [0, 0.1, 0.3, 0.5, 0.6];
  const hop = new THREE.AnimationClip("Hop", 0.6, [
    new THREE.VectorKeyframeTrack("body.position", t, flat([[0, BODY_Y - 0.04, 0], [0, BODY_Y + 0.02, 0], [0, BODY_Y + 0.28, 0], [0, BODY_Y - 0.05, 0], [0, BODY_Y, 0]])),
    new THREE.VectorKeyframeTrack("body.scale", t, flat([[1.1, 0.9, 1.1], [0.92, 1.1, 0.92], [0.97, 1.04, 0.97], [1.12, 0.88, 1.12], [1, 1, 1]])),
    new THREE.QuaternionKeyframeTrack("wingL.quaternion", t, flat([q(0, 0, 0), q(0, 0, -0.9), q(0, 0, -0.3), q(0, 0, -0.6), q(0, 0, 0)])),
    new THREE.QuaternionKeyframeTrack("wingR.quaternion", t, flat([q(0, 0, 0), q(0, 0, 0.9), q(0, 0, 0.3), q(0, 0, 0.6), q(0, 0, 0)])),
    new THREE.QuaternionKeyframeTrack("crest.quaternion", t, flat([q(0, 0, 0), q(0.25, 0, 0), q(-0.2, 0, 0), q(0.15, 0, 0), q(0, 0, 0)])),
    new THREE.VectorKeyframeTrack("footL.position", t, flat([[-0.12, 0, 0.06], [-0.12, 0.02, 0.06], [-0.12, 0.26, 0.06], [-0.12, 0, 0.06], [-0.12, 0, 0.06]])),
    new THREE.VectorKeyframeTrack("footR.position", t, flat([[0.12, 0, 0.06], [0.12, 0.02, 0.06], [0.12, 0.26, 0.06], [0.12, 0, 0.06], [0.12, 0, 0.06]])),
  ]);

  const ft = [0, 0.11, 0.22, 0.34, 0.45];
  const flap = new THREE.AnimationClip("Flap", 0.45, [
    new THREE.QuaternionKeyframeTrack("wingL.quaternion", ft, flat([q(0, 0, 0), q(0, 0, -1.2), q(0, 0, -0.2), q(0, 0, -1.1), q(0, 0, 0)])),
    new THREE.QuaternionKeyframeTrack("wingR.quaternion", ft, flat([q(0, 0, 0), q(0, 0, 1.2), q(0, 0, 0.2), q(0, 0, 1.1), q(0, 0, 0)])),
    new THREE.VectorKeyframeTrack("body.position", ft, flat([[0, BODY_Y, 0], [0, BODY_Y + 0.05, 0], [0, BODY_Y + 0.02, 0], [0, BODY_Y + 0.05, 0], [0, BODY_Y, 0]])),
  ]);

  const lt = [0, 0.4, 1.0, 1.4];
  const look = new THREE.AnimationClip("Look", 1.4, [
    new THREE.QuaternionKeyframeTrack("body.quaternion", lt, flat([q(0, 0, 0), q(0, 0.35, 0.18), q(0, 0.35, 0.18), q(0, 0, 0)])),
  ]);

  // Flight pose on a loop: big fast wingbeats, body pitched forward, crest swept
  // back, feet tucked up. Height above ground is driven by the caller.
  const FLY = 0.42;
  const wt = [0, FLY * 0.25, FLY * 0.5, FLY * 0.75, FLY];
  const lean = 0.42;
  const fly = new THREE.AnimationClip("Fly", FLY, [
    new THREE.QuaternionKeyframeTrack("wingL.quaternion", wt, flat([q(0, 0.1, -1.5), q(0, -0.05, -0.55), q(0, -0.15, 0.35), q(0, -0.05, -0.55), q(0, 0.1, -1.5)])),
    new THREE.QuaternionKeyframeTrack("wingR.quaternion", wt, flat([q(0, -0.1, 1.5), q(0, 0.05, 0.55), q(0, 0.15, -0.35), q(0, 0.05, 0.55), q(0, -0.1, 1.5)])),
    // Lift on the downstroke, sink on the upstroke.
    new THREE.VectorKeyframeTrack("body.position", wt, flat([[0, BODY_Y - 0.02, 0], [0, BODY_Y + 0.03, 0], [0, BODY_Y + 0.05, 0], [0, BODY_Y + 0.01, 0], [0, BODY_Y - 0.02, 0]])),
    new THREE.QuaternionKeyframeTrack("body.quaternion", wt, flat([q(lean, 0, 0), q(lean - 0.04, 0, 0), q(lean + 0.03, 0, 0), q(lean - 0.02, 0, 0), q(lean, 0, 0)])),
    new THREE.VectorKeyframeTrack("body.scale", wt, flat([[1, 1, 1], [0.98, 1.03, 0.98], [1.02, 0.97, 1.02], [0.99, 1.01, 0.99], [1, 1, 1]])),
    new THREE.QuaternionKeyframeTrack("crest.quaternion", wt, flat([q(-0.95, 0, 0), q(-1.02, 0, 0.05), q(-0.9, 0, 0), q(-1.02, 0, -0.05), q(-0.95, 0, 0)])),
    // Feet pulled up under the body and trailing back.
    new THREE.VectorKeyframeTrack("footL.position", [0, FLY], flat([[-0.1, 0.2, -0.12], [-0.1, 0.2, -0.12]])),
    new THREE.VectorKeyframeTrack("footR.position", [0, FLY], flat([[0.1, 0.2, -0.12], [0.1, 0.2, -0.12]])),
    new THREE.QuaternionKeyframeTrack("footL.quaternion", [0, FLY], flat([q(1.1, 0, 0), q(1.1, 0, 0)])),
    new THREE.QuaternionKeyframeTrack("footR.quaternion", [0, FLY], flat([q(1.1, 0, 0), q(1.1, 0, 0)])),
  ]);

  return [idle, hop, flap, look, fly];
}

// ---------------------------------------------------------------------------
// Bunny and cat, in the same chubby style (see design/app-ui, Create pet)
// ---------------------------------------------------------------------------
type Palette = { body: string; deep: string; light: string; cheek: string; nose: string; ink: string; feet: string };

const BUNNY: Palette = { body: "#E9C9A1", deep: "#D6AE7F", light: "#FFF4E3", cheek: "#FF9AAE", nose: "#E8798F", ink: "#2B1F16", feet: "#F4D9BD" };
const CAT: Palette = { body: "#A9B3C4", deep: "#8C97AA", light: "#F4F1EC", cheek: "#FF9AAE", nose: "#E8798F", ink: "#2B1F16", feet: "#F4F1EC" };

function paletteMaterials(p: Palette) {
  return {
    body: mat(p.body),
    deep: mat(p.deep),
    light: mat(p.light, 0.85),
    cheek: mat(p.cheek, 0.9),
    nose: mat(p.nose, 0.6),
    ink: mat(p.ink, 0.35),
    feet: mat(p.feet, 0.8),
    white: mat("#FFFFFF", 0.2),
  };
}

// Shared chubby body: torso, muzzle patch, eyes, cheeks, feet.
function buildCreature(name: string, p: Palette) {
  const m = paletteMaterials(p);
  const root = new THREE.Group();
  root.name = name;

  const body = new THREE.Group();
  body.name = "body";
  body.position.y = 0.52;
  root.add(body);

  const torso = new THREE.SphereGeometry(0.5, 48, 32);
  torso.scale(1, 0.96, 0.94);
  body.add(mesh("torso", torso, m.body));

  const belly = new THREE.SphereGeometry(0.34, 36, 24);
  belly.scale(1, 0.78, 0.5);
  const bellyMesh = mesh("belly", belly, m.light);
  bellyMesh.position.set(0, -0.08, 0.3);
  body.add(bellyMesh);

  const muzzle = new THREE.SphereGeometry(0.2, 32, 20);
  muzzle.scale(1.05, 0.72, 0.5);
  const muzzleMesh = mesh("muzzle", muzzle, m.light);
  muzzleMesh.position.set(0, 0.02, 0.42);
  body.add(muzzleMesh);

  for (const side of [-1, 1]) {
    const eye = mesh(side < 0 ? "eyeL" : "eyeR", new THREE.SphereGeometry(0.07, 24, 16), m.ink);
    eye.scale.z = 0.6;
    eye.position.set(0.15 * side, 0.16, 0.45);
    body.add(eye);
    const hl = mesh(side < 0 ? "eyeHighlightL" : "eyeHighlightR", new THREE.SphereGeometry(0.024, 12, 8), m.white);
    hl.position.set(0.15 * side + 0.025, 0.185, 0.485);
    body.add(hl);

    const cheekGeo = new THREE.SphereGeometry(0.1, 24, 16);
    cheekGeo.scale(1, 1, 0.45);
    const cheek = mesh(side < 0 ? "cheekL" : "cheekR", cheekGeo, m.cheek);
    cheek.position.set(0.28 * side, 0.01, 0.4);
    body.add(cheek);
  }

  const nose = new THREE.ConeGeometry(0.05, 0.07, 16);
  nose.rotateX(Math.PI);
  const noseMesh = mesh("nose", nose, m.nose);
  noseMesh.position.set(0, 0.06, 0.58);
  body.add(noseMesh);

  for (const side of [-1, 1]) {
    const foot = new THREE.Group();
    foot.name = side < 0 ? "footL" : "footR";
    foot.position.set(0.16 * side, 0, 0.12);
    root.add(foot);
    const g = new THREE.SphereGeometry(0.12, 24, 16);
    g.scale(0.8, 0.45, 1.1);
    g.translate(0, 0.05, 0);
    foot.add(mesh(`footMesh${side < 0 ? "L" : "R"}`, g, m.feet));
  }

  return { root, body, m };
}

function buildBunny() {
  const { root, body, m } = buildCreature("Bunny", BUNNY);

  // Long ears on their own pivots so they can flop while hopping.
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.name = side < 0 ? "earL" : "earR";
    pivot.position.set(0.16 * side, 0.4, -0.02);
    body.add(pivot);
    const outer = taperedTube(
      [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0.03 * side, 0.22, -0.04),
        new THREE.Vector3(0.05 * side, 0.44, -0.04),
        new THREE.Vector3(0.04 * side, 0.6, 0.0),
      ],
      0.1,
      0.05,
    );
    pivot.add(mesh(`earOuter${side < 0 ? "L" : "R"}`, outer.tube, m.body), mesh(`earTip${side < 0 ? "L" : "R"}`, outer.tip, m.body));
    const inner = taperedTube(
      [
        new THREE.Vector3(0, 0.05, 0.04),
        new THREE.Vector3(0.03 * side, 0.24, 0.01),
        new THREE.Vector3(0.045 * side, 0.46, 0.01),
        new THREE.Vector3(0.04 * side, 0.56, 0.04),
      ],
      0.06,
      0.03,
    );
    pivot.add(mesh(`earInner${side < 0 ? "L" : "R"}`, inner.tube, m.cheek));
  }

  const tail = mesh("tail", new THREE.SphereGeometry(0.13, 24, 16), m.light);
  tail.position.set(0, -0.12, -0.48);
  body.add(tail);

  return root;
}

function buildCat() {
  const { root, body, m } = buildCreature("Cat", CAT);

  // Triangular ears with pink inners.
  for (const side of [-1, 1]) {
    const ear = new THREE.Group();
    ear.name = side < 0 ? "earL" : "earR";
    ear.position.set(0.26 * side, 0.4, 0);
    ear.rotation.z = -0.35 * side;
    body.add(ear);
    const outer = new THREE.ConeGeometry(0.16, 0.3, 4);
    outer.rotateY(Math.PI / 4);
    outer.translate(0, 0.14, 0);
    ear.add(mesh(`earOuter${side < 0 ? "L" : "R"}`, outer, m.body));
    const inner = new THREE.ConeGeometry(0.09, 0.2, 4);
    inner.rotateY(Math.PI / 4);
    inner.translate(0, 0.13, 0.04);
    ear.add(mesh(`earInner${side < 0 ? "L" : "R"}`, inner, m.cheek));
  }

  // Tail on a pivot so it can sway.
  const tailPivot = new THREE.Group();
  tailPivot.name = "tail";
  tailPivot.position.set(0, -0.12, -0.44);
  body.add(tailPivot);
  const tail = taperedTube(
    [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0.1, -0.22),
      new THREE.Vector3(0.02, 0.32, -0.3),
      new THREE.Vector3(0.04, 0.5, -0.2),
    ],
    0.09,
    0.05,
  );
  tailPivot.add(mesh("tailMesh", tail.tube, m.deep), mesh("tailTip", tail.tip, m.light));

  // Muzzle details: whisker pads.
  for (const side of [-1, 1]) {
    const pad = new THREE.SphereGeometry(0.08, 20, 14);
    pad.scale(1, 0.75, 0.5);
    const padMesh = mesh(side < 0 ? "whiskerPadL" : "whiskerPadR", pad, m.light);
    padMesh.position.set(0.09 * side, 0.0, 0.52);
    body.add(padMesh);
  }

  return root;
}

// ---------------------------------------------------------------------------
// Per-species clips. Every model has Idle, Move and Look so the map can drive
// them by the same names; the cockatiel keeps Fly/Hop/Flap for the demo page.
// ---------------------------------------------------------------------------
function hopClips(name: string) {
  const BODY_Y = 0.52;
  const t = [0, 0.12, 0.34, 0.52, 0.66];
  const earSway = (side: number) =>
    new THREE.QuaternionKeyframeTrack(`${side < 0 ? "earL" : "earR"}.quaternion`, t, flat([
      q(0, 0, 0), q(-0.5, 0, 0.1 * side), q(-0.15, 0, -0.05 * side), q(0.35, 0, 0.05 * side), q(0, 0, 0),
    ]));
  const move = new THREE.AnimationClip(name, 0.66, [
    new THREE.VectorKeyframeTrack("body.position", t, flat([
      [0, BODY_Y - 0.05, 0], [0, BODY_Y + 0.05, 0], [0, BODY_Y + 0.34, 0], [0, BODY_Y - 0.06, 0], [0, BODY_Y, 0],
    ])),
    new THREE.VectorKeyframeTrack("body.scale", t, flat([
      [1.12, 0.88, 1.12], [0.92, 1.12, 0.92], [0.96, 1.06, 0.96], [1.14, 0.86, 1.14], [1, 1, 1],
    ])),
    new THREE.QuaternionKeyframeTrack("body.quaternion", t, flat([q(0.1, 0, 0), q(-0.12, 0, 0), q(-0.2, 0, 0), q(0.12, 0, 0), q(0, 0, 0)])),
    earSway(-1),
    earSway(1),
    new THREE.VectorKeyframeTrack("footL.position", t, flat([
      [-0.16, 0, 0.12], [-0.16, 0.06, 0.12], [-0.16, 0.3, 0.06], [-0.16, 0, 0.12], [-0.16, 0, 0.12],
    ])),
    new THREE.VectorKeyframeTrack("footR.position", t, flat([
      [0.16, 0, 0.12], [0.16, 0.06, 0.12], [0.16, 0.3, 0.06], [0.16, 0, 0.12], [0.16, 0, 0.12],
    ])),
  ]);
  return move;
}

function trotClip(name: string) {
  const BODY_Y = 0.52;
  const t = [0, 0.15, 0.3, 0.45, 0.6];
  return new THREE.AnimationClip(name, 0.6, [
    new THREE.VectorKeyframeTrack("body.position", t, flat([
      [0, BODY_Y, 0], [0, BODY_Y + 0.06, 0], [0, BODY_Y, 0], [0, BODY_Y + 0.06, 0], [0, BODY_Y, 0],
    ])),
    new THREE.QuaternionKeyframeTrack("body.quaternion", t, flat([q(0.08, 0.05, 0), q(0.12, 0, 0), q(0.08, -0.05, 0), q(0.12, 0, 0), q(0.08, 0.05, 0)])),
    new THREE.QuaternionKeyframeTrack("tail.quaternion", t, flat([q(0, 0.25, 0), q(0, -0.1, 0.1), q(0, -0.25, 0), q(0, -0.1, -0.1), q(0, 0.25, 0)])),
    new THREE.VectorKeyframeTrack("footL.position", t, flat([
      [-0.16, 0, 0.12], [-0.16, 0.12, 0.18], [-0.16, 0, 0.12], [-0.16, 0, 0.06], [-0.16, 0, 0.12],
    ])),
    new THREE.VectorKeyframeTrack("footR.position", t, flat([
      [0.16, 0, 0.12], [0.16, 0, 0.06], [0.16, 0, 0.12], [0.16, 0.12, 0.18], [0.16, 0, 0.12],
    ])),
  ]);
}

function commonIdleLook(extra: THREE.KeyframeTrack[] = []) {
  const BODY_Y = 0.52;
  const idle = new THREE.AnimationClip("Idle", 2, [
    new THREE.VectorKeyframeTrack("body.position", [0, 1, 2], [0, BODY_Y, 0, 0, BODY_Y + 0.025, 0, 0, BODY_Y, 0]),
    new THREE.VectorKeyframeTrack("body.scale", [0, 1, 2], [1, 1, 1, 0.99, 1.02, 0.99, 1, 1, 1]),
    ...extra,
  ]);
  const look = new THREE.AnimationClip("Look", 1.4, [
    new THREE.QuaternionKeyframeTrack("body.quaternion", [0, 0.4, 1.0, 1.4], flat([q(0, 0, 0), q(0, 0.35, 0.18), q(0, 0.35, 0.18), q(0, 0, 0)])),
  ]);
  return [idle, look];
}

function bunnyAnimations() {
  const earIdle = [-1, 1].map((side) =>
    new THREE.QuaternionKeyframeTrack(`${side < 0 ? "earL" : "earR"}.quaternion`, [0, 1, 2], flat([
      q(0, 0, 0), q(-0.12, 0, 0.06 * side), q(0, 0, 0),
    ])),
  );
  return [...commonIdleLook(earIdle), hopClips("Move"), hopClips("Hop")];
}

function catAnimations() {
  const tailIdle = new THREE.QuaternionKeyframeTrack("tail.quaternion", [0, 1, 2], flat([q(0, 0.2, 0), q(0, -0.2, 0), q(0, 0.2, 0)]));
  return [...commonIdleLook([tailIdle]), trotClip("Move"), trotClip("Trot")];
}

// Ground hop with a little wing-flap assist and tuft bounce — the chick has no
// ears, so this can't reuse hopClips().
function chickHop(name: string) {
  const BODY_Y = 0.5;
  const t = [0, 0.12, 0.34, 0.52, 0.66];
  return new THREE.AnimationClip(name, 0.66, [
    new THREE.VectorKeyframeTrack("body.position", t, flat([
      [0, BODY_Y - 0.05, 0], [0, BODY_Y + 0.05, 0], [0, BODY_Y + 0.3, 0], [0, BODY_Y - 0.06, 0], [0, BODY_Y, 0],
    ])),
    new THREE.VectorKeyframeTrack("body.scale", t, flat([
      [1.12, 0.88, 1.12], [0.92, 1.12, 0.92], [0.96, 1.06, 0.96], [1.14, 0.86, 1.14], [1, 1, 1],
    ])),
    new THREE.QuaternionKeyframeTrack("wingL.quaternion", t, flat([q(0, 0, 0), q(0, 0, -0.5), q(0, 0, -0.15), q(0, 0, -0.35), q(0, 0, 0)])),
    new THREE.QuaternionKeyframeTrack("wingR.quaternion", t, flat([q(0, 0, 0), q(0, 0, 0.5), q(0, 0, 0.15), q(0, 0, 0.35), q(0, 0, 0)])),
    new THREE.QuaternionKeyframeTrack("tuft.quaternion", t, flat([q(0, 0, 0), q(0.18, 0, 0), q(-0.12, 0, 0), q(0.1, 0, 0), q(0, 0, 0)])),
    new THREE.VectorKeyframeTrack("footL.position", t, flat([
      [-0.14, 0, 0.02], [-0.14, 0.05, 0.02], [-0.14, 0.26, 0.02], [-0.14, 0, 0.02], [-0.14, 0, 0.02],
    ])),
    new THREE.VectorKeyframeTrack("footR.position", t, flat([
      [0.14, 0, 0.02], [0.14, 0.05, 0.02], [0.14, 0.26, 0.02], [0.14, 0, 0.02], [0.14, 0, 0.02],
    ])),
  ]);
}

function chickAnimations() {
  const tuftIdle = new THREE.QuaternionKeyframeTrack("tuft.quaternion", [0, 1, 2], flat([q(0, 0, 0), q(-0.06, 0, 0.04), q(0, 0, 0)]));
  return [...commonIdleLook([tuftIdle]), chickHop("Move"), chickHop("Hop")];
}

async function exportModel(name: string, root: THREE.Object3D, animations: THREE.AnimationClip[]) {
  const scene = new THREE.Scene();
  scene.add(root);
  const exporter = new GLTFExporter();
  const glb = (await exporter.parseAsync(scene, { binary: true, animations })) as ArrayBuffer;

  const here = path.dirname(fileURLToPath(import.meta.url));
  for (const out of [
    path.resolve(here, `../public/models/${name}.glb`),
    path.resolve(here, `../../mobile/assets/models/${name}.glb`),
  ]) {
    await mkdir(path.dirname(out), { recursive: true });
    await writeFile(out, Buffer.from(glb));
    console.log(`wrote ${path.relative(process.cwd(), out)} (${(glb.byteLength / 1024).toFixed(0)} KB)`);
  }
}

async function main() {
  const cockatielClips = buildAnimations();
  // The map drives every species with the same clip name.
  const fly = cockatielClips.find((c) => c.name === "Fly")!.clone();
  fly.name = "Move";
  // The cockatiel now ships as the Tripo-made model — see scripts/rig-tripo-bird.mts.
  // Building it here too would silently clobber that file, so it is exported under
  // a separate name and kept only as the fallback primitive version.
  await exportModel("cockatiel-primitive", buildCockatiel(), [...cockatielClips, fly]);
  await exportModel("bunny", buildBunny(), bunnyAnimations());
  await exportModel("cat", buildCat(), catAnimations());
  await exportModel("chick", buildChick(), chickAnimations());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
