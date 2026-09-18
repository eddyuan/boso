/**
 * The pet's idle wandering.
 *
 * This is cosmetic: the pet's position is never stored or sent anywhere, it just
 * gives the map some life while you're looking at it. Everything is in scene
 * metres relative to the map's origin (+x east, +z south), which is what the
 * three.js layer draws in.
 */

/** How far from you the pet may ever get. */
export const WANDER_RADIUS_M = 5000;
/**
 * Typical distance from you, in metres. Trip lengths are drawn from an
 * exponential distribution around this, so the pet mostly pootles about within
 * sight and only occasionally wanders further; WANDER_RADIUS_M is the hard cap
 * it can never pass, not a typical distance. Picking uniformly inside 5 km put
 * it a kilometre away for minutes at a time, which just reads as "gone".
 */
const TYPICAL_M = 60;
const PAUSE_MIN_S = 3;
const PAUSE_MAX_S = 10;
const TURN_RATE = 6; // radians/sec
const ARRIVE_M = 1.5;

export type WanderOptions = {
  /** Birds cruise at altitude; everything else keeps its feet down. */
  flies: boolean;
  speedMps: number;
  cruiseAltitudeM?: number;
};

export type WanderState = {
  x: number;
  y: number;
  z: number;
  heading: number;
  moving: boolean;
};

const random = (min: number, max: number) => min + Math.random() * (max - min);

export class Wander {
  private home = { x: 0, z: 0 };
  private position = { x: 0, z: 0 };
  private target = { x: 0, z: 0 };
  private altitude = 0;
  private heading = 0;
  private pauseLeft = random(PAUSE_MIN_S, PAUSE_MAX_S);
  private moving = false;
  private options: WanderOptions;

  constructor(options: WanderOptions) {
    this.options = options;
  }

  /** Re-centre on the user. Called when their location fix changes. */
  setHome(x: number, z: number, snap = false) {
    this.home = { x, z };
    if (snap) {
      this.position = { x, z };
      this.target = { x, z };
      this.moving = false;
    }
  }

  get state(): WanderState {
    return { x: this.position.x, y: this.altitude, z: this.position.z, heading: this.heading, moving: this.moving };
  }

  private pickTarget() {
    const bearing = Math.random() * Math.PI * 2;
    // Measured from you, not from where the pet happens to be, so it drifts
    // around you instead of random-walking off into the distance.
    const distance = Math.min(WANDER_RADIUS_M, -TYPICAL_M * Math.log(1 - Math.random()));
    this.target = {
      x: this.home.x + Math.cos(bearing) * distance,
      z: this.home.z + Math.sin(bearing) * distance,
    };
    this.moving = true;
  }

  update(dt: number): WanderState {
    const { flies, speedMps, cruiseAltitudeM = 9 } = this.options;

    if (!this.moving) {
      this.pauseLeft -= dt;
      // Settle back to the ground while resting.
      this.altitude = Math.max(0, this.altitude - speedMps * 0.5 * dt);
      if (this.pauseLeft <= 0) this.pickTarget();
      return this.state;
    }

    const dx = this.target.x - this.position.x;
    const dz = this.target.z - this.position.z;
    const distance = Math.hypot(dx, dz);

    // Face the way it's going (the models face +z).
    const desired = Math.atan2(dx, dz);
    let turn = desired - this.heading;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    this.heading += turn * Math.min(1, TURN_RATE * dt);

    if (flies) {
      // Climb after take-off, glide down on approach.
      const goal = cruiseAltitudeM * Math.min(1, distance / 30);
      this.altitude += (goal - this.altitude) * Math.min(1, 3 * dt);
    }

    const step = speedMps * dt;
    if (distance <= Math.max(step, ARRIVE_M)) {
      this.position = { ...this.target };
      this.moving = false;
      this.pauseLeft = random(PAUSE_MIN_S, PAUSE_MAX_S);
    } else {
      this.position = {
        x: this.position.x + (dx / distance) * step,
        z: this.position.z + (dz / distance) * step,
      };
    }
    return this.state;
  }
}
