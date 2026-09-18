/**
 * Adds a pivot hierarchy and animation clips to a Tripo-exported bird .glb.
 *
 * Tripo gives us 15 separate part meshes with identity transforms and vertices
 * baked in world space, so a node rotation would spin the part around the world
 * origin. We therefore wrap each moving part in a pivot node placed at its joint
 * and offset the mesh back by the same amount — the geometry and textures are
 * never touched, which keeps the export byte-for-byte and avoids re-encoding the
 * 15 JPEGs.
 *
 * Usage: tsx scripts/rig-tripo-bird.mts <input.glb> [outputName]
 */
import fs from "node:fs";
import path from "node:path";

type Vec3 = [number, number, number];

const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;

const input = process.argv[2];
const outputName = process.argv[3] ?? "cockatiel";
if (!input) {
  console.error("usage: tsx scripts/rig-tripo-bird.mts <input.glb> [outputName]");
  process.exit(1);
}

// ---------------------------------------------------------------- read
const raw = fs.readFileSync(input);
const totalLength = raw.readUInt32LE(8);
let cursor = 12;
let gltf: any = null;
let bin: Buffer = Buffer.alloc(0);
while (cursor < totalLength) {
  const length = raw.readUInt32LE(cursor);
  const type = raw.readUInt32LE(cursor + 4);
  const chunk = raw.subarray(cursor + 8, cursor + 8 + length);
  if (type === JSON_CHUNK) gltf = JSON.parse(chunk.toString("utf8"));
  else if (type === BIN_CHUNK) bin = Buffer.from(chunk);
  cursor += 8 + length;
}

const nodeByName = new Map<string, number>(gltf.nodes.map((n: any, i: number) => [n.name, i]));
const part = (n: number) => {
  const index = nodeByName.get(`tripo_part_${n}`);
  if (index === undefined) throw new Error(`missing tripo_part_${n}`);
  return index;
};

// Which part is which, from their world bounding boxes (see inspect output).
const BODY = [part(0), part(4), part(11), part(12), part(5), part(6), part(13), part(14)];
const TUFTS = [part(1), part(9), part(10)];
const WING_L = part(3);
const WING_R = part(7);
const FEET = [part(2), part(8)];

// ---------------------------------------------------------------- hierarchy
const add = (name: string, translation: Vec3, children: number[]) =>
  gltf.nodes.push({ name, translation, children }) - 1;

/** Offset a mesh node so it stays put once it hangs under pivots. */
const offset = (node: number, by: Vec3) => {
  gltf.nodes[node].translation = [-by[0], -by[1], -by[2]];
};

const BODY_PIVOT: Vec3 = [0, 0.1, 0];
const TUFT_PIVOT: Vec3 = [0, 0.68, 0];
// On the seam where the wing meets the body (inner edge x = 0.285, near its top),
// so flapping pivots the tip and leaves the join where it is.
const WING_L_PIVOT: Vec3 = [-0.285, 0.40, -0.08];
const WING_R_PIVOT: Vec3 = [0.285, 0.40, -0.08];
const sum = (...v: Vec3[]): Vec3 => [
  v.reduce((a, c) => a + c[0], 0),
  v.reduce((a, c) => a + c[1], 0),
  v.reduce((a, c) => a + c[2], 0),
];

for (const node of BODY) offset(node, BODY_PIVOT);
for (const node of TUFTS) offset(node, sum(BODY_PIVOT, TUFT_PIVOT));
offset(WING_L, sum(BODY_PIVOT, WING_L_PIVOT));
offset(WING_R, sum(BODY_PIVOT, WING_R_PIVOT));

const tuft = add("tuft", TUFT_PIVOT, TUFTS);
const wingL = add("wingL", WING_L_PIVOT, [WING_L]);
const wingR = add("wingR", WING_R_PIVOT, [WING_R]);
const body = add("body", BODY_PIVOT, [...BODY, tuft, wingL, wingR]);

const root = gltf.nodes.findIndex((n: any) => n.name === "ROOT");
gltf.nodes[root].children = [body, ...FEET];

// ---------------------------------------------------------------- animation
const chunks: Buffer[] = [bin];
let binLength = bin.length;

/** Append float data to the BIN chunk and return a new accessor index. */
function accessor(values: number[], type: "SCALAR" | "VEC3" | "VEC4") {
  const components = type === "SCALAR" ? 1 : type === "VEC3" ? 3 : 4;
  while (binLength % 4 !== 0) {
    chunks.push(Buffer.alloc(1));
    binLength += 1;
  }
  const data = Buffer.from(new Float32Array(values).buffer);
  const byteOffset = binLength;
  chunks.push(data);
  binLength += data.length;

  const count = values.length / components;
  gltf.bufferViews.push({ buffer: 0, byteOffset, byteLength: data.length });
  const min = Array.from({ length: components }, (_, c) => Math.min(...values.filter((_, i) => i % components === c)));
  const max = Array.from({ length: components }, (_, c) => Math.max(...values.filter((_, i) => i % components === c)));
  gltf.accessors.push({
    bufferView: gltf.bufferViews.length - 1,
    componentType: 5126,
    count,
    type,
    ...(type === "SCALAR" ? { min, max } : {}),
  });
  return gltf.accessors.length - 1;
}

const quatX = (deg: number) => {
  const h = ((deg * Math.PI) / 180) / 2;
  return [Math.sin(h), 0, 0, Math.cos(h)];
};
const quatY = (deg: number) => {
  const h = ((deg * Math.PI) / 180) / 2;
  return [0, Math.sin(h), 0, Math.cos(h)];
};
const quatZ = (deg: number) => {
  const h = ((deg * Math.PI) / 180) / 2;
  return [0, 0, Math.sin(h), Math.cos(h)];
};

type Path = "translation" | "rotation" | "scale";
type Track = { node: number; path: Path; times: number[]; values: number[][] };

/** Sample a curve so LINEAR keys still read as smooth, eased motion. */
function sampled(node: number, path: Path, seconds: number, steps: number, at: (t: number) => number[]): Track {
  const times: number[] = [];
  const values: number[][] = [];
  for (let i = 0; i <= steps; i++) {
    const time = (i / steps) * seconds;
    times.push(Number(time.toFixed(4)));
    values.push(at(i / steps));
  }
  return { node, path, times, values };
}

const wave = (phase: number) => Math.sin(phase * Math.PI * 2);

function clip(name: string, tracks: Track[]) {
  const samplers: any[] = [];
  const channels: any[] = [];
  for (const track of tracks) {
    const type = track.path === "rotation" ? "VEC4" : "VEC3";
    const input = accessor(track.times, "SCALAR");
    const output = accessor(track.values.flat(), type);
    samplers.push({ input, output, interpolation: "LINEAR" });
    channels.push({ sampler: samplers.length - 1, target: { node: track.node, path: track.path } });
  }
  gltf.animations = gltf.animations ?? [];
  gltf.animations.push({ name, samplers, channels });
}

/**
 * Feet are visible on the ground and tucked away in flight. Every clip states
 * the scale so a crossfade can't leave them half-shrunk.
 */
const feet = (visible: boolean, seconds: number): Track[] =>
  FEET.map((node) => ({
    node,
    path: "scale" as const,
    times: [0, seconds],
    values: visible ? [[1, 1, 1], [1, 1, 1]] : [[0.001, 0.001, 0.001], [0.001, 0.001, 0.001]],
  }));

const wingTracks = (seconds: number, degrees: number, steps = 16, phase = 0): Track[] => [
  sampled(wingL, "rotation", seconds, steps, (t) => quatZ(wave(t + phase) * degrees)),
  sampled(wingR, "rotation", seconds, steps, (t) => quatZ(-wave(t + phase) * degrees)),
];

// Idle — a slow breath, with the tufts trailing a beat behind the body.
const IDLE = 2.4;
clip("Idle", [
  sampled(body, "translation", IDLE, 16, (t) => [BODY_PIVOT[0], BODY_PIVOT[1] + wave(t) * 0.012, BODY_PIVOT[2]]),
  sampled(body, "scale", IDLE, 16, (t) => [1 + wave(t) * 0.01, 1 - wave(t) * 0.012, 1 + wave(t) * 0.01]),
  sampled(tuft, "rotation", IDLE, 16, (t) => quatZ(wave(t - 0.12) * 5)),
  ...wingTracks(IDLE, 4),
  ...feet(true, IDLE),
]);

// Look — turns its head, tufts swinging after it.
const LOOK = 1.8;
clip("Look", [
  sampled(body, "rotation", LOOK, 18, (t) => quatY(Math.sin(t * Math.PI * 2) * 24)),
  sampled(tuft, "rotation", LOOK, 18, (t) => quatZ(Math.sin((t - 0.08) * Math.PI * 2) * 10)),
  ...feet(true, LOOK),
]);

// Flap — on the spot, wings only, body lifting a touch on the upstroke.
const FLAP = 0.5;
clip("Flap", [
  ...wingTracks(FLAP, 34),
  sampled(body, "translation", FLAP, 12, (t) => [BODY_PIVOT[0], BODY_PIVOT[1] + Math.max(0, wave(t)) * 0.02, BODY_PIVOT[2]]),
  ...feet(true, FLAP),
]);

// Hop — crouch, spring, land and squash.
const HOP = 0.75;
const hopHeight = (t: number) => {
  if (t < 0.18) return -0.02 * (t / 0.18);            // crouch
  if (t < 0.72) { const u = (t - 0.18) / 0.54; return Math.sin(u * Math.PI) * 0.16; } // arc
  return 0;
};
const hopSquash = (t: number) => {
  if (t < 0.18) return 0.94;
  if (t < 0.72) return 1.04;
  return t < 0.86 ? 0.92 : 1;
};
clip("Hop", [
  sampled(root, "translation", HOP, 20, (t) => [0, hopHeight(t), 0]),
  sampled(body, "scale", HOP, 20, (t) => [2 - hopSquash(t), hopSquash(t), 2 - hopSquash(t)]),
  ...wingTracks(HOP, 26),
  sampled(tuft, "rotation", HOP, 20, (t) => quatZ(wave(t - 0.1) * 12)),
  ...feet(true, HOP),
]);

// Fly / Move — travelling. Feet tucked, nose down, wings beating twice a second.
const FLY = 0.62;
const flight = (): Track[] => [
  ...wingTracks(FLY, 36),
  sampled(body, "rotation", FLY, 14, (t) => quatX(-10 + wave(t) * 3)),
  sampled(body, "translation", FLY, 14, (t) => [BODY_PIVOT[0], BODY_PIVOT[1] + wave(t) * 0.035, BODY_PIVOT[2]]),
  sampled(tuft, "rotation", FLY, 14, (t) => quatZ(wave(t - 0.15) * 9)),
  ...feet(false, FLY),
];
clip("Fly", flight());
clip("Move", flight());

// ---------------------------------------------------------------- write
gltf.buffers[0].byteLength = binLength;
const jsonChunk = Buffer.from(JSON.stringify(gltf), "utf8");
const jsonPadded = Buffer.concat([jsonChunk, Buffer.alloc((4 - (jsonChunk.length % 4)) % 4, 0x20)]);
const binJoined = Buffer.concat(chunks);
const binPadded = Buffer.concat([binJoined, Buffer.alloc((4 - (binJoined.length % 4)) % 4, 0)]);

const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + jsonPadded.length + 8 + binPadded.length, 8);
const jsonHeader = Buffer.alloc(8);
jsonHeader.writeUInt32LE(jsonPadded.length, 0);
jsonHeader.writeUInt32LE(JSON_CHUNK, 4);
const binHeader = Buffer.alloc(8);
binHeader.writeUInt32LE(binPadded.length, 0);
binHeader.writeUInt32LE(BIN_CHUNK, 4);

const out = Buffer.concat([header, jsonHeader, jsonPadded, binHeader, binPadded]);
const targets = [
  path.join(process.cwd(), "public/models", `${outputName}.glb`),
  path.join(process.cwd(), "../mobile/assets/models", `${outputName}.glb`),
];
for (const target of targets) {
  fs.writeFileSync(target, out);
  console.log(`wrote ${path.relative(process.cwd(), target)} (${(out.length / 1024).toFixed(0)} KB)`);
}
console.log("clips:", gltf.animations.map((a: any) => a.name).join(", "));
