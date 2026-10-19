import type Phaser from "phaser";
import {
  addBanner,
  addPixelParticle,
  addSheet,
  addTexture,
  BANNER,
  burstArt,
  cometArt,
  crowdRow,
  Pixels,
  seeded,
  starField,
  twinkleArt,
} from "../shared/pixel";
import { textWidth } from "@/lib/pixelFont";

/**
 * Nova Shootout's pixel art, all drawn in code: Crater Field stadium, Bolt the
 * robot goalie, the striker, the comet ball, meters and banners. Art pixels
 * are 3 world units (see games/shared/pixel.ts), so the 720×480 world is
 * 240×160 art pixels.
 */

const INK = "#140c2c";
const WHITE = "#e8ecff";

export const BOLT_FRAME = {
  idle: 0,
  bob: 1,
  ready: 2,
  dive: 3,
  cheer: 4,
  sad: 5,
} as const;
export type BoltPose = keyof typeof BOLT_FRAME;

export const STRIKER_FRAME = {
  stand: 0,
  runA: 1,
  runB: 2,
  kick: 3,
  cheer: 4,
} as const;

export const LAMP = { off: 0, goal: 1, miss: 2, next: 3 } as const;

/** Crowd frames: two calm ones to flicker between, then cheering. */
export const CROWD = { calmA: 0, calmB: 1, cheerA: 2, cheerB: 3 } as const;

/** Where crowd rows sit (art px from the top) and how they're staggered. */
export const CROWD_ROWS = [
  { y: 20, offset: 3 },
  { y: 27, offset: 0 },
  { y: 34, offset: 4 },
];

/** Jumbotron, top centre, in art px: a text line, then a lamp per kick. */
export const JUMBO = {
  x: 69,
  y: 1,
  w: 102,
  h: 22,
  textY: 3,
  lampX: 29,
  lampY: 12,
  lampGap: 9,
};

/** Lines the jumbotron can show, by key. */
export const SCREEN = {
  title: "NOVA SHOOTOUT",
  aim: "TAP THE GOAL",
  shoot: "TAP TO SHOOT!",
  goal: "GOAL! GOAL!",
  miss: "SO CLOSE!",
} as const;

/** Power meter frame: inner bar in art px, relative to the texture. */
export const METER = {
  w: 13,
  h: 88,
  innerX: 2,
  innerY: 2,
  innerW: 9,
  innerH: 84,
};

export const BANNERS = {
  goal: "GOAL!",
  saved: "SAVED!",
  post: "POST!",
  over: "OVER!",
  wide: "WIDE!",
  close: "SO CLOSE!",
  last: "LAST KICK!",
  fullTime: "FULL TIME!",
} as const;

export function makeArt(scene: Phaser.Scene) {
  addTexture(scene, "nova-sky", sky());
  CROWD_ROWS.forEach((row, i) => {
    const frames = [0, 1, 2, 3].map((frame) =>
      crowdRow(240, row.offset, seeded(40 + i), (n) => {
        if (frame === CROWD.cheerA) return true;
        if (frame === CROWD.cheerB) return n % 2 === 0;
        // Calm: a few fans waving, different ones in each frame.
        return (n * 7 + i * 3 + frame * 5) % 11 === 0;
      }),
    );
    addSheet(scene, `nova-crowd-${i}`, frames);
  });
  addTexture(scene, "nova-pitch", pitch());
  addTexture(scene, "nova-jumbo", jumbotron());
  for (const [key, text] of Object.entries(SCREEN)) {
    addTexture(scene, `nova-screen-${key}`, screenText(text));
  }
  addSheet(scene, "nova-lamp", [
    lamp("#3a3f6b", "#565c94"),
    lamp("#34d399", "#b6ffe4"),
    lamp("#ef4444", "#ffb4b4"),
    lamp("#ffd166", "#fff6c8"),
  ]);
  addSheet(scene, "nova-net", [net(false), net(true)]);
  addTexture(scene, "nova-posts", posts());
  addSheet(
    scene,
    "nova-bolt",
    (Object.keys(BOLT_FRAME) as BoltPose[]).map((pose) => bolt(pose)),
  );
  addSheet(
    scene,
    "nova-striker",
    (["stand", "runA", "runB", "kick", "cheer"] as const).map(striker),
  );
  addSheet(scene, "nova-ball", [0, 1, 2, 3].map(ball));
  addSheet(scene, "nova-reticle", [reticle(6), reticle(5)]);
  addSheet(scene, "nova-meter", [meter(false), meter(true)]);
  addTexture(scene, "nova-pointer", pointer());
  addSheet(scene, "nova-burst", [0, 1, 2, 3].map(burstArt));
  addTexture(scene, "nova-twinkle", twinkleArt());
  addTexture(scene, "nova-comet", cometArt());
  addPixelParticle(scene, "nova-px");
  addPixelParticle(scene, "nova-confetti", 2, 1);

  addBanner(scene, "nova-b-goal", BANNERS.goal, { ...BANNER.gold, scale: 3 });
  addBanner(scene, "nova-b-saved", BANNERS.saved, { ...BANNER.sky, scale: 3 });
  addBanner(scene, "nova-b-post", BANNERS.post, { ...BANNER.pink, scale: 3 });
  addBanner(scene, "nova-b-over", BANNERS.over, { ...BANNER.violet, scale: 3 });
  addBanner(scene, "nova-b-wide", BANNERS.wide, { ...BANNER.violet, scale: 3 });
  addBanner(scene, "nova-b-close", BANNERS.close, { ...BANNER.mint, scale: 1 });
  addBanner(scene, "nova-b-last", BANNERS.last, { ...BANNER.gold, scale: 2 });
  addBanner(scene, "nova-b-full", BANNERS.fullTime, {
    ...BANNER.gold,
    scale: 2,
  });
  for (let kick = 1; kick <= 5; kick++) {
    addBanner(scene, `nova-b-kick-${kick}`, `KICK ${kick}`, {
      ...BANNER.sky,
      scale: 2,
    });
  }
}

/** Night sky, ringed planet, moon, floodlights and the upper stands. */
function sky(): Pixels {
  const rng = seeded(7);
  const p = new Pixels(240, 46);
  p.gradient(0, 0, 240, 46, [
    "#070a1f",
    "#0b1026",
    "#1a1f4d",
    "#2b3668",
    "#3d3a7a",
  ]);
  starField(p, 70, 22, rng);
  ringedPlanet(p, 24, 12);
  // Moon with craters.
  p.disc(218, 9, 6, "#c7d2fe").disc(217, 8, 5.5, WHITE);
  p.disc(215, 7, 1.5, "#c7d2fe")
    .disc(220, 11, 1, "#c7d2fe")
    .px(219, 6, "#c7d2fe");

  // Stands: dark tiers with a roof edge.
  p.poly(
    [
      [0, 19],
      [240, 19],
      [240, 46],
      [0, 46],
    ],
    "#141b42",
  );
  p.rect(0, 18, 240, 1, "#3a3f6b").rect(0, 19, 240, 1, "#1d2650");
  for (const y of [27, 34, 41]) p.rect(0, y, 240, 1, "#1d2650");

  // Jumbotron supports.
  p.rect(92, 18, 2, 10, "#3a3f6b").rect(146, 18, 2, 10, "#3a3f6b");

  // Floodlight towers with soft dithered light cones.
  for (const x of [10, 229]) {
    const toward = x < 120 ? 1 : -1;
    p.poly(
      [
        [x - 4, 7],
        [x + 4, 7],
        [x + toward * 60, 46],
        [x + toward * 20, 46],
      ],
      "rgba(255, 243, 176, 0.07)",
    );
    p.rect(x - 1, 6, 2, 40, "#3a3f6b").rect(x, 6, 1, 40, "#565c94");
    p.rect(x - 6, 1, 12, 6, "#6d7bb8").rect(x - 6, 1, 12, 1, "#9aa6d8");
    for (let i = 0; i < 4; i++) {
      p.rect(x - 5 + i * 3, 2, 2, 2, "#fff3b0").rect(
        x - 5 + i * 3,
        4,
        2,
        2,
        "#ffe08a",
      );
    }
  }
  return p;
}

function ringedPlanet(p: Pixels, cx: number, cy: number) {
  const ring = (front: boolean) => {
    for (let x = -16; x <= 16; x++) {
      const dy = 4 * Math.sqrt(Math.max(0, 1 - (x * x) / 256));
      for (const sign of [-1, 1]) {
        const y = Math.round(cy + sign * dy * 0.9 - x * 0.12);
        if (front === y >= cy)
          p.px(cx + x, y, sign > 0 ? "#ffd166" : "#e09f1f");
      }
    }
  };
  ring(false);
  p.disc(cx, cy, 8, "#6d28d9").disc(cx - 1, cy - 1, 7, "#a78bfa");
  p.rect(cx - 6, cy - 2, 12, 1, "#8b6ff0").rect(
    cx - 5,
    cy + 2,
    10,
    1,
    "#8b6ff0",
  );
  p.disc(cx - 3, cy - 4, 1.5, "#c4b5fd");
  ring(true);
}

/** The pitch: wall with ad boards, striped moon turf, craters and lines. */
function pitch(): Pixels {
  const rng = seeded(11);
  const p = new Pixels(240, 160);

  // Wall under the stands.
  p.rect(0, 42, 240, 8, "#1d2650").rect(0, 42, 240, 1, "#ff7a45");
  const boards = [
    "NOVA",
    "star",
    "GO!",
    "planet",
    "NOVA",
    "star",
    "GO!",
    "planet",
  ];
  boards.forEach((board, i) => {
    const x = i * 30 + 1;
    p.rect(x, 44, 28, 5, i % 2 ? "#3a3fd1" : "#2b3668");
    p.rect(x, 44, 28, 1, i % 2 ? "#5a60f0" : "#3d4a8a");
    if (board === "star") {
      p.px(x + 14, 45, "#ffd166")
        .rect(x + 13, 46, 3, 1, "#ffd166")
        .px(x + 14, 47, "#ffd166");
    } else if (board === "planet") {
      p.rect(x + 12, 45, 3, 3, "#7ee8c9").rect(x + 10, 46, 7, 1, "#ffd166");
    } else {
      // Tiny 3-row lettering: just bright dashes, readable as "a sign".
      p.rect(x + 6, 46, 16, 1, "#ffd166").rect(x + 8, 45, 12, 1, "#fff3b0");
    }
  });

  // Turf bands, closer bands taller (perspective), dithered seams.
  const edges = [50, 57, 65, 74, 85, 98, 113, 130, 160];
  for (let i = 0; i < edges.length - 1; i++) {
    const color = i % 2 === 0 ? "#2f9e6e" : "#38b07c";
    const other = i % 2 === 0 ? "#38b07c" : "#2f9e6e";
    p.rect(0, edges[i], 240, edges[i + 1] - edges[i], color);
    if (i > 0) p.dither(0, edges[i], 240, 1, null, other, 0.5);
  }
  for (let i = 0; i < 520; i++) {
    const y = 50 + Math.floor(rng() * 110);
    p.px(Math.floor(rng() * 240), y, rng() < 0.5 ? "#278a5e" : "#4cc28c");
  }
  p.dither(0, 150, 240, 10, null, "#227a54", 0.25);

  // Craters: this is Crater Field, after all.
  for (const [x, y, rx, ry] of [
    [18, 70, 9, 2.5],
    [222, 80, 11, 3],
    [14, 140, 10, 3],
    [226, 136, 8, 2.5],
    [30, 108, 6, 1.5],
  ]) {
    p.ellipse(x, y, rx, ry, "#25805a");
    p.ellipse(x, y + 0.5, rx - 1.5, ry - 1, "#1e6b4b");
    p.rect(x - rx + 2, y - Math.ceil(ry), rx * 2 - 4, 1, "#5fd39c");
  }

  // Goal shadow and pitch markings.
  p.ellipse(120, 101, 56, 1.5, "rgba(11, 16, 38, 0.35)");
  p.rect(0, 100, 240, 1, WHITE);
  p.rect(43, 100, 1, 23, WHITE)
    .rect(196, 100, 1, 23, WHITE)
    .rect(43, 123, 154, 1, WHITE);
  p.rect(58, 100, 1, 8, WHITE)
    .rect(181, 100, 1, 8, WHITE)
    .rect(58, 108, 124, 1, WHITE);
  for (let x = -22; x <= 22; x++) {
    const y = 123 + Math.round(7 * Math.sqrt(1 - (x * x) / 484));
    if (y > 123) p.px(120 + x, y, WHITE);
  }
  p.ellipse(120, 145, 2.5, 1, WHITE);
  return p;
}

function jumbotron(): Pixels {
  const p = new Pixels(JUMBO.w, JUMBO.h);
  p.rect(0, 0, JUMBO.w, JUMBO.h, INK);
  p.rect(1, 1, JUMBO.w - 2, JUMBO.h - 2, "#3a3f6b").rect(
    1,
    1,
    JUMBO.w - 2,
    1,
    "#6d7bb8",
  );
  p.rect(2, 2, JUMBO.w - 4, JUMBO.h - 4, "#0b1026");
  for (let y = 3; y < JUMBO.h - 2; y += 2)
    p.rect(2, y, JUMBO.w - 4, 1, "#0f1838");
  return p;
}

/** A line of jumbotron text: bright letters with a shadow (centre it). */
function screenText(text: string): Pixels {
  const p = new Pixels(textWidth(text) + 1, 8);
  return p.text(text, 1, 1, "#e8590c").text(text, 0, 0, "#ffd166");
}

function lamp(color: string, shine: string): Pixels {
  const p = new Pixels(7, 7);
  p.disc(3, 3, 2.6, color).px(2, 2, shine);
  return p.outline(INK);
}

/** The net, behind the posts. `bulge` is the frame used when the ball hits it. */
function net(bulge: boolean): Pixels {
  const p = new Pixels(112, 54);
  p.rect(4, 4, 104, 49, "rgba(255, 255, 255, 0.06)");
  p.rect(4, 4, 104, 5, "rgba(11, 16, 38, 0.3)");
  const line = "rgba(255, 255, 255, 0.38)";
  for (let x = 4; x <= 107; x += 4) {
    for (let y = 4; y <= 52; y++) {
      const push = bulge
        ? Math.round(2 * Math.sin((y / 52) * Math.PI) * Math.sign(x - 56))
        : 0;
      p.px(x + push, y, line);
    }
  }
  for (let y = 4; y <= 52; y += 4) {
    for (let x = 4; x <= 107; x++) {
      const sag = bulge
        ? Math.round(2 * Math.sin(((x - 4) / 103) * Math.PI))
        : 0;
      p.px(x, y + sag, line);
    }
  }
  return p;
}

function posts(): Pixels {
  const p = new Pixels(112, 54);
  for (const x of [1, 108]) {
    p.rect(x, 1, 3, 52, "#f2f4ff")
      .rect(x, 1, 1, 52, "#ffffff")
      .rect(x + 2, 1, 1, 52, "#c7d2fe");
  }
  p.rect(1, 1, 110, 3, "#f2f4ff")
    .rect(1, 1, 110, 1, "#ffffff")
    .rect(1, 3, 110, 1, "#c7d2fe");
  return p.outline(INK);
}

/** Bolt the robot goalie: 34×34 frames, feet at the bottom row. */
function bolt(pose: BoltPose): Pixels {
  const p = new Pixels(34, 34);
  const metal = "#9aa6d8";
  const dark = "#6d7bb8";
  const light = "#c7d2fe";
  const plate = WHITE;
  const glove = "#ff7a45";
  const gloveHi = "#ffb38a";
  const eye = "#7ee8c9";
  const navy = "#3a3fd1";
  const gold = "#ffd166";

  if (pose === "dive") {
    // Flying to the left, arms first (flip the image to dive right).
    p.rect(5, 11, 7, 3, metal).rect(6, 18, 6, 3, metal);
    p.disc(3, 12, 2.5, glove)
      .disc(4, 19, 2.5, glove)
      .px(2, 11, gloveHi)
      .px(3, 18, gloveHi);
    p.rect(18, 10, 11, 11, metal)
      .rect(18, 19, 11, 2, dark)
      .rect(18, 10, 11, 1, light);
    p.rect(20, 12, 6, 4, plate).px(23, 14, "#4cc9f0");
    p.rect(27, 10, 2, 11, navy);
    p.rect(28, 11, 3, 3, dark).rect(28, 17, 3, 3, dark);
    p.rect(31, 10, 2, 5, navy).rect(31, 16, 2, 5, navy);
    p.rect(10, 9, 9, 10, light).clear(10, 9).clear(10, 18);
    p.rect(10, 11, 6, 5, INK).rect(11, 12, 2, 2, eye).rect(14, 12, 1, 2, eye);
    p.line(18, 9, 21, 6, light).disc(22, 5, 1, gold);
    return p.outline(INK);
  }

  const drop = pose === "bob" ? 1 : pose === "ready" ? 3 : 0;
  const y0 = 5 + drop;
  const by = y0 + 11;

  // Legs and feet.
  if (pose === "ready") {
    p.rect(8, 27, 3, 5, dark).rect(23, 27, 3, 5, dark);
    p.rect(6, 32, 5, 2, navy).rect(23, 32, 5, 2, navy);
  } else {
    p.rect(12, 26, 3, 6, dark).rect(19, 26, 3, 6, dark);
    p.rect(11, 32, 5, 2, navy).rect(18, 32, 5, 2, navy);
  }

  // Arms and gloves.
  const arm = (x: number, y: number, w: number, h: number) =>
    p.rect(x, y, w, h, metal);
  const gloveAt = (x: number, y: number) =>
    p.disc(x, y, 2.5, glove).px(x - 1, y - 1, gloveHi);
  if (pose === "cheer") {
    arm(7, by - 8, 3, 9);
    arm(24, by - 8, 3, 9);
    gloveAt(8, by - 9);
    gloveAt(25, by - 9);
  } else if (pose === "sad") {
    arm(7, by + 1, 3, 8);
    arm(24, by + 1, 3, 8);
    gloveAt(8, by + 10);
    gloveAt(25, by + 10);
  } else if (pose === "ready") {
    arm(4, by + 3, 6, 3);
    arm(24, by + 3, 6, 3);
    gloveAt(3, by + 4);
    gloveAt(30, by + 4);
  } else {
    arm(5, by + 1, 5, 3);
    arm(24, by + 1, 5, 3);
    gloveAt(4, by);
    gloveAt(29, by);
  }

  // Body: metal box with a chest plate, light and belt.
  p.rect(10, by, 14, 12, metal)
    .rect(10, by, 1, 12, light)
    .rect(22, by, 2, 12, dark);
  p.rect(12, by + 2, 9, 5, plate).disc(16, by + 4, 1.4, "#4cc9f0");
  p.rect(10, by + 9, 14, 2, navy);

  // Head with a visor; eyes show the mood.
  p.rect(11, y0, 12, 10, light)
    .clear(11, y0)
    .clear(22, y0)
    .clear(11, y0 + 9)
    .clear(22, y0 + 9);
  p.rect(21, y0 + 1, 1, 8, metal);
  p.rect(12, y0 + 2, 9, 5, INK);
  if (pose === "cheer") {
    for (const ex of [13, 18])
      p.px(ex, y0 + 4, eye)
        .px(ex + 1, y0 + 3, eye)
        .px(ex + 2, y0 + 4, eye);
  } else if (pose === "sad") {
    p.rect(13, y0 + 5, 3, 1, eye).rect(18, y0 + 5, 3, 1, eye);
  } else {
    p.rect(13, y0 + 3, 2, 2, eye).rect(18, y0 + 3, 2, 2, eye);
  }
  p.line(16, y0 - 1, 16, y0 - 3, light).disc(16, y0 - 4, 1, gold);
  return p.outline(INK);
}

/** The striker, a kid astronaut seen from behind (22×28 frames). */
function striker(pose: keyof typeof STRIKER_FRAME): Pixels {
  const p = new Pixels(22, 28);
  const suit = "#ff7a45";
  const suitDark = "#d9622b";
  const sock = WHITE;
  const boot = "#4cc9f0";
  const leg = (x: number, len: number) =>
    p.rect(x, 20, 3, len, sock).rect(x - 1, 20 + len, 4, 2, boot);

  if (pose === "runA") {
    leg(7, 3);
    leg(12, 5);
  } else if (pose === "runB") {
    leg(7, 5);
    leg(12, 3);
  } else if (pose === "kick") {
    leg(7, 5);
    p.rect(13, 20, 3, 2, sock)
      .rect(15, 21, 3, 2, sock)
      .rect(18, 21, 3, 3, boot);
  } else {
    leg(7, 5);
    leg(12, 5);
  }
  p.rect(6, 18, 10, 3, "#3a3fd1");

  // Arms behind the body are drawn first.
  if (pose === "cheer") {
    p.rect(4, 3, 2, 9, suit)
      .rect(16, 3, 2, 9, suit)
      .rect(4, 2, 2, 2, sock)
      .rect(16, 2, 2, 2, sock);
  } else if (pose === "kick") {
    p.rect(2, 11, 4, 2, suit).rect(16, 13, 2, 5, suit);
  } else if (pose === "runA") {
    p.rect(4, 11, 2, 5, suit).rect(16, 13, 2, 6, suit);
  } else if (pose === "runB") {
    p.rect(4, 13, 2, 6, suit).rect(16, 11, 2, 5, suit);
  } else {
    p.rect(4, 12, 2, 6, suit).rect(16, 12, 2, 6, suit);
  }

  p.rect(6, 11, 10, 8, suit).rect(15, 11, 1, 8, suitDark);
  p.rect(8, 11, 6, 6, "#c7d2fe")
    .rect(13, 11, 1, 6, "#9aa6d8")
    .rect(10, 13, 2, 2, "#ffd166");
  p.rect(8, 10, 6, 1, "#6d7bb8");
  p.disc(12, 6, 5, "#c7d2fe").disc(11, 6, 4.6, WHITE);
  p.rect(10, 1, 2, 9, suit);
  return p.outline(INK);
}

/** The comet ball (11×11), four spin frames. */
function ball(frame: number): Pixels {
  const p = new Pixels(11, 11);
  p.disc(5, 5, 4, "#ffffff");
  p.px(7, 8, "#c7d2fe")
    .px(8, 7, "#c7d2fe")
    .px(8, 6, "#c7d2fe")
    .px(6, 8, "#c7d2fe");
  const patches: [number, number][] = [
    [-2, -2],
    [2, -1],
    [-1, 2],
  ];
  const turns = frame % 4;
  for (const [dx, dy] of patches) {
    let [x, y] = [dx, dy];
    for (let i = 0; i < turns; i++) [x, y] = [-y, x];
    p.rect(5 + x, 5 + y, 1, 1, "#4cc9f0");
    p.px(5 + x + (x >= 0 ? 1 : -1) * 0, 5 + y + 1, "#3a86ff");
  }
  p.px(5, 5, "#3a86ff");
  return p.outline("#1b2350");
}

function reticle(r: number): Pixels {
  const p = new Pixels(17, 17);
  p.ring(8, 8, r, r, "#ff7a45").ring(8, 8, r - 1, r - 1, "#ffb38a");
  p.rect(8, 0, 1, 4, "#ff7a45").rect(8, 13, 1, 4, "#ff7a45");
  p.rect(0, 8, 4, 1, "#ff7a45").rect(13, 8, 4, 1, "#ff7a45");
  p.px(8, 8, "#ffd166");
  return p.outline(INK);
}

/** Power meter. Zones from the bottom: weak, good, strong, wild (see POWER). */
function meter(lit: boolean): Pixels {
  const p = new Pixels(METER.w, METER.h);
  p.rect(0, 0, METER.w, METER.h, INK);
  p.rect(1, 1, METER.w - 2, METER.h - 2, "#3a3f6b").rect(
    1,
    1,
    METER.w - 2,
    1,
    "#6d7bb8",
  );
  const { innerX: x, innerY: y, innerW: w, innerH: h } = METER;
  const row = (power: number) => y + Math.round((1 - power) * h);
  const zones: [number, number, string, string, string][] = [
    [0, 0.45, "#ffd166", "#fff3b0", "#e09f1f"],
    [0.45, 0.8, "#34d399", "#b6ffe4", "#1b8a6b"],
    [0.8, 0.92, "#ff9f5a", "#ffd0a8", "#d9622b"],
    [0.92, 1, "#ef4444", "#ffb4b4", "#9d174d"],
  ];
  for (const [from, to, color, hi, shade] of zones) {
    const top = row(to);
    const height = row(from) - top;
    p.rect(x, top, w, height, color)
      .rect(x, top, 1, height, hi)
      .rect(x + w - 2, top, 2, height, shade);
    p.rect(x, top, w, 1, INK);
  }
  // A star marks the good zone.
  const star = row(0.625);
  p.px(x + 4, star - 1, "#ffffff")
    .rect(x + 3, star, 3, 1, "#ffffff")
    .px(x + 4, star + 1, "#ffffff");
  if (!lit) p.dither(x, y, w, h, null, "#0b1026", 0.5);
  return p;
}

function pointer(): Pixels {
  const p = new Pixels(8, 9);
  p.poly(
    [
      [0, 0],
      [7, 4.5],
      [0, 9],
    ],
    "#ffffff",
  );
  return p.outline(INK);
}
