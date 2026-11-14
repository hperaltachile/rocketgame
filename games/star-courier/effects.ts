/**
 * Small pooled effects: particle bursts (dust, sparks, stars) and camera
 * shake. All of it is skipped or toned down with reduced motion.
 */

import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Points,
  PointsMaterial,
  type Scene,
} from "three";

const MAX = 320;

/** A fixed pool of particles drawn as one Points object. */
export class Particles {
  private positions = new Float32Array(MAX * 3);
  private colors = new Float32Array(MAX * 3);
  private velocity = new Float32Array(MAX * 3);
  private life = new Float32Array(MAX);
  private gravity = new Float32Array(MAX);
  private next = 0;
  private geometry = new BufferGeometry();
  private points: Points;
  private tmp = new Color();

  constructor(scene: Scene) {
    this.geometry.setAttribute(
      "position",
      new Float32BufferAttribute(this.positions, 3),
    );
    this.geometry.setAttribute(
      "color",
      new Float32BufferAttribute(this.colors, 3),
    );
    this.points = new Points(
      this.geometry,
      new PointsMaterial({
        size: 0.22,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.clear();
  }

  /** Throws `count` particles out from a point. */
  burst(
    x: number,
    y: number,
    z: number,
    css: string,
    count: number,
    speed: number,
    opts: { up?: number; gravity?: number; life?: number } = {},
  ) {
    this.tmp.set(css);
    for (let n = 0; n < count; n++) {
      const i = this.next;
      this.next = (this.next + 1) % MAX;
      this.positions.set([x, y, z], i * 3);
      this.colors.set([this.tmp.r, this.tmp.g, this.tmp.b], i * 3);
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.6);
      this.velocity.set(
        [
          Math.cos(a) * s,
          (opts.up ?? 0.5) * speed * Math.random(),
          Math.sin(a) * s,
        ],
        i * 3,
      );
      this.gravity[i] = opts.gravity ?? 9;
      this.life[i] = (opts.life ?? 0.6) * (0.6 + Math.random() * 0.4);
    }
  }

  update(dt: number) {
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.positions[i * 3 + 1] = -999;
        continue;
      }
      this.velocity[i * 3 + 1] -= this.gravity[i] * dt;
      for (let k = 0; k < 3; k++)
        this.positions[i * 3 + k] += this.velocity[i * 3 + k] * dt;
      // Fade by darkening (additive blending makes black invisible).
      const fade = Math.min(1, this.life[i] * 3);
      for (let k = 0; k < 3; k++) this.colors[i * 3 + k] *= 0.88 + fade * 0.12;
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }

  clear() {
    this.life.fill(0);
    for (let i = 0; i < MAX; i++) this.positions[i * 3 + 1] = -999;
    this.geometry.attributes.position.needsUpdate = true;
  }

  dispose() {
    this.geometry.dispose();
    (this.points.material as PointsMaterial).dispose();
  }
}

/** Camera shake that fades out. */
export class Shake {
  private strength = 0;
  kick(amount: number) {
    this.strength = Math.max(this.strength, amount);
  }
  /** Offset to add to the camera this frame. */
  offset(dt: number): [number, number] {
    this.strength = Math.max(0, this.strength - dt * 2.5);
    const s = this.strength * this.strength;
    return [(Math.random() - 0.5) * s, (Math.random() - 0.5) * s];
  }
  reset() {
    this.strength = 0;
  }
}
