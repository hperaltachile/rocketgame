import type Phaser from "phaser";
import { MOVER, ROWS, TILE, VIEW_W } from "@/lib/games/astro-hop/config";
import type { Theme } from "@/lib/games/astro-hop/levels";
import { textWidth } from "@/lib/pixelFont";
import {
  addBanner,
  addSheet,
  addTexture,
  BANNER,
  Pixels,
  seeded,
  starField,
  type Point,
} from "../shared/pixel";

/**
 * Every Astro Hop texture, drawn in code one art pixel at a time. The scene
 * works in art pixels (a tile is 16), so textures are shown at scale 1.
 */

const INK = "#140c2c";
const WHITE = "#fff4e6";

// ---------------------------------------------------------------- Kit

export const KIT_FRAME = {
  idle: 0,
  walkA: 1,
  walkB: 2,
  walkC: 3,
  jump: 4,
  fall: 5,
  skid: 6,
  throw: 7,
  dead: 8,
} as const;

type KitPose = keyof typeof KIT_FRAME;

type KitPalette = {
  fur: string;
  shade: string;
  scarf: string;
  scarfDark: string;
  pack: string;
  packLight: string;
};

const KIT_PALETTE: KitPalette = {
  fur: "#ff8a3d",
  shade: "#c4521f",
  scarf: "#ff3b3b",
  scarfDark: "#b91c1c",
  pack: "#6d28d9",
  packLight: "#a78bfa",
};

/** With a Comet Berry: a sky-blue scarf and a golden backpack. */
const FIRE_PALETTE: KitPalette = {
  ...KIT_PALETTE,
  scarf: "#4cc9f0",
  scarfDark: "#2272b8",
  pack: "#ffb703",
  packLight: "#fff27a",
};

const KIT_SHAPE = {
  small: {
    h: 16,
    legTop: 12,
    feet: 14,
    bodyCy: 10,
    bodyRx: 3.6,
    bodyRy: 2.6,
    headCx: 9.5,
    headCy: 5.5,
    headR: 3.3,
    earTop: 1,
    tailCy: 9.5,
    tailRx: 2.6,
    tailRy: 2,
    packX: 4,
    packY: 7,
    packW: 3,
    packH: 4,
    scarfY: 8,
    scarfH: 1,
  },
  big: {
    h: 32,
    legTop: 23,
    feet: 30,
    bodyCy: 18.5,
    bodyRx: 4.2,
    bodyRy: 5.5,
    headCx: 8.8,
    headCy: 8.5,
    headR: 4.2,
    earTop: 1,
    tailCy: 18,
    tailRx: 3,
    tailRy: 3,
    packX: 3,
    packY: 13,
    packW: 3,
    packH: 8,
    scarfY: 13,
    scarfH: 2,
  },
};

/** Leg x positions and lifts (back leg, front leg) for each pose. */
const LEGS: Record<KitPose, [number, number, number, number]> = {
  idle: [6, 0, 9, 0],
  walkA: [5, 0, 10, 0],
  walkB: [6, 1, 9, 0],
  walkC: [7, 0, 8, 1],
  jump: [5, 2, 10, 1],
  fall: [6, 0, 10, 0],
  skid: [4, 0, 9, 0],
  throw: [6, 0, 9, 0],
  dead: [5, 2, 10, 2],
};

function kitArt(big: boolean, pose: KitPose, pal: KitPalette): Pixels {
  const s = big ? KIT_SHAPE.big : KIT_SHAPE.small;
  const p = new Pixels(16, s.h);
  const lean = pose === "skid" ? -1 : 0;
  const hx = s.headCx + lean;

  // Bushy tail (behind), with a white tip; it flicks up when jumping.
  const flick = pose === "jump" || pose === "fall" ? -1 : 0;
  p.ellipse(3.5, s.tailCy + flick, s.tailRx, s.tailRy, pal.shade);
  p.ellipse(
    3.5,
    s.tailCy + flick - 0.5,
    s.tailRx - 0.4,
    s.tailRy - 0.5,
    pal.fur,
  );
  p.ellipse(2, s.tailCy + flick - s.tailRy * 0.5, 1.2, 1, WHITE);

  // Legs.
  const [bx, bl, fx, fl] = LEGS[pose];
  const leg = (x: number, lift: number, color: string) => {
    const h = s.feet - s.legTop + 1 - lift;
    p.rect(x, s.legTop, 2, h, color);
    p.rect(x, s.legTop + h - 1, 2, 1, "#3a1a0a");
  };
  leg(bx, bl, "#7a3a18");

  // Backpack, body and belly.
  p.rect(s.packX, s.packY, s.packW, s.packH, pal.pack);
  p.rect(s.packX, s.packY, s.packW, 1, pal.packLight);
  p.ellipse(8, s.bodyCy + 0.5, s.bodyRx, s.bodyRy, pal.shade);
  p.ellipse(8, s.bodyCy, s.bodyRx - 0.4, s.bodyRy - 0.4, pal.fur);
  p.ellipse(9.5, s.bodyCy + 0.8, s.bodyRx * 0.45, s.bodyRy * 0.55, WHITE);
  leg(fx, fl, "#5b2a12");
  if (pose === "throw") p.rect(11, s.bodyCy - 1, 4, big ? 2 : 1, pal.fur);

  // Head: ears, face, muzzle, nose and eye.
  const cy = s.headCy;
  const r = s.headR;
  p.poly(
    [
      [hx - 2.8, cy - 1.5],
      [hx - 1.6, s.earTop],
      [hx + 0.2, cy - 2.6],
    ] as Point[],
    pal.fur,
  );
  p.poly(
    [
      [hx + 0.4, cy - 2.6],
      [hx + 2.2, s.earTop],
      [hx + 3, cy - 1.2],
    ] as Point[],
    pal.fur,
  );
  p.px(hx + 2, s.earTop + 2, pal.shade).px(hx - 1.6, s.earTop + 2, pal.shade);
  p.disc(hx, cy + 0.4, r, pal.shade);
  p.disc(hx, cy, r - 0.3, pal.fur);
  p.ellipse(hx + r * 0.75, cy + 1, r * 0.62, r * 0.4, WHITE);
  p.px(Math.min(14, hx + r + 1), cy + 0.5, INK);
  if (pose === "dead") {
    p.px(hx + 0.5, cy - 1.5, INK).px(hx + 1.5, cy - 0.5, INK);
    p.px(hx + 1.5, cy - 1.5, INK).px(hx + 0.5, cy - 0.5, INK);
  } else {
    p.rect(hx + 1, cy - 1.2, 1, big ? 2 : 1, INK);
  }

  // Scarf, with its end streaming behind.
  p.rect(hx - 3, s.scarfY, 6, s.scarfH, pal.scarf);
  const flutter = pose === "walkA" || pose === "walkC" || pose === "jump";
  p.rect(hx - 5, s.scarfY + (flutter ? 0 : 1), 2, s.scarfH + 1, pal.scarfDark);
  return p.outline(INK);
}

function kitSheet(big: boolean, pal: KitPalette): Pixels[] {
  return (Object.keys(KIT_FRAME) as KitPose[]).map((pose) =>
    kitArt(big, pose, pal),
  );
}

// ---------------------------------------------------------------- enemies

export const ENEMY_FRAME = {
  walkA: 0,
  walkB: 1,
  squashed: 2,
} as const;

function grumbleArt(frame: number): Pixels {
  const p = new Pixels(16, 16);
  if (frame === ENEMY_FRAME.squashed) {
    p.ellipse(8, 13, 6.5, 1.8, "#2f9e44");
    p.ellipse(8, 12.6, 6, 1.4, "#7ee86a");
    p.rect(5, 12, 2, 1, INK).rect(9, 12, 2, 1, INK);
    return p.outline(INK);
  }
  // Antenna, then the lime blob body.
  p.line(8, 5, 8, 2, "#2f9e44");
  p.disc(8, 2, 1, "#f472b6");
  p.ellipse(8, 10, 6.2, 4.6, "#2f9e44");
  p.ellipse(8, 9.5, 5.8, 4.2, "#7ee86a");
  p.ellipse(5.5, 7.5, 2, 1, "#c8ffb0");
  // Grumpy eyes and frown.
  p.rect(4, 8, 3, 3, "#ffffff").rect(9, 8, 3, 3, "#ffffff");
  p.rect(5, 9, 1, 2, INK).rect(10, 9, 1, 2, INK);
  p.line(4, 7, 6, 8, INK).line(11, 7, 9, 8, INK);
  p.line(6, 12, 9, 12, INK).px(5, 13, INK).px(10, 13, INK);
  // Little feet.
  const step = frame === ENEMY_FRAME.walkA ? 0 : 1;
  p.rect(3 + step, 14, 3, 1, "#1b6e30").rect(10 - step, 14, 3, 1, "#1b6e30");
  return p.outline(INK);
}

export const SHELLBOT_FRAME = {
  walkA: 0,
  walkB: 1,
  /** Shell frames 2–5: the stripe goes round as it spins. */
  shell: 2,
} as const;

function shellbotArt(frame: number): Pixels {
  const p = new Pixels(16, 20);
  const shellOnly = frame >= SHELLBOT_FRAME.shell;
  const top = shellOnly ? 8 : 4;
  // Domed shell (faces left; the scene flips it).
  p.ellipse(8.5, top + 7, 6.5, 6.5, "#2272b8");
  p.ellipse(8.5, top + 6.5, 6, 6, "#4cc9f0");
  p.clear(0, top + 9, 16, 12);
  p.rect(2, top + 8, 13, 2, "#1b4f8a");
  p.ellipse(6.5, top + 3, 2, 1.2, "#c8f4ff");
  if (shellOnly) {
    const spin = frame - SHELLBOT_FRAME.shell;
    const x = [4, 7, 10, 13][spin];
    p.rect(x, top + 1, 1, 7, "#ffd166");
    p.rect(2, top + 10, 13, 1, "#1b4f8a");
    return p.outline(INK);
  }
  // Rivets, robot head with a red eye, and legs.
  p.px(6, top + 8, "#c8f4ff").px(11, top + 8, "#c8f4ff");
  p.disc(3, top + 9, 2.4, "#c7d2fe");
  p.rect(1, top + 8, 2, 1, "#ff3b3b");
  const step = frame === SHELLBOT_FRAME.walkA ? 0 : 1;
  for (const [i, x] of [5, 9, 13].entries()) {
    const lift = (i + step) % 2;
    p.rect(x - 1, top + 10, 1, 4 - lift, "#3d4a8a");
  }
  return p.outline(INK);
}

export const BOING_FRAME = { sit: 0, jump: 1, squashed: 2 } as const;

function boingArt(frame: number): Pixels {
  const p = new Pixels(16, 16);
  const pink = "#f472b6";
  const dark = "#be185d";
  if (frame === BOING_FRAME.squashed) {
    p.ellipse(8, 13, 6.5, 1.8, dark).ellipse(8, 12.6, 6, 1.3, pink);
    p.rect(5, 12, 2, 1, INK).rect(9, 12, 2, 1, INK);
    return p.outline(INK);
  }
  const jump = frame === BOING_FRAME.jump;
  const cy = jump ? 8 : 10.5;
  if (jump) {
    p.rect(3, cy + 3, 2, 5, dark).rect(11, cy + 3, 2, 5, dark);
  } else {
    p.ellipse(3, 13, 2.2, 1.5, dark).ellipse(13, 13, 2.2, 1.5, dark);
  }
  p.ellipse(8, cy, 6, 4, dark);
  p.ellipse(8, cy - 0.4, 5.6, 3.6, pink);
  p.ellipse(8, cy + 1.5, 3, 1.5, "#ffd1e8");
  p.disc(5, cy - 4, 2, "#ffffff").disc(11, cy - 4, 2, "#ffffff");
  p.px(5, cy - 4, INK).px(11, cy - 4, INK);
  p.line(6, cy + 1, 10, cy + 1, INK);
  return p.outline(INK);
}

// ---------------------------------------------------------------- items

function seedArt(frame: number): Pixels {
  const p = new Pixels(16, 16);
  const glow = frame === 1;
  p.ellipse(8, 10, 4.5, 4.5, glow ? "#ffb703" : "#e09f1f");
  p.ellipse(8, 9.6, 4, 4, glow ? "#fff27a" : "#ffd166");
  p.ellipse(6.5, 8.5, 1.2, 1.8, "#ffffff");
  p.ellipse(8, 5.5, 5.5, 2.4, "#6b3a1f");
  p.ellipse(8, 5, 5, 1.8, "#8b5a2b");
  p.rect(8, 1, 1, 3, "#6b3a1f");
  p.px(6, 5, "#b07a45").px(10, 5, "#b07a45");
  if (glow) p.px(13, 8, "#ffffff").px(3, 12, "#ffffff");
  return p.outline(INK);
}

function berryArt(frame: number): Pixels {
  const p = new Pixels(16, 16);
  p.disc(8, 10, 4.6, "#2272b8");
  p.disc(8, 9.6, 4.1, "#4cc9f0");
  p.disc(6.5, 8.5, 1.3, "#c8f4ff");
  p.poly(
    [
      [8, 6],
      [12, 2],
      [13, 4],
    ] as Point[],
    "#7ee86a",
  );
  p.rect(8, 4, 1, 2, "#2f9e44");
  if (frame === 1) {
    p.px(2, 6, "#fff27a").px(14, 11, "#fff27a").px(3, 14, "#ffffff");
  }
  return p.outline(INK);
}

function lifeArt(): Pixels {
  // A mint badge with Kit's face on it.
  const p = new Pixels(16, 16);
  p.disc(8, 9, 6, "#1b8a6b");
  p.disc(8, 8.6, 5.5, "#7ee8c9");
  p.poly(
    [
      [4.5, 7],
      [5.5, 3],
      [7.5, 6],
    ] as Point[],
    KIT_PALETTE.fur,
  );
  p.poly(
    [
      [8.5, 6],
      [10.5, 3],
      [11.5, 7],
    ] as Point[],
    KIT_PALETTE.fur,
  );
  p.disc(8, 9, 3.3, KIT_PALETTE.fur);
  p.ellipse(8, 10.5, 2, 1.2, WHITE);
  p.px(7, 8, INK).px(9, 8, INK).px(8, 10, INK);
  return p.outline(INK);
}

/** Star coin, turning: 4 frames getting narrower and back. */
function coinArt(frame: number): Pixels {
  const p = new Pixels(16, 16);
  const sx = [1, 0.6, 0.18, 0.6][frame];
  const star = (r: number, inner: number, cx: number, cy: number): Point[] =>
    Array.from({ length: 10 }, (_, i) => {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? inner : r;
      return [cx + Math.cos(a) * rr * sx, cy + Math.sin(a) * rr];
    });
  if (frame === 2) {
    p.rect(7, 2, 2, 12, "#e09f1f").rect(7, 3, 1, 10, "#fff27a");
  } else {
    p.poly(star(7, 3.3, 8, 8.5), "#e09f1f");
    p.poly(star(5.6, 2.6, 8, 8.2), "#ffd166");
    p.px(7, 6, "#ffffff").px(7, 7, "#fff27a");
  }
  return p.outline(INK);
}

function sparkArt(frame: number): Pixels {
  const p = new Pixels(8, 8);
  p.disc(4, 4, 2.6, "#ff7a45");
  p.disc(4, 4, 1.4, "#fff27a");
  if (frame === 0) p.px(1, 1, "#4cc9f0").px(6, 6, "#4cc9f0");
  else p.px(6, 1, "#4cc9f0").px(1, 6, "#4cc9f0");
  return p;
}

// ---------------------------------------------------------------- themes

type Palette = {
  sky: string[];
  stars: boolean;
  grass: string;
  grassDark: string;
  dirt: string;
  dirtDark: string;
  pebble: string;
  brick: string;
  brickDark: string;
  mortar: string;
  hard: string;
  hardLight: string;
  hardDark: string;
  tube: string;
  tubeLight: string;
  tubeDark: string;
  bridge: string;
  bridgeDark: string;
};

const PALETTES: Record<Theme, Palette> = {
  plains: {
    sky: ["#2b3fa8", "#3a86ff", "#7cc4ff", "#c8f4ff"],
    stars: true,
    grass: "#7ee86a",
    grassDark: "#2f9e44",
    dirt: "#c2703d",
    dirtDark: "#8a4a22",
    pebble: "#e8a46a",
    brick: "#e8590c",
    brickDark: "#a33d0a",
    mortar: "#5c1f05",
    hard: "#b08968",
    hardLight: "#e6c9a8",
    hardDark: "#6b4a2e",
    tube: "#3fb7a8",
    tubeLight: "#a8f0e4",
    tubeDark: "#1d6e66",
    bridge: "#d9a066",
    bridgeDark: "#8a5a2b",
  },
  caves: {
    sky: ["#05030f", "#120a2a", "#1d1442"],
    stars: false,
    grass: "#8b7fd6",
    grassDark: "#4b3f9e",
    dirt: "#3b3470",
    dirtDark: "#241e4a",
    pebble: "#7ee8f0",
    brick: "#4a5bb8",
    brickDark: "#2d3a85",
    mortar: "#151034",
    hard: "#5d5a8a",
    hardLight: "#9a97c8",
    hardDark: "#2e2b52",
    tube: "#9d6bd6",
    tubeLight: "#dcc3ff",
    tubeDark: "#5b2a86",
    bridge: "#c084fc",
    bridgeDark: "#6d28d9",
  },
  sky: {
    sky: ["#1d1442", "#5b2a86", "#c0428a", "#ff9f5a"],
    stars: true,
    grass: "#ffffff",
    grassDark: "#f5c6dd",
    dirt: "#9a7fd1",
    dirtDark: "#5f4a9e",
    pebble: "#d8c8ff",
    brick: "#d9467a",
    brickDark: "#9d174d",
    mortar: "#4a0c26",
    hard: "#a0a8d0",
    hardLight: "#e8ecff",
    hardDark: "#5a6290",
    tube: "#ffb347",
    tubeLight: "#ffe4b5",
    tubeDark: "#c46a0c",
    bridge: "#7ee8f0",
    bridgeDark: "#2b9fb0",
  },
};

function brickArt(pal: Palette): Pixels {
  const p = new Pixels(16, 16).rect(0, 0, 16, 16, pal.brick);
  for (let row = 0; row < 4; row++) {
    const y = row * 4;
    p.rect(0, y + 3, 16, 1, pal.mortar);
    p.rect(0, y, 16, 1, pal.brickDark);
    const off = row % 2 ? 4 : 0;
    for (let x = off; x < 16; x += 8) p.rect(x, y, 1, 3, pal.mortar);
  }
  p.rect(0, 0, 16, 1, pal.mortar);
  return p;
}

const STAR_POINTS = (cx: number, cy: number, r: number, inner: number) =>
  Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? inner : r;
    return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr] as Point;
  });

/** Star block frames 0–2 shimmer; frame 3 is the used block. */
export const BLOCK_FRAME = { used: 3 } as const;

function starBlockArt(frame: number): Pixels {
  const p = new Pixels(16, 16).rect(0, 0, 16, 16, INK);
  if (frame === BLOCK_FRAME.used) {
    p.rect(1, 1, 14, 14, "#7a6a58").rect(1, 1, 14, 1, "#a8977f");
    p.rect(1, 14, 14, 1, "#4a3e30");
    for (const [x, y] of [
      [3, 3],
      [12, 3],
      [3, 12],
      [12, 12],
    ])
      p.px(x, y, "#4a3e30");
    return p;
  }
  p.rect(1, 1, 14, 14, "#6d28d9");
  p.rect(1, 1, 14, 1, "#ffd166").rect(1, 1, 1, 14, "#ffd166");
  p.rect(1, 14, 14, 1, "#3b1678").rect(14, 1, 1, 14, "#3b1678");
  const glow = ["#ffd166", "#fff27a", "#ffffff"][frame];
  p.poly(STAR_POINTS(8, 8.3, 5.2, 2.3), "#e09f1f");
  p.poly(STAR_POINTS(8, 8, 4.4, 1.9), glow);
  return p;
}

function hardArt(pal: Palette): Pixels {
  const p = new Pixels(16, 16).rect(0, 0, 16, 16, pal.hardDark);
  p.rect(0, 0, 15, 15, pal.hardLight);
  p.rect(1, 1, 14, 14, pal.hard);
  p.rect(1, 14, 15, 1, pal.hardDark).rect(14, 1, 1, 14, pal.hardDark);
  p.px(4, 4, pal.hardLight).px(11, 10, pal.hardDark);
  return p;
}

function groundArt(pal: Palette, theme: Theme, top: boolean, seed: number) {
  const p = new Pixels(16, 16).rect(0, 0, 16, 16, pal.dirt);
  const rng = seeded(seed);
  for (let i = 0; i < 5; i++) {
    const x = Math.floor(rng() * 15);
    const y = Math.floor(rng() * 15);
    p.rect(x, y, 2, 1, pal.dirtDark);
    if (rng() < 0.4) p.px(x, y - 1, pal.pebble);
  }
  if (top) {
    if (theme === "sky") {
      // Fluffy cloud top.
      p.rect(0, 0, 16, 5, pal.grass);
      for (let x = 0; x < 16; x += 4) p.disc(x + 2, 4, 2.2, pal.grass);
      p.rect(0, 6, 16, 1, pal.grassDark);
    } else if (theme === "caves") {
      p.rect(0, 0, 16, 2, pal.grass).rect(0, 2, 16, 1, pal.grassDark);
      p.px(3, 1, pal.pebble).px(11, 0, "#ffffff");
    } else {
      p.rect(0, 0, 16, 4, pal.grass);
      for (let x = 0; x < 16; x += 3) p.px(x, 4, pal.grass);
      p.rect(0, 5, 16, 1, pal.grassDark);
      p.px(2, 0, "#c8ffb0").px(9, 1, "#c8ffb0");
    }
  }
  return p;
}

/** The underside of the cave ceiling: a fringe of little stalactites. */
function ceilingEdgeArt(pal: Palette): Pixels {
  const p = new Pixels(16, 16).rect(0, 0, 16, 13, pal.dirt);
  p.rect(0, 12, 16, 1, pal.dirtDark);
  p.poly(
    [
      [2, 12],
      [4, 16],
      [6, 12],
    ] as Point[],
    pal.dirtDark,
  );
  p.poly(
    [
      [9, 12],
      [10.5, 15],
      [12, 12],
    ] as Point[],
    pal.dirtDark,
  );
  p.px(4, 13, pal.pebble);
  return p;
}

/** Below a floating island: rock that tapers to a point. */
function undersideArt(pal: Palette): Pixels {
  const p = new Pixels(16, 16);
  p.poly(
    [
      [0, 0],
      [16, 0],
      [12, 7],
      [8, 13],
      [5, 6],
    ] as Point[],
    pal.dirtDark,
  );
  p.rect(0, 0, 16, 2, pal.dirt);
  p.px(9, 4, pal.pebble).px(4, 1, pal.pebble);
  return p;
}

function bridgeArt(pal: Palette, theme: Theme): Pixels {
  const p = new Pixels(16, 16);
  if (theme === "sky") {
    p.rect(0, 0, 16, 4, pal.bridge).rect(0, 0, 16, 1, "#ffffff");
    p.rect(0, 4, 16, 1, pal.bridgeDark);
    p.px(3, 6, pal.bridge).px(11, 7, pal.bridge);
    return p;
  }
  p.rect(0, 0, 16, 5, pal.bridge).rect(0, 0, 16, 1, "#ffffff");
  p.rect(0, 4, 16, 1, pal.bridgeDark);
  p.px(2, 2, pal.bridgeDark).px(13, 2, pal.bridgeDark);
  p.rect(3, 5, 1, 3, pal.bridgeDark).rect(12, 5, 1, 3, pal.bridgeDark);
  return p;
}

/** One cell of a 2-wide launch tube. */
function tubeArt(
  pal: Palette,
  side: "left" | "right",
  rim: "top" | "bottom" | null,
) {
  const p = new Pixels(16, 16);
  const body = (x0: number, x1: number, y0: number, y1: number) => {
    for (let x = x0; x <= x1; x++) {
      // Shading across the whole 32-px tube.
      const gx = side === "left" ? x : x + 16;
      const color = gx < 6 ? pal.tubeLight : gx < 22 ? pal.tube : pal.tubeDark;
      p.rect(x, y0, 1, y1 - y0 + 1, color);
    }
  };
  if (side === "left") {
    p.rect(1, 0, 1, 16, INK);
    body(2, 15, 0, 15);
  } else {
    p.rect(14, 0, 1, 16, INK);
    body(0, 13, 0, 15);
  }
  // Bands and bolts.
  p.rect(0, 9, 16, 1, pal.tubeDark);
  if (side === "left") p.px(4, 10, pal.tubeLight);
  if (rim) {
    const y = rim === "top" ? 0 : 9;
    p.clear(0, y, 16, 7);
    if (side === "left") {
      p.rect(0, y, 16, 7, INK);
      p.rect(1, y + 1, 15, 5, pal.tube);
      p.rect(1, y + 1, 4, 5, pal.tubeLight);
    } else {
      p.rect(0, y, 16, 7, INK);
      p.rect(0, y + 1, 15, 5, pal.tube);
      p.rect(9, y + 1, 6, 5, pal.tubeDark);
    }
  }
  return p;
}

// ---------------------------------------------------------------- level art

type Grid = string[][];

const at = (grid: Grid, col: number, row: number) =>
  col < 0 || col >= grid[0].length || row < 0 || row >= ROWS
    ? "."
    : grid[row][col];

/**
 * The level's fixed tiles (ground, hard blocks, tubes, bridges, the pole
 * and its base) drawn onto canvases 64 tiles wide, ready to be textures.
 */
export function levelChunks(grid: Grid, theme: Theme, poleTop: number) {
  const pal = PALETTES[theme];
  const cols = grid[0].length;
  const hard = hardArt(pal);
  const tops = [0, 1, 2].map((i) => groundArt(pal, theme, true, 11 + i));
  const fills = [0, 1, 2].map((i) => groundArt(pal, theme, false, 23 + i));
  const ceiling = ceilingEdgeArt(pal);
  const underside = undersideArt(pal);
  const bridge = bridgeArt(pal, theme);
  const tubes = new Map<string, Pixels>();
  const tube = (side: "left" | "right", rim: "top" | "bottom" | null) => {
    const key = `${side}-${rim}`;
    if (!tubes.has(key)) tubes.set(key, tubeArt(pal, side, rim));
    return tubes.get(key)!;
  };

  const CHUNK = 64;
  const chunks: Pixels[] = [];
  for (let c0 = 0; c0 < cols; c0 += CHUNK) {
    const w = Math.min(CHUNK, cols - c0);
    const p = new Pixels(w * TILE, ROWS * TILE);
    for (let row = 0; row < ROWS; row++) {
      for (let col = c0; col < c0 + w; col++) {
        const ch = grid[row][col];
        const x = (col - c0) * TILE;
        const y = row * TILE;
        const variant = (col * 7 + row * 3) % 3;
        if (theme === "sky" && ch !== "#" && at(grid, col, row - 1) === "#") {
          // Floating islands: rock tapering off underneath.
          p.stamp(underside, x, y);
        }
        if (ch === "#") {
          const above = at(grid, col, row - 1);
          const below = at(grid, col, row + 1);
          if (above !== "#" && row > 0) p.stamp(tops[variant], x, y);
          else if (theme === "caves" && below !== "#" && row < ROWS - 1)
            p.stamp(ceiling, x, y);
          else p.stamp(fills[variant], x, y);
        } else if (ch === "X" || ch === "F") {
          p.stamp(hard, x, y);
        } else if (ch === "_") {
          p.stamp(bridge, x, y);
        } else if (ch === "T") {
          const side = at(grid, col - 1, row) === "T" ? "right" : "left";
          const above = at(grid, col, row - 1);
          const below = at(grid, col, row + 1);
          const rim =
            above !== "T" && above !== "#"
              ? "top"
              : below !== "T" && below !== "#"
                ? "bottom"
                : null;
          p.stamp(tube(side, rim), x, y);
        }
        if (ch === "F") {
          // The beacon pole, with a star on top.
          const px = x + TILE / 2 - 1;
          p.rect(px, poleTop, 2, y - poleTop, "#e8ecff");
          p.rect(px + 1, poleTop, 1, y - poleTop, "#9aa6d8");
          p.poly(STAR_POINTS(px + 1, poleTop - 4, 4.5, 2), "#ffd166");
        }
      }
    }
    chunks.push(p);
  }
  return chunks;
}

// ---------------------------------------------------------------- backgrounds

function skyArt(theme: Theme): Pixels {
  const pal = PALETTES[theme];
  const p = new Pixels(VIEW_W, ROWS * TILE);
  p.gradient(0, 0, p.w, p.h, pal.sky);
  const rng = seeded(theme.length * 97);
  if (pal.stars)
    starField(p, theme === "sky" ? 70 : 25, theme === "sky" ? 120 : 50, rng);
  if (theme === "plains") {
    // A ringed planet hanging in the daytime sky.
    p.ellipse(290, 46, 30, 6, "#e8ecff");
    p.disc(290, 46, 18, "#a78bfa").disc(286, 42, 15, "#c4b5fd");
    // The front of the ring passes over the planet.
    p.rect(262, 47, 57, 2, "#e8ecff");
    p.disc(60, 30, 5, "#ffffff").disc(58, 28, 4, "#e8f6ff");
  } else if (theme === "sky") {
    p.disc(80, 70, 34, "#ffb3c7").disc(72, 62, 28, "#ffd1dc");
  } else {
    p.dither(0, 0, p.w, 60, null, "#2a1d5c", 0.25);
  }
  return p;
}

/** Far parallax layer: hills, crystal pillars or a sea of clouds. */
function farArt(theme: Theme): Pixels {
  const p = new Pixels(VIEW_W, ROWS * TILE);
  const rng = seeded(7 + theme.length);
  if (theme === "plains") {
    for (let i = 0; i < 5; i++) {
      const x = i * 80 + 20;
      p.ellipse(x, 190, 70, 50, "#2fbf8f");
      p.ellipse(x - 10, 180, 50, 36, "#5fd4a8");
    }
    p.dither(0, 160, p.w, 80, null, "#1b8a6b", 0.3);
    for (let i = 0; i < 4; i++) {
      const cx = 40 + i * 95 + rng() * 20;
      const cy = 60 + rng() * 40;
      for (let j = 0; j < 4; j++)
        p.disc(cx + j * 9, cy - (j % 2) * 4, 8, "#ffffff");
      p.rect(cx - 6, cy + 4, 40, 4, "#dbeafe");
    }
  } else if (theme === "caves") {
    for (let x = 0; x < p.w; x += 30) {
      const h = 60 + rng() * 80;
      p.poly(
        [
          [x, 240],
          [x + 8, 240 - h],
          [x + 16, 240],
        ] as Point[],
        "#2a1d5c",
      );
      p.poly(
        [
          [x + 12, 0],
          [x + 18, 40 + rng() * 50],
          [x + 24, 0],
        ] as Point[],
        "#22184d",
      );
      if (rng() < 0.5) p.px(x + 8, 240 - h + 6, "#7ee8f0");
    }
  } else {
    // A far-off sea of clouds, deep below the bridges.
    p.rect(0, 232, p.w, 8, "#8a3a7a");
    for (let x = 0; x < p.w; x += 20) p.disc(x + 10, 232, 7, "#8a3a7a");
    p.dither(0, 222, p.w, 18, null, "#b04a8a", 0.25);
  }
  return p;
}

/** Near parallax layer: bushes, glowing crystals or puffy clouds. */
function nearArt(theme: Theme): Pixels {
  const p = new Pixels(VIEW_W, ROWS * TILE);
  const rng = seeded(31 + theme.length);
  if (theme === "plains") {
    for (let x = 0; x < p.w; x += 36) {
      const cx = x + rng() * 12;
      p.disc(cx, 214, 12, "#1b8a6b").disc(cx + 12, 216, 10, "#1b8a6b");
      p.disc(cx - 2, 210, 7, "#2fbf8f");
      if (rng() < 0.6) {
        p.rect(cx + 6, 196, 1, 12, "#1b8a6b");
        p.disc(cx + 6, 195, 3, rng() < 0.5 ? "#f472b6" : "#ffd166");
      }
    }
  } else if (theme === "caves") {
    for (let x = 0; x < p.w; x += 60) {
      const cx = x + rng() * 30;
      const h = 30 + rng() * 30;
      p.poly(
        [
          [cx - 8, 240],
          [cx, 240 - h],
          [cx + 8, 240],
        ] as Point[],
        "#3b2a7a",
      );
      p.line(cx, 240 - h, cx + 7, 239, "#7ee8f0");
      p.poly(
        [
          [cx + 20, 0],
          [cx + 26, 20 + rng() * 25],
          [cx + 32, 0],
        ] as Point[],
        "#33246b",
      );
    }
  } else {
    for (let i = 0; i < 4; i++) {
      const cx = i * 95 + rng() * 30;
      const cy = 40 + rng() * 90;
      for (let j = 0; j < 5; j++)
        p.disc(cx + j * 8, cy - ((j + 1) % 2) * 5, 9, "#ffeaf2");
      p.rect(cx - 6, cy + 3, 46, 5, "#f9c7d6");
    }
  }
  return p;
}

// ---------------------------------------------------------------- props

function moverArt(width: number, theme: Theme): Pixels {
  const pal = PALETTES[theme];
  const p = new Pixels(width, MOVER.thickness + 3);
  p.rect(0, 0, width, MOVER.thickness, INK);
  p.rect(1, 1, width - 2, MOVER.thickness - 3, "#e8ecff");
  p.rect(1, MOVER.thickness - 2, width - 2, 1, "#9aa6d8");
  for (let x = 6; x < width - 4; x += 12) {
    p.rect(x, MOVER.thickness, 3, 2, pal.bridge);
    p.px(x + 1, MOVER.thickness + 2, "#ffffff");
  }
  return p;
}

function flagArt(): Pixels {
  const p = new Pixels(16, 12);
  p.poly(
    [
      [16, 0],
      [1, 6],
      [16, 12],
    ] as Point[],
    "#ff7a45",
  );
  p.poly(STAR_POINTS(11, 6, 3, 1.3), "#ffffff");
  return p.outline(INK);
}

function beaconArt(lit: boolean): Pixels {
  const p = new Pixels(10, 26);
  p.rect(4, 8, 2, 17, "#9aa6d8").rect(2, 24, 6, 2, "#5a6290");
  p.disc(5, 5, 3.5, lit ? "#7ee86a" : "#5a6290");
  p.disc(4, 4, 1, lit ? "#e2fff4" : "#9aa6d8");
  if (lit) p.px(0, 5, "#c8ffb0").px(9, 5, "#c8ffb0").px(5, 0, "#c8ffb0");
  return p.outline(INK);
}

function rocketArt(): Pixels {
  const p = new Pixels(28, 48);
  // Fins and legs.
  p.poly(
    [
      [6, 30],
      [1, 44],
      [7, 42],
    ] as Point[],
    "#ff3b3b",
  );
  p.poly(
    [
      [22, 30],
      [27, 44],
      [21, 42],
    ] as Point[],
    "#b91c1c",
  );
  // Body and nose cone.
  p.ellipse(14, 26, 8, 18, "#c7d2fe");
  p.ellipse(13, 25, 7, 17, "#f4f6ff");
  p.clear(0, 43, 28, 5);
  p.rect(8, 42, 12, 2, "#9aa6d8");
  p.poly(
    [
      [6, 15],
      [14, 1],
      [22, 15],
    ] as Point[],
    "#ff7a45",
  );
  p.rect(7, 15, 14, 2, "#e8590c");
  // Window.
  p.disc(14, 24, 4, "#3a3fd1").disc(14, 24, 3, "#4cc9f0").px(13, 23, "#ffffff");
  p.rect(13, 32, 2, 8, "#ff7a45");
  return p.outline(INK);
}

function flameArt(frame: number): Pixels {
  const p = new Pixels(12, 16);
  const h = frame === 0 ? 14 : 11;
  p.poly(
    [
      [1, 0],
      [6, h],
      [11, 0],
    ] as Point[],
    "#ff7a45",
  );
  p.poly(
    [
      [3, 0],
      [6, h - 5],
      [9, 0],
    ] as Point[],
    "#fff27a",
  );
  return p;
}

function debrisArt(theme: Theme): Pixels {
  const pal = PALETTES[theme];
  const p = new Pixels(6, 6).rect(0, 0, 6, 6, pal.brick);
  p.rect(0, 4, 6, 1, pal.mortar).rect(3, 0, 1, 4, pal.mortar);
  return p.outline(INK);
}

function pointsArt(text: string): Pixels {
  const p = new Pixels(textWidth(text) + 2, 9);
  p.text(text, 1, 1, "#ffffff");
  return p.outline(INK);
}

export const POINT_VALUES = [
  100, 200, 400, 500, 800, 1000, 2000, 4000, 5000, 8000,
] as const;

// ---------------------------------------------------------------- texture setup

/** Textures that don't depend on the level. */
export function makeArt(scene: Phaser.Scene) {
  addSheet(scene, "ah-kit-small", kitSheet(false, KIT_PALETTE));
  addSheet(scene, "ah-kit-big", kitSheet(true, KIT_PALETTE));
  addSheet(scene, "ah-kit-fire", kitSheet(true, FIRE_PALETTE));
  addSheet(scene, "ah-grumble", [0, 1, 2].map(grumbleArt));
  addSheet(scene, "ah-shellbot", [0, 1, 2, 3, 4, 5].map(shellbotArt));
  addSheet(scene, "ah-boing", [0, 1, 2].map(boingArt));
  addSheet(scene, "ah-seed", [0, 1].map(seedArt));
  addSheet(scene, "ah-berry", [0, 1].map(berryArt));
  addTexture(scene, "ah-life", lifeArt());
  addSheet(scene, "ah-coin", [0, 1, 2, 1].map(coinArt));
  addSheet(scene, "ah-spark", [0, 1].map(sparkArt));
  addSheet(scene, "ah-star-block", [0, 1, 2, 3].map(starBlockArt));
  addTexture(scene, "ah-flag", flagArt());
  addSheet(scene, "ah-beacon", [beaconArt(false), beaconArt(true)]);
  addTexture(scene, "ah-rocket", rocketArt());
  addSheet(scene, "ah-flame", [0, 1].map(flameArt));
  addTexture(scene, "ah-px", new Pixels(1, 1).rect(0, 0, 1, 1, "#ffffff"));
  for (const value of POINT_VALUES) {
    addTexture(scene, `ah-pts-${value}`, pointsArt(String(value)));
  }
  addTexture(scene, "ah-pts-1UP", pointsArt("1UP"));
  addBanner(scene, "ah-b-clear", "LEVEL CLEAR!", BANNER.gold);
  addBanner(scene, "ah-b-hurry", "HURRY UP!", BANNER.pink);
  addBanner(scene, "ah-b-oops", "OOPS!", BANNER.violet);
  addBanner(scene, "ah-b-checkpoint", "CHECKPOINT!", {
    ...BANNER.mint,
    scale: 1,
  });
}

/** Textures for one level's theme, replaced when the theme changes. */
export function makeThemeArt(scene: Phaser.Scene, theme: Theme) {
  const pal = PALETTES[theme];
  addTexture(scene, "ah-brick", brickArt(pal));
  addTexture(scene, "ah-sky", skyArt(theme));
  addTexture(scene, "ah-far", farArt(theme));
  addTexture(scene, "ah-near", nearArt(theme));
  addTexture(scene, "ah-debris", debrisArt(theme));
  for (const w of [1, 2, 3, 4, 5]) {
    addTexture(scene, `ah-mover-${w}`, moverArt(w * TILE, theme));
  }
}

/** The intro card's title banners for a level. */
export function makeIntroArt(scene: Phaser.Scene, id: string, name: string) {
  addBanner(scene, "ah-b-world", `WORLD ${id}`, BANNER.gold);
  addBanner(scene, "ah-b-name", name, { ...BANNER.sky, scale: 1 });
}

export { KIT_PALETTE };

// ---------------------------------------------------------------- HUD

export type HudValues = {
  score: number;
  coins: number;
  world: string;
  time: number;
  lives: number;
};

/** The retro top bar: score, star coins, world, clock and lives. */
export function hudArt(v: HudValues): Pixels {
  const p = new Pixels(VIEW_W, 13);
  const text = (s: string, x: number, color = "#ffffff") =>
    p.text(s, x, 3, color);
  text(`SCORE ${String(v.score).padStart(6, "0")}`, 8);
  p.poly(STAR_POINTS(110, 6.5, 4.2, 1.9), "#ffd166");
  text(`X${String(v.coins).padStart(2, "0")}`, 117);
  text(`WORLD ${v.world}`, 160);
  text(
    `TIME ${String(Math.max(0, v.time)).padStart(3, "0")}`,
    236,
    v.time <= 100 ? "#ffd166" : "#ffffff",
  );
  // Kit's face for lives.
  p.disc(306, 7, 3, KIT_PALETTE.fur);
  p.poly(
    [
      [303, 6],
      [303.5, 2],
      [305.5, 4.5],
    ] as Point[],
    KIT_PALETTE.fur,
  );
  p.poly(
    [
      [306.5, 4.5],
      [308.5, 2],
      [309, 6],
    ] as Point[],
    KIT_PALETTE.fur,
  );
  p.rect(305, 8, 3, 1, WHITE);
  text(`X${v.lives}`, 313);
  return p.outline(INK);
}
