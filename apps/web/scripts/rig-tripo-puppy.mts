/**
 * Rigs and animates the Tripo puppy.
 *
 * Parts, read off their world bounding boxes:
 *   0          body (the ball)          4 / 1   ears, left / right
 *   7 / 2      front legs, left / right 6 / 5   back legs, left / right
 *   3          tail                     new_0   face plate (eyes, nose, mouth)
 *   8          small tuft by the left ear
 *
 * Usage: tsx scripts/rig-tripo-puppy.mts <input.glb> [outputName]
 */
import { Rig, held, quatX, quatY, quatZ, sampled, wave, type Track, type Vec3 } from "./lib/glb-rig.mjs";

const input = process.argv[2];
const outputName = process.argv[3] ?? "puppy";
if (!input) {
  console.error("usage: tsx scripts/rig-tripo-puppy.mts <input.glb> [outputName]");
  process.exit(1);
}

const rig = new Rig(input);

const BODY = [rig.part(0), rig.part("tripo_part_new_0"), rig.part(8)];
const EAR_L = rig.part(4);
const EAR_R = rig.part(1);
const TAIL = rig.part(3);
const LEG_FL = rig.part(7);
const LEG_FR = rig.part(2);
const LEG_BL = rig.part(6);
const LEG_BR = rig.part(5);

// Joints sit where each part meets the body: the ears at their top-inner corner,
// the legs at their shoulder, the tail where it leaves the rump.
const BODY_PIVOT: Vec3 = [0, 0.12, 0];
const EAR_L_PIVOT: Vec3 = [-0.20, 0.95, 0.09];
const EAR_R_PIVOT: Vec3 = [0.20, 0.95, 0.10];
const TAIL_PIVOT: Vec3 = [0.01, 0.62, -0.37];
const LEG_FL_PIVOT: Vec3 = [-0.14, 0.16, 0.07];
const LEG_FR_PIVOT: Vec3 = [0.15, 0.16, 0.08];
const LEG_BL_PIVOT: Vec3 = [-0.16, 0.25, -0.21];
const LEG_BR_PIVOT: Vec3 = [0.18, 0.25, -0.20];

// Ears, tail and face ride on the body; the legs stay under ROOT so the body can
// bob without dragging the feet off the ground.
const earL = rig.pivot("earL", EAR_L_PIVOT, [EAR_L], [BODY_PIVOT]);
const earR = rig.pivot("earR", EAR_R_PIVOT, [EAR_R], [BODY_PIVOT]);
const tail = rig.pivot("tail", TAIL_PIVOT, [TAIL], [BODY_PIVOT]);
for (const node of BODY) rig.offset(node, BODY_PIVOT);
const body = rig.pivot("body", BODY_PIVOT, [], []);
rig.gltf.nodes[body].children = [...BODY, earL, earR, tail];

const legFL = rig.pivot("legFL", LEG_FL_PIVOT, [LEG_FL]);
const legFR = rig.pivot("legFR", LEG_FR_PIVOT, [LEG_FR]);
const legBL = rig.pivot("legBL", LEG_BL_PIVOT, [LEG_BL]);
const legBR = rig.pivot("legBR", LEG_BR_PIVOT, [LEG_BR]);

rig.setRootChildren([body, legFL, legFR, legBL, legBR]);

const breathe = (seconds: number, amount = 0.012): Track[] => [
  sampled(body, "translation", seconds, 16, (t) => [BODY_PIVOT[0], BODY_PIVOT[1] + wave(t) * amount, BODY_PIVOT[2]]),
  sampled(body, "scale", seconds, 16, (t) => [1 + wave(t) * 0.008, 1 - wave(t) * 0.01, 1 + wave(t) * 0.008]),
];

/** Ears swing a beat behind whatever the body is doing. */
const ears = (seconds: number, degrees: number, lag = 0.14): Track[] => [
  sampled(earL, "rotation", seconds, 16, (t) => quatZ(wave(t - lag) * degrees)),
  sampled(earR, "rotation", seconds, 16, (t) => quatZ(-wave(t - lag) * degrees)),
];

const wag = (seconds: number, degrees: number, beats = 1): Track =>
  sampled(tail, "rotation", seconds, 20, (t) => quatY(Math.sin(t * Math.PI * 2 * beats) * degrees));

const legs = (seconds: number, degrees: number): Track[] => {
  // Diagonal pairs move together, the way a dog actually trots.
  const swing = (node: number, phase: number) =>
    sampled(node, "rotation", seconds, 16, (t) => quatX(wave(t + phase) * degrees));
  return [swing(legFL, 0), swing(legBR, 0), swing(legFR, 0.5), swing(legBL, 0.5)];
};

const standing = (seconds: number): Track[] =>
  [legFL, legFR, legBL, legBR].map((node) => held(node, "rotation", seconds, quatX(0)));

// Idle — breathing, ears settling, a slow happy tail.
const IDLE = 2.6;
rig.clip("Idle", [...breathe(IDLE), ...ears(IDLE, 4), wag(IDLE, 10), ...standing(IDLE)]);

// Look — turns to look, ears swinging after it.
const LOOK = 1.9;
rig.clip("Look", [
  sampled(body, "rotation", LOOK, 18, (t) => quatY(Math.sin(t * Math.PI * 2) * 22)),
  ...ears(LOOK, 12),
  wag(LOOK, 14),
  ...standing(LOOK),
]);

// Wag — the whole back end joins in.
const WAG = 0.9;
rig.clip("Wag", [
  wag(WAG, 34, 2),
  sampled(body, "rotation", WAG, 18, (t) => quatY(Math.sin(t * Math.PI * 4) * 5)),
  ...ears(WAG, 9),
  ...breathe(WAG, 0.008),
  ...standing(WAG),
]);

// Move / Trot — legs in diagonal pairs, body bobbing on each step, ears flopping.
const TROT = 0.62;
const trot = (): Track[] => [
  ...legs(TROT, 26),
  sampled(body, "translation", TROT, 16, (t) => [
    BODY_PIVOT[0],
    BODY_PIVOT[1] + Math.abs(wave(t)) * 0.03,
    BODY_PIVOT[2],
  ]),
  sampled(body, "rotation", TROT, 16, (t) => quatX(wave(t) * 3)),
  ...ears(TROT, 16, 0.1),
  wag(TROT, 18, 2),
];
rig.clip("Trot", trot());
rig.clip("Move", trot());

rig.write([outputName]);
