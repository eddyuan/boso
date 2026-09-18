/**
 * Turns a Tripo .glb into an animated companion.
 *
 * Tripo exports each part as its own mesh with an identity transform and
 * vertices baked in world space, so rotating a node spins that part around the
 * world origin. This module wraps parts in pivot nodes placed at their joints
 * (offsetting the mesh back by the same amount) and writes animation channels
 * straight into the glTF. Geometry and textures are copied through untouched, so
 * nothing is re-encoded and the result keeps Tripo's original quality.
 */
import fs from "node:fs";
import path from "node:path";

export type Vec3 = [number, number, number];
export type AnimPath = "translation" | "rotation" | "scale";
export type Track = { node: number; path: AnimPath; times: number[]; values: number[][] };

const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;

export const quatX = (deg: number) => {
  const h = ((deg * Math.PI) / 180) / 2;
  return [Math.sin(h), 0, 0, Math.cos(h)];
};
export const quatY = (deg: number) => {
  const h = ((deg * Math.PI) / 180) / 2;
  return [0, Math.sin(h), 0, Math.cos(h)];
};
export const quatZ = (deg: number) => {
  const h = ((deg * Math.PI) / 180) / 2;
  return [0, 0, Math.sin(h), Math.cos(h)];
};

/** Sine wave over a 0..1 phase — the basis for every cyclic clip here. */
export const wave = (phase: number) => Math.sin(phase * Math.PI * 2);

export const sum = (...v: Vec3[]): Vec3 => [
  v.reduce((a, c) => a + c[0], 0),
  v.reduce((a, c) => a + c[1], 0),
  v.reduce((a, c) => a + c[2], 0),
];

export class Rig {
  gltf: any;
  private chunks: Buffer[];
  private binLength: number;

  constructor(file: string) {
    const raw = fs.readFileSync(file);
    const total = raw.readUInt32LE(8);
    let cursor = 12;
    let bin = Buffer.alloc(0);
    while (cursor < total) {
      const length = raw.readUInt32LE(cursor);
      const type = raw.readUInt32LE(cursor + 4);
      const chunk = raw.subarray(cursor + 8, cursor + 8 + length);
      if (type === JSON_CHUNK) this.gltf = JSON.parse(chunk.toString("utf8"));
      else if (type === BIN_CHUNK) bin = Buffer.from(chunk);
      cursor += 8 + length;
    }
    this.chunks = [bin];
    this.binLength = bin.length;
  }

  /** Index of a Tripo part node, by the number in its name. */
  part(n: number | string) {
    const name = typeof n === "number" ? `tripo_part_${n}` : n;
    const index = this.gltf.nodes.findIndex((node: any) => node.name === name);
    if (index < 0) throw new Error(`missing ${name}`);
    return index;
  }

  /** The scene's single root node — Tripo names it "ROOT" or "ParentNode". */
  get root(): number {
    const scene = this.gltf.scenes[this.gltf.scene ?? 0];
    if (scene.nodes.length !== 1) throw new Error(`expected one root node, found ${scene.nodes.length}`);
    return scene.nodes[0];
  }

  /**
   * Shift a mesh node so it stays put once it hangs under pivot nodes.
   *
   * Subtracts from whatever translation the node already has — some Tripo
   * exports bake the parts into world space (no translation), others centre each
   * mesh and place it with one. Overwriting would collapse the second kind onto
   * the origin.
   */
  offset(node: number, by: Vec3) {
    const current: Vec3 = this.gltf.nodes[node].translation ?? [0, 0, 0];
    this.gltf.nodes[node].translation = [current[0] - by[0], current[1] - by[1], current[2] - by[2]];
  }

  /** A new joint at `translation`, with `children` re-parented under it. */
  pivot(name: string, translation: Vec3, children: number[], ancestors: Vec3[] = []) {
    for (const child of children) this.offset(child, sum(...ancestors, translation));
    return this.gltf.nodes.push({ name, translation, children }) - 1;
  }

  setRootChildren(children: number[]) {
    this.gltf.nodes[this.root].children = children;
  }

  private accessor(values: number[], type: "SCALAR" | "VEC3" | "VEC4") {
    const components = type === "SCALAR" ? 1 : type === "VEC3" ? 3 : 4;
    while (this.binLength % 4 !== 0) {
      this.chunks.push(Buffer.alloc(1));
      this.binLength += 1;
    }
    const data = Buffer.from(new Float32Array(values).buffer);
    const byteOffset = this.binLength;
    this.chunks.push(data);
    this.binLength += data.length;

    this.gltf.bufferViews.push({ buffer: 0, byteOffset, byteLength: data.length });
    const axis = (c: number) => values.filter((_, i) => i % components === c);
    this.gltf.accessors.push({
      bufferView: this.gltf.bufferViews.length - 1,
      componentType: 5126,
      count: values.length / components,
      type,
      // Required by the spec on animation input accessors.
      ...(type === "SCALAR"
        ? { min: [Math.min(...axis(0))], max: [Math.max(...axis(0))] }
        : {}),
    });
    return this.gltf.accessors.length - 1;
  }

  clip(name: string, tracks: Track[]) {
    const samplers: any[] = [];
    const channels: any[] = [];
    for (const track of tracks) {
      const type = track.path === "rotation" ? "VEC4" : "VEC3";
      const input = this.accessor(track.times, "SCALAR");
      const output = this.accessor(track.values.flat(), type);
      samplers.push({ input, output, interpolation: "LINEAR" });
      channels.push({ sampler: samplers.length - 1, target: { node: track.node, path: track.path } });
    }
    this.gltf.animations = this.gltf.animations ?? [];
    this.gltf.animations.push({ name, samplers, channels });
  }

  write(names: string[], cwd = process.cwd()) {
    this.gltf.buffers[0].byteLength = this.binLength;
    const json = Buffer.from(JSON.stringify(this.gltf), "utf8");
    const jsonPadded = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
    const bin = Buffer.concat(this.chunks);
    const binPadded = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4, 0)]);

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

    for (const name of names) {
      for (const dir of ["public/models", "../mobile/assets/models"]) {
        const target = path.join(cwd, dir, `${name}.glb`);
        fs.writeFileSync(target, out);
        console.log(`wrote ${path.relative(cwd, target)} (${(out.length / 1024).toFixed(0)} KB)`);
      }
    }
    console.log("clips:", this.gltf.animations.map((a: any) => a.name).join(", "));
  }
}

/** Sample a curve so LINEAR keys still read as smooth, eased motion. */
export function sampled(
  node: number,
  path: AnimPath,
  seconds: number,
  steps: number,
  at: (t: number) => number[],
): Track {
  const times: number[] = [];
  const values: number[][] = [];
  for (let i = 0; i <= steps; i++) {
    times.push(Number(((i / steps) * seconds).toFixed(4)));
    values.push(at(i / steps));
  }
  return { node, path, times, values };
}

/** Hold a node at one scale for a whole clip (used to tuck parts away). */
export function held(node: number, path: AnimPath, seconds: number, value: number[]): Track {
  return { node, path, times: [0, seconds], values: [value, value] };
}
