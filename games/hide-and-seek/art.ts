/**
 * Every texture of Hide & Seek: Mazes, drawn in code as top-down pixel art:
 * the Moonbase House (floors, walls, star windows, furniture), the hiding
 * spots (closed, opened, with you peeking out), the kid astronaut, Peeka the
 * robot, and the little icons and HUD pieces.
 */

import Phaser from "phaser";
import { TILE, VIEW_W } from "@/lib/games/hide-and-seek/config";
import {
  COLS,
  FURNITURE,
  MAP,
  ROOMS,
  ROWS,
  roomAt,
  type FurnitureKind,
} from "@/lib/games/hide-and-seek/house";
import type { Grid } from "@/lib/games/hide-and-seek/nav";
import { textWidth } from "@/lib/pixelFont";
import {
  addSheet,
  addTexture,
  Pixels,
  seeded,
  starField,
} from "../shared/pixel";

export const INK = "#140c2c";
const WHITE = "#ffffff";

const WALL = {
  top: "#262b55",
  topLight: "#363d78",
  face: "#4c5396",
  faceDark: "#3a4079",
  trim: "#8c95e0",
};

const WOOD = ["#c48a52", "#a86f3c", "#8a5a2f"];
const METAL = ["#c9d1e8", "#9aa4c4", "#6f7899"];

// ------------------------------------------------------------------ house

function floorTile(p: Pixels, x: number, y: number, c: number, r: number) {
  const room = roomAt(c, r);
  const [light, dark] = room.colors;
  switch (room.floor) {
    case "carpet":
      p.rect(x, y, TILE, TILE, light);
      p.dither(x, y, TILE, TILE, null, dark, 0.25);
      break;
    case "tile":
      p.rect(x, y, TILE, TILE, light);
      p.rect(x, y, 8, 8, dark).rect(x + 8, y + 8, 8, 8, dark);
      break;
    case "wood":
      p.rect(x, y, TILE, TILE, light);
      for (let k = 0; k < 4; k++) p.rect(x, y + k * 4 + 3, TILE, 1, dark);
      p.rect(x + ((c * 7 + r * 3) % 12) + 2, y + (r % 4) * 4, 1, 3, dark);
      break;
    case "metal":
      p.rect(x, y, TILE, TILE, light);
      p.rect(x, y + 15, TILE, 1, dark).rect(x + 15, y, 1, TILE, dark);
      p.px(x + 2, y + 2, dark).px(x + 13, y + 13, dark);
      break;
  }
}

function wallTile(
  p: Pixels,
  x: number,
  y: number,
  c: number,
  r: number,
  window: boolean,
) {
  const solidBelow = r + 1 < ROWS && "#O".includes(MAP[r + 1][c]);
  p.rect(x, y, TILE, TILE, WALL.top);
  p.dither(x, y, TILE, TILE, null, WALL.topLight, 0.2);
  if (!solidBelow) {
    // The wall's front face, seen from slightly above.
    p.rect(x, y + 9, TILE, 7, WALL.face);
    p.rect(x, y + 9, TILE, 1, WALL.trim);
    p.rect(x, y + 15, TILE, 1, WALL.faceDark);
  }
  if (window) {
    const rng = seeded(c * 31 + r * 7);
    const glass = new Pixels(12, 12);
    glass.disc(5.5, 5.5, 5.5, "#0b1026");
    starField(glass, 6, 12, rng);
    glass.ctx.globalCompositeOperation = "destination-in";
    glass.disc(5.5, 5.5, 5, "#000");
    p.disc(x + 7.5, y + 7.5, 7, WALL.trim);
    p.disc(x + 7.5, y + 7.5, 6, "#0b1026");
    p.stamp(glass, x + 2, y + 2);
    p.px(x + 4, y + 4, "#c8f4ff");
  }
}

/** One piece of furniture drawn into its own box (w×h tiles), outlined. */
export function furnitureArt(
  kind: FurnitureKind,
  w: number,
  h: number,
  frame: 0 | 1 | 2 = 0,
): Pixels {
  const W = w * TILE;
  const H = h * TILE;
  const p = new Pixels(W, H);
  const open = frame === 1;
  const peek = frame === 2;
  const eyes = (x: number, y: number) => {
    p.rect(x, y, 2, 2, WHITE).rect(x + 4, y, 2, 2, WHITE);
    p.px(x + 1, y + 1, INK).px(x + 5, y + 1, INK);
  };
  switch (kind) {
    case "bed": {
      p.rect(1, 1, W - 2, H - 2, WOOD[1]);
      p.rect(2, 2, W - 4, H - 4, "#e8ecff");
      p.rect(3, 4, W - 6, 8, WHITE);
      p.rect(2, 14, W - 4, H - 16, open ? "#5b7bd6" : "#4c6ee0");
      for (let y = 18; y < H - 4; y += 6) p.rect(4, y, W - 8, 1, "#8fa8ff");
      p.disc(W / 2, 26, 3, "#ffd166");
      if (open) p.rect(2, H - 6, W - 4, 4, "#0b1026");
      if (peek) {
        p.rect(4, H - 7, W - 8, 5, "#0b1026");
        eyes(W / 2 - 4, H - 6);
      }
      break;
    }
    case "nightstand":
      p.rect(2, 3, W - 4, H - 5, WOOD[1]).rect(3, 4, W - 6, 3, WOOD[0]);
      p.disc(8, 9, 3, "#ffe08a");
      break;
    case "wardrobe":
    case "closet":
    case "cupboard":
    case "pantry": {
      const body =
        kind === "closet"
          ? ["#9c7be0", "#7c5cc4"]
          : kind === "pantry"
            ? ["#e8e2d0", "#c9c0a8"]
            : WOOD;
      p.rect(1, 1, W - 2, H - 2, body[1]);
      p.rect(2, 2, W - 4, H - 5, body[0]);
      p.rect(2, H - 4, W - 4, 2, body[1]);
      if (open) {
        p.rect(3, 3, W - 6, H - 7, "#0b1026");
        p.rect(4, 4, 3, H - 9, "#3a2a5a");
      } else {
        if (W >= H) p.rect(W / 2, 2, 1, H - 5, INK);
        else p.rect(2, H / 2, W - 4, 1, INK);
        p.px(W / 2 - 2, H / 2 - 1, "#ffd166").px(
          W / 2 + 2,
          H / 2 - 1,
          "#ffd166",
        );
      }
      if (peek) {
        p.rect(W / 2 - 1, 3, 2, H - 7, "#0b1026");
        p.px(W / 2 - 1, 5, WHITE).px(W / 2, 5, WHITE);
      }
      break;
    }
    case "toychest":
      p.rect(1, 3, W - 2, H - 5, "#e2504c").rect(1, 3, W - 2, 3, "#ff7a6b");
      p.px(W / 2, 9, "#ffd166")
        .px(W / 2 - 1, 9, "#ffd166")
        .px(W / 2 + 1, 9, "#ffd166");
      break;
    case "plant":
    case "pots": {
      p.disc(W / 2, H / 2 + 2, 5, "#b0603a");
      p.disc(W / 2, H / 2 + 2, 4, "#d07a4c");
      p.disc(W / 2 - 3, H / 2 - 2, 4, "#2fbf6f");
      p.disc(W / 2 + 3, H / 2 - 1, 4, "#26a85f");
      p.disc(W / 2, H / 2 - 4, 4, "#45d983");
      if (kind === "pots") {
        p.disc(3, H - 4, 3, "#d07a4c").disc(W - 3, H - 4, 3, "#b0603a");
        if (open) p.rect(5, 6, 6, 5, "#0b1026");
        if (peek) eyes(5, 7);
      }
      break;
    }
    case "sink":
      p.rect(1, 2, W - 2, H - 4, "#e8f4ff").rect(1, 2, W - 2, 1, WHITE);
      p.ellipse(W / 2, H / 2 + 1, 6, 3, "#9fc6e8");
      p.rect(W / 2, 3, 1, 3, METAL[1]);
      break;
    case "shower": {
      p.rect(1, 1, W - 2, H - 2, "#bfeef2");
      for (let y = 1; y < H; y += 6) p.rect(1, y, W - 2, 1, "#8fd0d8");
      p.disc(W / 2, 8, 3, METAL[1]);
      const curtain = (x0: number, x1: number) => {
        for (let x = x0; x < x1; x++)
          p.rect(x, H - 9, 1, 7, x % 4 < 2 ? "#f472b6" : "#ffd0e8");
        p.rect(x0, H - 10, x1 - x0, 1, METAL[0]);
      };
      if (open) curtain(1, 8);
      else curtain(1, W - 1);
      if (peek) eyes(W / 2 - 3, H - 11);
      break;
    }
    case "towels":
      p.rect(2, 3, W - 4, 2, METAL[1]);
      p.rect(3, 5, 4, 8, "#7ee8c9").rect(9, 5, 4, 7, "#ffd166");
      break;
    case "basket": {
      p.disc(W / 2, H / 2, 7, "#c9944f");
      for (let y = 2; y < H; y += 3) p.rect(2, y, W - 4, 1, "#a8763a");
      p.disc(W / 2, H / 2, 5, open ? "#0b1026" : "#f472b6");
      if (!open) p.disc(W / 2 + 2, H / 2 + 1, 2, "#7ee8c9");
      if (peek) {
        p.disc(W / 2, H / 2, 4, "#0b1026");
        eyes(W / 2 - 3, H / 2 - 1);
      }
      break;
    }
    case "bookshelf":
    case "shelf": {
      const frameC = kind === "shelf" ? METAL : WOOD;
      p.rect(1, 1, W - 2, H - 2, frameC[2]);
      const colors =
        kind === "shelf"
          ? ["#c9944f", "#e8c27a", "#9aa4c4"]
          : ["#e2504c", "#4cc9f0", "#ffd166", "#7ee8c9", "#c4b5fd"];
      for (let y = 2; y < H - 2; y += 4) {
        for (let x = 2; x < W - 2; x += 3)
          p.rect(x, y, 2, 3, colors[(x * 3 + y) % colors.length]);
      }
      break;
    }
    case "desk": {
      p.rect(1, 2, W - 2, H - 4, WOOD[0]).rect(1, H - 4, W - 2, 2, WOOD[2]);
      p.rect(W / 2 - 6, 3, 12, 6, "#26304f").rect(
        W / 2 - 5,
        4,
        10,
        4,
        "#4cc9f0",
      );
      p.rect(4, 5, 6, 4, WHITE).rect(W - 10, 5, 5, 5, "#ffd166");
      if (open) p.rect(W / 2 - 6, H - 5, 12, 3, "#0b1026");
      if (peek) {
        p.rect(W / 2 - 6, H - 6, 12, 4, "#0b1026");
        eyes(W / 2 - 3, H - 5);
      }
      break;
    }
    case "telescope":
      p.line(4, 13, 8, 8, METAL[2]).line(12, 13, 8, 8, METAL[2]);
      p.rect(5, 3, 9, 4, "#f5f5ff").rect(12, 2, 3, 6, "#4cc9f0");
      break;
    case "globe":
      p.disc(8, 8, 6, "#3a86ff");
      p.disc(6, 6, 2, "#45d983").disc(10, 10, 2, "#45d983");
      break;
    case "armchair":
      p.rect(1, 2, W - 2, H - 3, "#2a9d8f").rect(3, 5, W - 6, H - 7, "#3cc6b5");
      break;
    case "shoerack":
      p.rect(1, 4, W - 2, H - 6, WOOD[2]);
      p.rect(3, 5, 4, 3, "#e2504c").rect(9, 5, 4, 3, "#4cc9f0");
      break;
    case "sofa": {
      p.rect(1, 1, W - 2, H - 2, "#e8743b");
      p.rect(1, 1, W - 2, 4, "#c95a26");
      for (let x = 4; x < W - 4; x += 18) p.rect(x, 6, 16, 7, "#ff9a5c");
      if (open) p.rect(W / 2 - 8, 1, 16, 4, "#0b1026");
      if (peek) {
        p.rect(W / 2 - 6, 0, 12, 4, "#0b1026");
        eyes(W / 2 - 3, 1);
      }
      break;
    }
    case "table":
      p.rect(1, 3, W - 2, H - 6, WOOD[1]).rect(2, 4, W - 4, 2, WOOD[0]);
      p.disc(10, 8, 2, "#7ee8c9");
      break;
    case "screen":
      p.rect(2, 5, W - 4, 6, "#1b2140").rect(4, 6, W - 8, 3, "#4cc9f0");
      p.rect(8, 7, 6, 1, WHITE);
      break;
    case "crate":
      p.rect(1, 1, W - 2, H - 2, METAL[1]).rect(2, 2, W - 4, H - 4, METAL[0]);
      p.line(2, 2, W - 3, H - 3, METAL[2]).line(W - 3, 2, 2, H - 3, METAL[2]);
      break;
    case "bigbox": {
      p.rect(1, 1, W - 2, H - 2, "#d7a35e").rect(2, 2, W - 4, H - 4, "#e8bd7a");
      p.rect(W / 2 - 1, 1, 2, H - 2, "#c9944f");
      if (open) p.rect(4, 3, W - 8, H - 6, "#0b1026");
      if (peek) {
        p.rect(W / 2 - 4, 4, 8, 5, "#0b1026");
        eyes(W / 2 - 3, 5);
      }
      break;
    }
    case "counter":
      p.rect(0, 1, W, H - 2, "#f2f2f8").rect(0, H - 4, W, 2, METAL[1]);
      p.ring(14, 7, 3, 3, INK).ring(24, 7, 3, 3, INK);
      p.rect(W - 18, 4, 10, 6, "#9fc6e8");
      break;
    case "fridge":
      p.rect(1, 1, W - 2, H - 2, "#f2f2f8").rect(2, H / 2, W - 4, 1, METAL[1]);
      p.rect(W - 4, 6, 1, 6, METAL[2]).rect(W - 4, H / 2 + 4, 1, 6, METAL[2]);
      p.rect(4, 4, 3, 3, "#f472b6");
      break;
    case "dining": {
      p.rect(1, 1, W - 2, H - 2, WOOD[1]).rect(2, 2, W - 4, H - 5, WOOD[0]);
      for (let x = 8; x < W - 4; x += 16) p.disc(x, H / 2, 3, WHITE);
      p.disc(W / 2, H / 2, 2, "#e2504c");
      break;
    }
    case "chair":
      p.rect(3, 3, W - 6, H - 6, WOOD[1]).rect(3, 3, W - 6, 2, WOOD[2]);
      break;
    case "rug": {
      p.rect(0, 0, W, H, "#ff9f1c");
      p.rect(2, 2, W - 4, H - 4, "#5b3fa8");
      for (let x = 8; x < W - 4; x += 12)
        for (let y = 8; y < H - 4; y += 12) {
          p.px(x, y, "#ffd166")
            .px(x - 1, y, "#ffd166")
            .px(x + 1, y, "#ffd166");
          p.px(x, y - 1, "#ffd166").px(x, y + 1, "#ffd166");
        }
      return p;
    }
  }
  return p.outline(INK);
}

/** The whole house: floors, walls, windows and the furniture that isn't a hiding spot. */
export function houseArt(): Pixels {
  const p = new Pixels(COLS * TILE, ROWS * TILE);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const ch = MAP[r][c];
      const x = c * TILE;
      const y = r * TILE;
      if (ch === "#" || ch === "O") wallTile(p, x, y, c, r, ch === "O");
      else if (ch === "d") {
        p.rect(x, y, TILE, TILE, METAL[1]);
        p.rect(x, y, TILE, TILE, METAL[1]).dither(
          x,
          y,
          TILE,
          TILE,
          null,
          METAL[0],
          0.3,
        );
        p.rect(x + 1, y + 7, TILE - 2, 2, "#ff9f1c");
      } else floorTile(p, x, y, c, r);
    }
  }
  for (const f of FURNITURE) {
    if (f.spot) continue;
    p.stamp(furnitureArt(f.kind, f.w, f.h), f.col * TILE, f.row * TILE);
  }
  return p;
}

// ------------------------------------------------------------------ characters

const SUIT = {
  helmet: "#f5f7ff",
  shade: "#c5cbe8",
  visor: "#4cc9f0",
  glint: "#c8f4ff",
  suit: "#ff7a2f",
  suitDark: "#d95a12",
  pack: "#9aa4c4",
};

/** The kid astronaut: frames 0-1 down, 2-3 up, 4-5 side (facing right). */
export function astronautFrames(): Pixels[] {
  const frames: Pixels[] = [];
  for (const dir of ["down", "up", "side"] as const) {
    for (const step of [0, 1]) {
      const p = new Pixels(16, 16);
      // Feet
      const fy = 13;
      if (dir === "side") {
        p.rect(5 + step * 2, fy, 3, 2, SUIT.suitDark).rect(
          9 - step * 2,
          fy,
          3,
          2,
          SUIT.suitDark,
        );
      } else {
        p.rect(4, fy - step, 3, 2, SUIT.suitDark).rect(
          9,
          fy - (1 - step),
          3,
          2,
          SUIT.suitDark,
        );
      }
      // Body
      p.ellipse(8, 10.5, 4.5, 3.5, SUIT.suit);
      if (dir === "up") p.rect(5, 7, 6, 5, SUIT.pack);
      if (dir === "side") p.rect(3, 8, 3, 5, SUIT.pack);
      // Helmet
      p.disc(8, 6, 5, SUIT.helmet);
      p.rect(4, 8, 8, 1, SUIT.shade);
      if (dir === "down") {
        p.ellipse(8, 6.5, 3.5, 2.5, SUIT.visor);
        p.px(6, 5, SUIT.glint).px(7, 5, SUIT.glint);
      } else if (dir === "side") {
        p.ellipse(10.5, 6, 2.5, 2.5, SUIT.visor);
        p.px(10, 5, SUIT.glint);
      } else {
        p.rect(7, 2, 2, 1, SUIT.shade);
      }
      p.px(8, 0, "#ffd166"); // antenna light
      p.outline(INK);
      frames.push(p);
    }
  }
  return frames;
}

export const ASTRO_FRAME = { down: 0, up: 2, side: 4 } as const;

const BOT = {
  body: "#8b5cf6",
  light: "#b79cff",
  dark: "#5b3fa8",
  eye: "#7ee8c9",
  eyeLit: "#e2fff4",
  cheek: "#f472b6",
};

/**
 * Peeka the robot: 0-1 down, 2-3 up, 4-5 side (facing right), 6 counting
 * (hands over its eye), 7 happy ("Found you!").
 */
export function peekaFrames(): Pixels[] {
  const frames: Pixels[] = [];
  const base = (bob: number) => {
    const p = new Pixels(18, 18);
    p.ellipse(9, 16, 6, 1.5, "rgba(0,0,0,0.35)");
    p.disc(9, 9 - bob, 7, BOT.body);
    p.disc(8, 7 - bob, 5, BOT.light);
    p.disc(9, 9 - bob, 7, BOT.body).dither(
      2,
      2 - bob,
      14,
      7,
      null,
      BOT.light,
      0.5,
    );
    p.rect(8, 0 - bob, 2, 2, "#ffd166");
    p.rect(8.5, 2 - bob, 1, 1, BOT.dark);
    return p;
  };
  for (const dir of ["down", "up", "side"] as const) {
    for (const bob of [0, 1]) {
      const p = base(bob);
      if (dir === "down") {
        p.ellipse(9, 10 - bob, 4.5, 2.5, INK);
        p.ellipse(9, 10 - bob, 3.5, 1.5, BOT.eye);
        p.px(8, 10 - bob, BOT.eyeLit).px(9, 10 - bob, BOT.eyeLit);
        p.px(3, 12 - bob, BOT.cheek).px(14, 12 - bob, BOT.cheek);
      } else if (dir === "side") {
        p.ellipse(13, 9 - bob, 2.5, 2.5, INK);
        p.ellipse(13, 9 - bob, 1.5, 1.5, BOT.eye);
        p.px(13, 9 - bob, BOT.eyeLit);
      } else {
        p.rect(6, 10 - bob, 6, 2, BOT.dark);
      }
      // Little arms
      p.rect(1, 10 - bob, 2, 3, BOT.dark).rect(15, 10 - bob, 2, 3, BOT.dark);
      p.outline(INK);
      frames.push(p);
    }
  }
  // Counting: hands over the eye.
  const count = base(0);
  count.ellipse(9, 10, 4.5, 2.5, INK);
  count.rect(4, 8, 4, 4, BOT.dark).rect(10, 8, 4, 4, BOT.dark);
  frames.push(count.outline(INK));
  // Happy: big smiling eye.
  const happy = base(1);
  happy.ellipse(9, 9, 4.5, 2.5, INK);
  happy.rect(6, 8, 6, 1, BOT.eye).px(5, 9, BOT.eye).px(12, 9, BOT.eye);
  happy.px(3, 11, BOT.cheek).px(14, 11, BOT.cheek);
  happy.rect(0, 5, 2, 3, BOT.dark).rect(16, 5, 2, 3, BOT.dark);
  frames.push(happy.outline(INK));
  return frames;
}

export const PEEKA_FRAME = {
  down: 0,
  up: 2,
  side: 4,
  count: 6,
  happy: 7,
} as const;

// ------------------------------------------------------------------ icons and HUD

/** Speech bubble with one glyph: "?" (suspicious) or "!" (spotted). */
export function bubbleArt(glyph: string, color: string): Pixels {
  const p = new Pixels(11, 13);
  p.rect(1, 1, 9, 9, WHITE);
  p.poly(
    [
      [4, 9],
      [7, 9],
      [5, 12],
    ],
    WHITE,
  );
  p.text(glyph, 3, 2, color);
  return p.outline(INK);
}

/** Small green tick: Peeka checked this spot recently. */
export function checkArt(): Pixels {
  const p = new Pixels(9, 8);
  p.line(1, 4, 3, 6, "#2fbf8f").line(3, 6, 7, 1, "#2fbf8f");
  p.line(1, 3, 3, 5, "#7ee8c9").line(3, 5, 7, 0, "#7ee8c9");
  return p.outline(INK);
}

/** A rounded label with pixel text, e.g. "E  HIDE". */
export function labelArt(text: string, fill: string, color = WHITE): Pixels {
  const w = textWidth(text) + 8;
  const p = new Pixels(w, 13);
  p.rect(1, 0, w - 2, 13, fill).rect(0, 1, w, 11, fill);
  p.rect(1, 1, w - 2, 1, "rgba(255,255,255,0.35)");
  p.text(text, 4, 3, color);
  return p.outline(INK);
}

/** The minimap background: rooms and walls, 2 px per tile. */
export function minimapArt(grid: Grid): Pixels {
  const p = new Pixels(COLS * 2 + 2, ROWS * 2 + 2);
  p.rect(0, 0, p.w, p.h, "rgba(11,16,38,0.85)");
  for (const room of ROOMS) {
    p.rect(
      1 + room.col * 2,
      1 + room.row * 2,
      room.w * 2,
      room.h * 2,
      room.colors[1],
    );
  }
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (MAP[r][c] === "d") p.rect(1 + c * 2, 1 + r * 2, 2, 2, "#8590b3");
      else if (grid.furniture[r * COLS + c] >= 0)
        p.rect(1 + c * 2, 1 + r * 2, 2, 2, "rgba(20,12,44,0.45)");
    }
  }
  return p;
}

export type HudValues = {
  round: number;
  time: string;
  score: number;
  urgent: boolean;
  label: string;
};

/** Top bar: round, timer, score. */
export function hudArt(v: HudValues): Pixels {
  const p = new Pixels(VIEW_W, 15);
  p.rect(0, 0, VIEW_W, 14, "rgba(11,16,38,0.78)");
  p.rect(0, 14, VIEW_W, 1, "rgba(140,149,224,0.5)");
  p.text(`ROUND ${v.round}`, 8, 4, "#c4b5fd");
  const timeW = textWidth(v.time) * 2;
  p.text(
    v.time,
    Math.round(VIEW_W / 2 - timeW / 2),
    0,
    v.urgent ? "#ffd166" : WHITE,
    2,
  );
  if (v.label)
    p.text(v.label, Math.round(VIEW_W / 2 + timeW / 2 + 6), 4, "#9aa4c4");
  const score = `SCORE ${String(v.score).padStart(5, "0")}`;
  p.text(score, VIEW_W - 8 - textWidth(score), 4, WHITE);
  return p;
}

/** Bottom strip: the status message. */
export function statusArt(text: string, color: string): Pixels {
  const p = new Pixels(VIEW_W, 13);
  const w = Math.min(VIEW_W - 4, textWidth(text) + 12);
  const x = Math.round((VIEW_W - w) / 2);
  p.rect(x, 1, w, 11, "rgba(11,16,38,0.8)");
  p.rect(x, 1, w, 1, color);
  p.text(text, Math.round(VIEW_W / 2 - textWidth(text) / 2), 3, color);
  return p;
}

/** Every static texture of the game. */
export function makeArt(scene: Phaser.Scene, grid: Grid) {
  addTexture(scene, "hs-house", houseArt());
  addSheet(scene, "hs-astro", astronautFrames());
  addSheet(scene, "hs-peeka", peekaFrames());
  for (const spot of grid.spots) {
    const f = spot.furniture;
    addSheet(scene, `hs-spot-${spot.id}`, [
      furnitureArt(f.kind, f.w, f.h, 0),
      furnitureArt(f.kind, f.w, f.h, 1),
      furnitureArt(f.kind, f.w, f.h, 2),
    ]);
  }
  addTexture(scene, "hs-q", bubbleArt("?", "#7c5cc4"));
  addTexture(scene, "hs-bang", bubbleArt("!", "#e2504c"));
  addTexture(scene, "hs-check", checkArt());
  addTexture(scene, "hs-minimap", minimapArt(grid));
  const dot = new Pixels(6, 6).rect(1, 1, 4, 4, "#ff7a2f").outline(WHITE);
  addTexture(scene, "hs-dot", dot);
  const ping = new Pixels(6, 6).ring(2.5, 2.5, 2.5, 2.5, "#c4b5fd");
  addTexture(scene, "hs-ping", ping);
}
