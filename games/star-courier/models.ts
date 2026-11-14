/**
 * Every 3D model in Star Courier, built in code from simple shapes: the
 * couriers, Gloop, obstacles, power-ups, the track and the skyline. Flat
 * shaded, low-poly and cheap to draw. Models face +z (the way you run).
 */

import {
  BoxGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  OctahedronGeometry,
  SphereGeometry,
  TorusGeometry,
  type BufferGeometry,
  type Material,
} from "three";
import type { Rng } from "@/lib/games/rng";
import type { Courier } from "@/lib/games/star-courier/couriers";
import type { PowerUpKind } from "@/lib/games/star-courier/config";
import type { World } from "@/lib/games/star-courier/worlds";
import { POWER_COLORS } from "./names";

const materials = new Map<string, Material>();

/** Flat-shaded material, shared per colour. */
export function lambert(color: string, opts: { opacity?: number } = {}) {
  const key = `l${color}${opts.opacity ?? 1}`;
  let m = materials.get(key);
  if (!m) {
    m = new MeshLambertMaterial({
      color,
      flatShading: true,
      transparent: opts.opacity !== undefined,
      opacity: opts.opacity ?? 1,
    });
    materials.set(key, m);
  }
  return m;
}

/** Unlit material for glowing bits (lights, stripes, beams). */
export function glow(color: string, opacity = 1) {
  const key = `g${color}${opacity}`;
  let m = materials.get(key);
  if (!m) {
    m = new MeshBasicMaterial({
      color,
      transparent: opacity < 1,
      opacity,
      fog: true,
    });
    materials.set(key, m);
  }
  return m;
}

/** Frees every shared material (call once when the game is destroyed). */
export function disposeMaterials() {
  for (const m of materials.values()) m.dispose();
  materials.clear();
}

function mesh(
  geometry: BufferGeometry,
  material: Material,
  x = 0,
  y = 0,
  z = 0,
): Mesh {
  const m = new Mesh(geometry, material);
  m.position.set(x, y, z);
  return m;
}

const box = (w: number, h: number, d: number) => new BoxGeometry(w, h, d);

// Couriers

export type CourierRig = {
  root: Group;
  /** Scaled for squash and stretch; leaned when sliding. */
  body: Group;
  legs: Group[];
  arms: Group[];
  wheel: Mesh | null;
  scarf: Mesh[];
  /** Bubble Shield, shown while it's on. */
  bubble: Mesh;
  /** Glowing Moon Boots. */
  boots: Mesh[];
};

/** A limb that swings from its top (shoulder or hip). */
function limb(
  w: number,
  h: number,
  color: string,
  x: number,
  y: number,
  foot?: string,
): Group {
  const g = new Group();
  g.position.set(x, y, 0);
  g.userData.length = h;
  g.add(mesh(box(w, h, w), lambert(color), 0, -h / 2, 0));
  if (foot)
    g.add(mesh(box(w * 1.2, w * 0.7, w * 1.7), lambert(foot), 0, -h, 0.05));
  return g;
}

function parcel(size: number): Group {
  const g = new Group();
  g.add(mesh(box(size, size * 0.8, size * 0.7), lambert("#c98b4f")));
  g.add(mesh(box(size * 1.02, size * 0.82, size * 0.15), lambert("#f2d16b")));
  return g;
}

export function makeCourier(courier: Courier): CourierRig {
  const c = courier.colors;
  const root = new Group();
  const body = new Group();
  root.add(body);
  const legs: Group[] = [];
  const arms: Group[] = [];
  const scarf: Mesh[] = [];
  const boots: Mesh[] = [];
  let wheel: Mesh | null = null;

  if (courier.id === "pip") {
    // Small and round, with a huge helmet and a parcel backpack.
    body.add(
      mesh(
        new CylinderGeometry(0.3, 0.34, 0.62, 8),
        lambert(c.suit),
        0,
        0.82,
        0,
      ),
    );
    body.add(mesh(box(0.62, 0.12, 0.46), lambert(c.trim), 0, 0.58, 0));
    body.add(
      mesh(new IcosahedronGeometry(0.4, 1), lambert("#f4f6ff"), 0, 1.4, 0),
    );
    const visor = mesh(
      new SphereGeometry(0.3, 10, 6),
      lambert(c.visor),
      0,
      1.4,
      0.16,
    );
    visor.scale.set(1, 0.7, 0.75);
    body.add(visor);
    body.add(mesh(new SphereGeometry(0.07, 6, 4), glow(c.accent), 0, 1.84, 0));
    const pack = parcel(0.5);
    pack.position.set(0, 0.9, -0.36);
    body.add(pack);
    legs.push(
      limb(0.17, 0.5, c.trim, -0.14, 0.55, c.accent),
      limb(0.17, 0.5, c.trim, 0.14, 0.55, c.accent),
    );
    arms.push(
      limb(0.13, 0.42, c.suit, -0.4, 1.05),
      limb(0.13, 0.42, c.suit, 0.4, 1.05),
    );
  } else if (courier.id === "zuri") {
    // Tall and slim, with a long scarf that streams out behind.
    body.add(
      mesh(
        new CylinderGeometry(0.22, 0.27, 0.78, 8),
        lambert(c.suit),
        0,
        1.05,
        0,
      ),
    );
    body.add(mesh(box(0.5, 0.1, 0.36), lambert(c.trim), 0, 0.68, 0));
    body.add(
      mesh(new IcosahedronGeometry(0.24, 1), lambert("#8d5a3b"), 0, 1.66, 0),
    );
    body.add(mesh(box(0.34, 0.1, 0.12), lambert(c.visor), 0, 1.7, 0.2));
    body.add(
      mesh(new SphereGeometry(0.15, 6, 4), lambert("#2b1a12"), 0, 1.86, -0.1),
    );
    for (let i = 0; i < 5; i++) {
      const piece = mesh(
        box(0.2 - i * 0.02, 0.1, 0.22),
        lambert(c.accent),
        0,
        1.42,
        -0.18 - i * 0.2,
      );
      scarf.push(piece);
      body.add(piece);
    }
    const bag = parcel(0.36);
    bag.position.set(0.32, 0.86, -0.05);
    body.add(bag);
    legs.push(
      limb(0.15, 0.68, c.trim, -0.12, 0.7, c.accent),
      limb(0.15, 0.68, c.trim, 0.12, 0.7, c.accent),
    );
    arms.push(
      limb(0.11, 0.55, c.suit, -0.32, 1.38),
      limb(0.11, 0.55, c.suit, 0.32, 1.38),
    );
  } else {
    // A boxy little robot on one big wheel, carrying a parcel on top.
    body.add(mesh(box(0.72, 0.62, 0.52), lambert(c.suit), 0, 0.98, 0));
    body.add(mesh(box(0.58, 0.4, 0.46), lambert(c.trim), 0, 1.5, 0));
    body.add(mesh(box(0.46, 0.2, 0.05), glow(c.visor), 0, 1.52, 0.24));
    body.add(
      mesh(
        new CylinderGeometry(0.02, 0.02, 0.3, 4),
        lambert(c.trim),
        0.18,
        1.83,
        0,
      ),
    );
    body.add(mesh(new SphereGeometry(0.07, 6, 4), glow(c.accent), 0.18, 2, 0));
    const top = parcel(0.4);
    top.position.set(0, 1.86, -0.08);
    body.add(top);
    wheel = mesh(
      new CylinderGeometry(0.36, 0.36, 0.22, 12),
      lambert("#22252f"),
      0,
      0.36,
      0,
    );
    wheel.rotation.z = Math.PI / 2;
    body.add(wheel);
    body.add(
      mesh(
        new CylinderGeometry(0.2, 0.2, 0.24, 8),
        lambert(c.accent),
        0,
        0.36,
        0,
      ),
    );
    body.children.at(-1)!.rotation.z = Math.PI / 2;
    arms.push(
      limb(0.12, 0.42, c.trim, -0.45, 1.15),
      limb(0.12, 0.42, c.trim, 0.45, 1.15),
    );
  }

  for (const leg of legs) {
    const b = mesh(
      box(0.24, 0.16, 0.36),
      glow("#c3f0ff"),
      0,
      -leg.userData.length,
      0.06,
    );
    b.visible = false;
    boots.push(b);
    leg.add(b);
  }
  if (wheel) {
    const b = mesh(
      new TorusGeometry(0.4, 0.06, 6, 16),
      glow("#c3f0ff"),
      0,
      0.36,
      0,
    );
    b.rotation.y = Math.PI / 2;
    b.visible = false;
    boots.push(b);
    body.add(b);
  }
  for (const part of [...legs, ...arms]) body.add(part);

  const bubble = mesh(
    new IcosahedronGeometry(1.25, 2),
    glow("#7cf5ff", 0.22),
    0,
    1,
    0,
  );
  bubble.visible = false;
  root.add(bubble);
  return { root, body, legs, arms, wheel, scarf, bubble, boots };
}

// Gloop

export type GloopRig = { root: Group; blob: Mesh; eyes: Group };

/**
 * Gloop: a giant, friendly space-jelly who just wants a hug. It chases from
 * behind, so the camera sees its back: its big eyes sit on stalks on top,
 * where you can see them peeking over.
 */
export function makeGloop(): GloopRig {
  const root = new Group();
  const blob = mesh(
    new IcosahedronGeometry(1.5, 2),
    lambert("#7dff7a", { opacity: 0.8 }),
    0,
    1.4,
    0,
  );
  blob.scale.set(1, 0.85, 1);
  root.add(blob);
  root.add(
    mesh(
      new IcosahedronGeometry(0.75, 1),
      lambert("#b8ffb0", { opacity: 0.5 }),
      0.35,
      1.7,
      -0.3,
    ),
  );
  const eyes = new Group();
  const stalk = lambert("#5fe05c");
  for (const side of [-1, 1]) {
    const x = side * 0.55;
    const s = mesh(new CylinderGeometry(0.08, 0.12, 0.9, 6), stalk, x, 2.75, 0);
    s.rotation.z = -side * 0.25;
    eyes.add(s);
    const ex = x + side * 0.12;
    eyes.add(
      mesh(new SphereGeometry(0.32, 10, 8), lambert("#ffffff"), ex, 3.3, 0),
    );
    eyes.add(
      mesh(new SphereGeometry(0.15, 8, 6), lambert("#1b1b2f"), ex, 3.33, 0.24),
    );
    eyes.add(
      mesh(
        new SphereGeometry(0.05, 6, 4),
        glow("#ffffff"),
        ex + 0.05,
        3.4,
        0.37,
      ),
    );
  }
  // A happy face on the front, for when it catches up and gives you a hug.
  const smile = mesh(
    new TorusGeometry(0.42, 0.07, 6, 12, Math.PI),
    lambert("#1b1b2f"),
    0,
    1.4,
    1.3,
  );
  smile.rotation.z = Math.PI;
  eyes.add(smile);
  root.add(eyes);
  return { root, blob, eyes };
}

// Obstacles (sizes match lib/games/star-courier/chunks.ts OBSTACLES)

export function makeCrate(world: World): Group {
  const g = new Group();
  const color = world.vehicles.pod[1];
  g.add(mesh(box(1.6, 1, 1.2), lambert(color), 0, 0.5, 0.6));
  g.add(
    mesh(box(1.64, 0.14, 1.24), lambert(world.vehicles.trim), 0, 0.85, 0.6),
  );
  g.add(
    mesh(box(1.64, 0.14, 1.24), lambert(world.vehicles.trim), 0, 0.15, 0.6),
  );
  g.add(mesh(box(0.5, 0.3, 0.02), glow("#ffffff"), 0, 0.5, 1.21));
  return g;
}

export function makeGate(world: World): Group {
  const g = new Group();
  const post = lambert(world.deck.side);
  g.add(mesh(box(0.18, 3, 0.3), post, -0.95, 1.5, 0.25));
  g.add(mesh(box(0.18, 3, 0.3), post, 0.95, 1.5, 0.25));
  g.add(mesh(box(2.1, 0.5, 0.3), lambert(world.vehicles.trim), 0, 2.75, 0.25));
  g.add(mesh(box(1.4, 0.24, 0.02), glow(world.deck.glow), 0, 2.75, 0.41));
  // The laser beam: slide under it.
  g.add(mesh(box(1.8, 0.16, 0.12), glow("#ff3b6b"), 0, 1.3, 0.25));
  g.add(mesh(box(1.8, 0.4, 0.06), glow("#ff3b6b", 0.3), 0, 1.3, 0.25));
  return g;
}

export function makeGap(world: World): Group {
  const g = new Group();
  g.add(mesh(box(2, 0.02, 3), glow("#020308"), 0, 0.01, 1.5));
  const rim = glow(world.deck.glow);
  g.add(mesh(box(2, 0.05, 0.1), rim, 0, 0.03, 0.02));
  g.add(mesh(box(2, 0.05, 0.1), rim, 0, 0.03, 2.98));
  return g;
}

function vehicle(
  length: number,
  color: string,
  world: World,
  lights: string,
): Group {
  const g = new Group();
  const trim = lambert(world.vehicles.trim);
  g.add(mesh(box(1.9, 2.6, length), lambert(color), 0, 1.75, length / 2));
  g.add(
    mesh(
      box(1.7, 0.45, length - 0.4),
      lambert(world.vehicles.trim),
      0,
      0.3,
      length / 2,
    ),
  );
  g.add(mesh(box(1.96, 0.18, length + 0.04), trim, 0, 3.05, length / 2));
  // A row of windows down each side.
  for (let z = 1; z < length - 0.8; z += 1.6) {
    g.add(mesh(box(0.02, 0.5, 0.9), glow(lights), 0.96, 2.1, z + 0.4));
    g.add(mesh(box(0.02, 0.5, 0.9), glow(lights), -0.96, 2.1, z + 0.4));
  }
  // The front end, facing the player.
  g.add(mesh(box(1.5, 0.9, 0.04), glow(lights, 0.85), 0, 2.2, -0.01));
  return g;
}

export function makePod(world: World, variant: number): Group {
  const colors = world.vehicles.pod;
  return vehicle(
    8,
    colors[variant % colors.length],
    world,
    world.skyline.lights,
  );
}

export type FreighterRig = { root: Group; warning: Mesh };

export function makeFreighter(world: World): FreighterRig {
  const root = vehicle(12, world.vehicles.freighter, world, "#fff3b0");
  // Headlights.
  root.add(
    mesh(new CircleGeometry(0.22, 8), glow("#ffffff"), -0.6, 0.9, -0.03),
  );
  root.add(mesh(new CircleGeometry(0.22, 8), glow("#ffffff"), 0.6, 0.9, -0.03));
  root.children.slice(-2).forEach((m) => (m.rotation.y = Math.PI));
  // A blinking warning sign over the lane while it's coming.
  const warning = mesh(
    new ConeGeometry(0.5, 0.8, 3),
    glow("#ffd23f"),
    0,
    4.2,
    0,
  );
  warning.rotation.x = Math.PI;
  root.add(warning);
  return { root, warning };
}

// Power-ups

export function makePickup(kind: PowerUpKind): Group {
  const g = new Group();
  const color = POWER_COLORS[kind];
  const ring = mesh(new TorusGeometry(0.62, 0.05, 6, 20), glow(color), 0, 0, 0);
  g.add(ring);
  g.add(mesh(new CircleGeometry(0.58, 16), glow(color, 0.25)));
  const icon = new Group();
  if (kind === "warp") {
    icon.add(mesh(new ConeGeometry(0.22, 0.6, 6), lambert(color), 0, 0.05, 0));
    icon.add(
      mesh(
        new CylinderGeometry(0.08, 0.12, 0.3, 6),
        glow("#ffffff"),
        0,
        -0.35,
        0,
      ),
    );
  } else if (kind === "magnet") {
    const u = mesh(
      new TorusGeometry(0.24, 0.09, 6, 12, Math.PI),
      lambert(color),
      0,
      0.05,
      0,
    );
    u.rotation.z = Math.PI;
    icon.add(u);
    icon.add(mesh(box(0.18, 0.12, 0.18), lambert("#e8edf7"), -0.24, 0.1, 0));
    icon.add(mesh(box(0.18, 0.12, 0.18), lambert("#e8edf7"), 0.24, 0.1, 0));
  } else if (kind === "boots") {
    icon.add(mesh(box(0.22, 0.32, 0.24), lambert(color), -0.14, 0, 0));
    icon.add(mesh(box(0.22, 0.32, 0.24), lambert(color), 0.14, 0, 0));
    icon.add(mesh(box(0.56, 0.08, 0.3), glow("#ffffff"), 0, -0.2, 0.03));
  } else if (kind === "twin") {
    icon.add(mesh(new OctahedronGeometry(0.2), lambert(color), -0.15, 0.08, 0));
    icon.add(mesh(new OctahedronGeometry(0.2), lambert(color), 0.15, -0.08, 0));
  } else {
    icon.add(
      mesh(new IcosahedronGeometry(0.3, 1), lambert(color, { opacity: 0.7 })),
    );
  }
  g.add(icon);
  g.userData.icon = icon;
  g.userData.ring = ring;
  return g;
}

// Track

export const SEGMENT = 12;
export const DECK_WIDTH = 7.6;

/** One 12 m piece of the Ring Rail, recycled as you run. */
export function makeSegment(world: World, laneWidth: number): Group {
  const g = new Group();
  const d = world.deck;
  g.add(
    mesh(
      box(DECK_WIDTH, 0.5, SEGMENT),
      lambert(d.color),
      0,
      -0.25,
      SEGMENT / 2,
    ),
  );
  // Lane dividers and a cross line every segment.
  for (const x of [-laneWidth / 2, laneWidth / 2])
    g.add(
      mesh(
        box(0.08, 0.02, SEGMENT * 0.6),
        glow(d.stripe),
        x,
        0.01,
        SEGMENT / 2,
      ),
    );
  g.add(mesh(box(DECK_WIDTH - 0.6, 0.02, 0.12), glow(d.stripe), 0, 0.01, 0.2));
  // Side walls with a glowing edge.
  for (const side of [-1, 1]) {
    const x = side * (DECK_WIDTH / 2 + 0.15);
    g.add(mesh(box(0.3, 0.7, SEGMENT), lambert(d.side), x, 0.1, SEGMENT / 2));
    g.add(
      mesh(
        box(0.08, 0.06, SEGMENT),
        glow(d.glow),
        x - side * 0.17,
        0.45,
        SEGMENT / 2,
      ),
    );
    // A lamp post.
    g.add(
      mesh(
        new CylinderGeometry(0.06, 0.08, 3.2, 5),
        lambert(d.side),
        x,
        1.9,
        2,
      ),
    );
    g.add(
      mesh(
        new SphereGeometry(0.18, 6, 4),
        glow(d.glow),
        x - side * 0.25,
        3.5,
        2,
      ),
    );
  }
  // Supports under the rail, disappearing into the fog below.
  g.add(
    mesh(box(1.2, 14, 1.2), lambert(world.deck.side), 0, -7.4, SEGMENT / 2),
  );
  return g;
}

// Skyline

/** One building or landmark beside the track, in the world's style. */
export function makeSkylinePiece(world: World, rng: Rng): Group {
  const s = world.skyline;
  const g = new Group();
  const color = s.colors[Math.floor(rng() * s.colors.length)];
  const [lo, hi] = s.height;
  const h = lo + rng() * (hi - lo);
  const lights = glow(s.lights);
  switch (s.kind) {
    case "domes": {
      const r = h * 0.5;
      g.add(
        mesh(
          new SphereGeometry(r, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
          lambert(color),
        ),
      );
      g.add(
        mesh(
          new CylinderGeometry(r * 1.02, r * 1.05, 0.6, 12),
          lambert(world.deck.side),
          0,
          0.3,
          0,
        ),
      );
      for (let i = 0; i < 4; i++) {
        const a = rng() * Math.PI * 2;
        g.add(
          mesh(
            box(0.5, 0.3, 0.05),
            lights,
            Math.cos(a) * r * 0.75,
            r * 0.45,
            Math.sin(a) * r * 0.75,
          ),
        );
      }
      if (rng() < 0.5) {
        g.add(
          mesh(
            new CylinderGeometry(0.06, 0.06, 3, 4),
            lambert(color),
            0,
            r + 1.5,
            0,
          ),
        );
        g.add(mesh(new SphereGeometry(0.2, 6, 4), lights, 0, r + 3, 0));
      }
      break;
    }
    case "mesas": {
      const w = 3 + rng() * 6;
      g.add(mesh(box(w, h, w * 0.8), lambert(color), 0, h / 2, 0));
      g.add(
        mesh(
          box(w * 0.7, h * 0.3, w * 0.6),
          lambert(s.colors[0]),
          0,
          h + h * 0.15,
          0,
        ),
      );
      for (let i = 0; i < 3; i++)
        g.add(
          mesh(
            box(0.4, 0.4, 0.05),
            lights,
            (rng() - 0.5) * w * 0.7,
            h * (0.3 + rng() * 0.5),
            w * 0.4 + 0.01,
          ),
        );
      break;
    }
    case "spires": {
      g.add(
        mesh(
          new ConeGeometry(0.8 + rng() * 1.2, h, 5),
          lambert(color, { opacity: 0.9 }),
          0,
          h / 2,
          0,
        ),
      );
      g.add(
        mesh(
          new ConeGeometry(0.5, h * 0.6, 5),
          lambert(s.colors[2]),
          1.2,
          h * 0.3,
          0.4,
        ),
      );
      g.add(mesh(new OctahedronGeometry(0.35), lights, 0, h + 0.5, 0));
      break;
    }
    case "rings": {
      g.add(
        mesh(
          new CylinderGeometry(0.5, 0.7, h, 6),
          lambert(world.deck.side),
          0,
          h / 2,
          0,
        ),
      );
      const ring = mesh(
        new TorusGeometry(1.6 + rng() * 1.5, 0.25, 6, 18),
        lambert(color),
        0,
        h,
        0,
      );
      ring.rotation.x = Math.PI / 2 - 0.3 + rng() * 0.6;
      g.add(ring);
      g.add(mesh(new DodecahedronGeometry(0.6), lights, 0, h, 0));
      break;
    }
  }
  return g;
}

/** Turns a CSS colour into a THREE.Color (for fog, background and lights). */
export const color = (css: string) => new Color(css);
