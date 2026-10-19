import type Phaser from "phaser";
import { textWidth } from "@/lib/pixelFont";
import {
  addBanner,
  addPixelParticle,
  addSheet,
  addTexture,
  BANNER,
  burstArt,
  cometArt,
  crowdRow,
  insidePolygon,
  Pixels,
  seeded,
  starField,
  twinkleArt,
  type Point,
} from "../shared/pixel";

/**
 * Cosmic Slam's pixel art, all drawn in code: the moonlit ballpark and its
 * scoreboard, the Moon Pitcher, the kid astronaut batter, the ball (drawn at
 * several sizes for perspective, like 16-bit sprites) and the banners. Art
 * pixels are 3 world units, so the 720×480 world is 240×160 art pixels.
 */

const INK = "#140c2c";
const WHITE = "#e8ecff";

export const PITCHER_FRAME = {
  idle: 0,
  bob: 1,
  windup: 2,
  throw: 3,
  cheer: 4,
} as const;
export const BATTER_FRAME = {
  stance: 0,
  load: 1,
  contact: 2,
  follow: 3,
  cheer: 4,
} as const;
/** Batter frames are 44×40; the body's centre and feet are here. */
export const BATTER_ANCHOR = { x: 16, w: 44 };

/** Ball sprite frames: diameters 2…8 art px (frame 0 is the smallest). */
export const BALL_SIZES = [2, 3, 4, 5, 6, 7, 8];
export const SHADOW_SIZES = [3, 4, 5, 6, 7, 8];

export const CROWD_ROWS = [
  { y: 34, offset: 2 },
  { y: 40, offset: 5 },
];
export const CROWD = { calmA: 0, calmB: 1, cheerA: 2, cheerB: 3 } as const;

/** Scoreboard, top centre, in art px. */
export const BOARD = {
  x: 74,
  y: 1,
  w: 92,
  h: 30,
  titleY: 3,
  lineY: 12,
  lampsY: 21,
  strikesX: 11,
  outsX: 40,
  lampGap: 7,
  scoreX: 68,
};
export const LAMP = { off: 0, strike: 1, out: 2 } as const;

/** Lines the scoreboard can show, by key. */
export const SCREEN = {
  title: "BATTER UP!",
  slow: "SLOW PITCH",
  medium: "MEDIUM PITCH",
  fast: "FAST PITCH!",
  swing: "SWING!",
  homeRun: "HOME RUN!",
  hit: "NICE HIT!",
  foul: "FOUL BALL",
  strike: "STRIKE!",
  out: "YOU'RE OUT!",
} as const;

export function makeArt(scene: Phaser.Scene) {
  addTexture(scene, "slam-sky", sky());
  CROWD_ROWS.forEach((row, i) => {
    const frames = [0, 1, 2, 3].map((frame) =>
      crowdRow(240, row.offset, seeded(70 + i), (n) => {
        if (frame === CROWD.cheerA) return true;
        if (frame === CROWD.cheerB) return n % 2 === 1;
        return (n * 5 + i * 4 + frame * 7) % 13 === 0;
      }),
    );
    addSheet(scene, `slam-crowd-${i}`, frames);
  });
  addTexture(scene, "slam-field", field());
  addTexture(scene, "slam-board", scoreboard());
  for (const [key, text] of Object.entries(SCREEN)) {
    addTexture(
      scene,
      `slam-screen-${key}`,
      screenText(text, "#ffd166", "#e8590c"),
    );
  }
  addSheet(scene, "slam-lamp", [
    lamp("#3a3f6b", "#565c94"),
    lamp("#ffd166", "#fff6c8"),
    lamp("#ef4444", "#ffb4b4"),
  ]);
  addSheet(
    scene,
    "slam-digit",
    [..."0123456789"].map((d) => new Pixels(5, 7).text(d, 0, 0, "#7ee8c9")),
  );
  addSheet(
    scene,
    "slam-pitcher",
    (Object.keys(PITCHER_FRAME) as (keyof typeof PITCHER_FRAME)[]).map(pitcher),
  );
  addSheet(
    scene,
    "slam-batter",
    (Object.keys(BATTER_FRAME) as (keyof typeof BATTER_FRAME)[]).map(batter),
  );
  addSheet(scene, "slam-ball", BALL_SIZES.map(ball));
  addSheet(scene, "slam-shadow", SHADOW_SIZES.map(shadow));
  addSheet(scene, "slam-ring", [ring(false), ring(true)]);
  addSheet(scene, "slam-burst", [0, 1, 2, 3].map(burstArt));
  addTexture(scene, "slam-twinkle", twinkleArt());
  addTexture(scene, "slam-comet", cometArt());
  addPixelParticle(scene, "slam-px");
  addPixelParticle(scene, "slam-confetti", 2, 1);

  addBanner(scene, "slam-b-homeRun", "HOME RUN!", { ...BANNER.gold, scale: 3 });
  addBanner(scene, "slam-b-hit", "NICE HIT!", { ...BANNER.mint, scale: 2 });
  addBanner(scene, "slam-b-foul", "FOUL BALL", { ...BANNER.violet, scale: 2 });
  addBanner(scene, "slam-b-strike", "STRIKE!", { ...BANNER.pink, scale: 2 });
  addBanner(scene, "slam-b-out", "OUT!", { ...BANNER.pink, scale: 3 });
  addBanner(scene, "slam-b-over", "THREE OUTS!", { ...BANNER.gold, scale: 2 });
  addBanner(scene, "slam-b-up", "BATTER UP!", { ...BANNER.sky, scale: 2 });
}

/** Night sky with a huge cratered moon, floodlights and the stands. */
function sky(): Pixels {
  const rng = seeded(21);
  const p = new Pixels(240, 48);
  p.gradient(0, 0, 240, 48, [
    "#070a1f",
    "#0b1026",
    "#1a1f4d",
    "#2b3668",
    "#4a3a7a",
  ]);
  starField(p, 80, 30, rng);

  // The Moon, home of the Moon Pitcher.
  p.disc(204, 17, 14, "#9aa6d8")
    .disc(202, 15, 13, "#c7d2fe")
    .disc(200, 13, 10, WHITE);
  for (const [x, y, r] of [
    [196, 11, 2.5],
    [207, 20, 3],
    [203, 9, 1.5],
    [212, 13, 1.5],
    [195, 21, 2],
  ]) {
    p.disc(x, y, r, "#9aa6d8").disc(x - 0.5, y - 0.5, r - 1, "#c7d2fe");
  }
  // A small green planet far away.
  p.disc(30, 12, 4, "#1b8a6b")
    .disc(29, 11, 3.5, "#7ee8c9")
    .px(28, 10, "#e2fff4");

  // Stands.
  p.rect(0, 33, 240, 15, "#141b42").rect(0, 32, 240, 1, "#3a3f6b");
  p.rect(0, 39, 240, 1, "#1d2650").rect(0, 45, 240, 1, "#1d2650");

  // Scoreboard posts.
  p.rect(96, 30, 2, 4, "#3a3f6b").rect(142, 30, 2, 4, "#3a3f6b");

  // Floodlights with dithered light cones.
  for (const x of [14, 225]) {
    const toward = x < 120 ? 1 : -1;
    p.poly(
      [
        [x - 4, 10],
        [x + 4, 10],
        [x + toward * 70, 48],
        [x + toward * 25, 48],
      ],
      "rgba(255, 243, 176, 0.07)",
    );
    p.rect(x - 1, 9, 2, 39, "#3a3f6b").rect(x, 9, 1, 39, "#565c94");
    p.rect(x - 7, 3, 14, 7, "#6d7bb8").rect(x - 7, 3, 14, 1, "#9aa6d8");
    for (let i = 0; i < 4; i++) {
      p.rect(x - 6 + i * 3, 4, 2, 2, "#fff3b0").rect(
        x - 6 + i * 3,
        7,
        2,
        2,
        "#ffe08a",
      );
    }
  }
  return p;
}

/** Outfield wall, mowed grass, the dirt diamond, mound, plate and chalk. */
function field(): Pixels {
  const rng = seeded(31);
  const p = new Pixels(240, 160);

  // Padded outfield wall with distance markers.
  p.rect(0, 47, 240, 10, "#1d2650").rect(0, 47, 240, 1, "#ffd166");
  for (let x = 0; x < 240; x += 12) p.rect(x, 48, 1, 9, "#141b42");
  for (const [x, text] of [
    [22, "330"],
    [111, "400"],
    [201, "330"],
  ] as const) {
    p.text(text, x, 49, "#ffd166");
  }

  // Grass bands, wider toward the camera.
  const edges = [57, 63, 70, 78, 88, 100, 114, 130, 160];
  for (let i = 0; i < edges.length - 1; i++) {
    p.rect(
      0,
      edges[i],
      240,
      edges[i + 1] - edges[i],
      i % 2 ? "#38b07c" : "#2f9e6e",
    );
    if (i > 0)
      p.dither(0, edges[i], 240, 1, null, i % 2 ? "#2f9e6e" : "#38b07c", 0.5);
  }
  for (let i = 0; i < 500; i++) {
    p.px(
      Math.floor(rng() * 240),
      57 + Math.floor(rng() * 103),
      rng() < 0.5 ? "#278a5e" : "#4cc28c",
    );
  }

  // Dirt diamond with a darker rim, then the infield grass.
  const outer: Point[] = [
    [120, 64],
    [202, 110],
    [124, 158],
    [38, 110],
  ];
  const inner: Point[] = [
    [120, 79],
    [174, 110],
    [123, 137],
    [66, 110],
  ];
  p.poly(outer, "#b5895c");
  p.poly(
    outer.map(
      ([x, y]) => [120 + (x - 120) * 0.97, 110 + (y - 110) * 0.96] as Point,
    ),
    "#c89b6d",
  );
  p.poly(inner, "#2f9e6e");
  for (let i = 0; i < 160; i++) {
    const x = 70 + Math.floor(rng() * 100);
    const y = 82 + Math.floor(rng() * 52);
    p.px(x, y, rng() < 0.5 ? "#278a5e" : "#38b07c");
  }
  for (let i = 0; i < 260; i++) {
    const x = 40 + Math.floor(rng() * 160);
    const y = 64 + Math.floor(rng() * 94);
    const shade = rng() < 0.5 ? "#b5895c" : "#d9b48a";
    if (insidePolygon(x, y, outer) && !insidePolygon(x, y, inner))
      p.px(x, y, shade);
  }

  // Chalk foul lines and bases.
  p.line(124, 150, 240, 84, WHITE).line(122, 150, 0, 83, WHITE);
  for (const [x, y] of [
    [200, 109],
    [119, 64],
    [39, 109],
  ]) {
    p.rect(x - 1, y - 1, 3, 2, "#ffffff").rect(x - 1, y + 1, 3, 1, "#c7d2fe");
  }

  // Pitcher's mound with its rubber.
  p.ellipse(120, 73, 13, 4, "#b5895c").ellipse(120, 72, 11, 3, "#c89b6d");
  p.rect(117, 71, 6, 1, "#ffffff");

  // Home plate area: dirt circle, batter's boxes and the plate.
  p.ellipse(124, 145, 27, 9, "#b5895c").ellipse(124, 144, 25, 8, "#c89b6d");
  for (const x of [103, 131]) {
    p.rect(x, 138, 14, 1, WHITE).rect(x, 151, 14, 1, WHITE);
    p.rect(x, 138, 1, 14, WHITE).rect(x + 13, 138, 1, 14, WHITE);
  }
  p.poly(
    [
      [119.5, 142],
      [128.5, 142],
      [128.5, 144],
      [124, 147],
      [119.5, 144],
    ],
    "#ffffff",
  );
  p.rect(120, 145, 8, 1, "#c7d2fe");
  return p;
}

function scoreboard(): Pixels {
  const p = new Pixels(BOARD.w, BOARD.h);
  p.rect(0, 0, BOARD.w, BOARD.h, INK);
  p.rect(1, 1, BOARD.w - 2, BOARD.h - 2, "#3a3f6b").rect(
    1,
    1,
    BOARD.w - 2,
    1,
    "#6d7bb8",
  );
  p.rect(2, 2, BOARD.w - 4, BOARD.h - 4, "#0b1026");
  for (let y = 3; y < BOARD.h - 2; y += 2)
    p.rect(2, y, BOARD.w - 4, 1, "#0f1838");
  const title = "COSMIC SLAM";
  const x = Math.floor((BOARD.w - textWidth(title)) / 2);
  p.text(title, x + 1, BOARD.titleY + 1, "#6d28d9").text(
    title,
    x,
    BOARD.titleY,
    "#c4b5fd",
  );
  p.rect(3, BOARD.lineY - 2, BOARD.w - 6, 1, "#1d2650").rect(
    3,
    BOARD.lampsY - 2,
    BOARD.w - 6,
    1,
    "#1d2650",
  );
  p.text("S", 4, BOARD.lampsY, "#9aa6d8").text(
    "O",
    33,
    BOARD.lampsY,
    "#9aa6d8",
  );
  return p;
}

function screenText(text: string, color: string, shadow: string): Pixels {
  const p = new Pixels(textWidth(text) + 1, 8);
  return p.text(text, 1, 1, shadow).text(text, 0, 0, color);
}

function lamp(color: string, shine: string): Pixels {
  const p = new Pixels(5, 5);
  return p.disc(2, 2, 2.2, color).px(1, 1, shine);
}

/** The Moon Pitcher: a round, three-eyed purple alien in a cap (22×26). */
function pitcher(pose: keyof typeof PITCHER_FRAME): Pixels {
  const p = new Pixels(22, 26);
  const skin = "#a78bfa";
  const shade = "#6d28d9";
  const belly = "#c4b5fd";
  const cap = "#ff7a45";
  const glove = "#b5895c";
  const squash = pose === "windup" ? 1 : 0;
  const drop = pose === "bob" || pose === "throw" ? 1 : 0;
  const cy = 15 + squash + drop;

  // Feet (one raised in the windup).
  if (pose === "windup") {
    p.rect(6, 23, 4, 2, shade).rect(13, 20, 4, 2, shade);
  } else {
    p.rect(6, 23, 4, 2, shade).rect(12, 23, 4, 2, shade);
  }

  // Arms: down at rest, both up in the windup, one flung forward on the throw.
  if (pose === "windup") {
    p.rect(5, cy - 13, 3, 8, skin).rect(14, cy - 13, 3, 8, skin);
    p.disc(10.5, cy - 13, 2.5, glove).disc(11.5, cy - 13, 1.6, "#ffffff");
  } else if (pose === "throw") {
    p.rect(2, cy - 2, 3, 5, skin).disc(3, cy + 3, 2.3, glove);
    p.rect(16, cy, 4, 3, skin).rect(18, cy + 2, 3, 4, skin);
  } else if (pose === "cheer") {
    p.rect(2, cy - 10, 3, 9, skin).rect(17, cy - 10, 3, 9, skin);
    p.disc(3, cy - 11, 2.3, glove);
  } else {
    p.rect(2, cy - 3, 3, 7, skin).rect(17, cy - 3, 3, 7, skin);
    p.disc(3, cy + 4, 2.3, glove);
  }

  // Round body with a light belly.
  p.ellipse(11, cy, 8, 8 - squash, shade).ellipse(
    10.5,
    cy - 0.5,
    7.5,
    7.5 - squash,
    skin,
  );
  p.ellipse(11, cy + 3, 4.5, 3.5 - squash, belly);

  // Three eyes (happy when cheering).
  for (const ex of [7, 11, 15]) {
    if (pose === "cheer") {
      p.px(ex - 1, cy - 4, "#ffffff")
        .px(ex, cy - 5, "#ffffff")
        .px(ex + 1, cy - 4, "#ffffff");
    } else {
      p.disc(ex, cy - 4, 1.6, "#ffffff").px(ex, cy - 3, INK);
    }
  }
  p.rect(9, cy, 5, 1, shade);

  // Cap with a bill, and an antenna poking through.
  p.rect(5, cy - 9, 12, 3, cap)
    .rect(4, cy - 7, 15, 1, "#d9622b")
    .rect(12, cy - 7, 7, 1, cap);
  p.px(10, cy - 8, "#ffd166");
  p.rect(11, cy - 12, 1, 3, belly).disc(11, cy - 13, 1, "#ffd166");
  return p.outline(INK);
}

/** Bat from the hands (hx, hy) to the tip (ex, ey): tape on the handle, wide barrel. */
function bat(p: Pixels, hx: number, hy: number, ex: number, ey: number) {
  const steps = Math.ceil(Math.hypot(ex - hx, ey - hy));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = hx + (ex - hx) * t;
    const y = hy + (ey - hy) * t;
    if (t < 0.25) {
      p.px(x, y, "#1b2350");
    } else {
      p.rect(
        x - (t > 0.55 ? 1 : 0.5),
        y - (t > 0.55 ? 1 : 0.5),
        t > 0.55 ? 2 : 1,
        t > 0.55 ? 2 : 1,
        "#e2b07a",
      );
      if (t > 0.55) p.px(x, y + 1, "#b5895c");
    }
  }
}

/** The kid astronaut batter, seen from behind and to the left (44×40). */
function batter(pose: keyof typeof BATTER_FRAME): Pixels {
  const p = new Pixels(BATTER_ANCHOR.w, 40);
  const suit = "#ff7a45";
  const suitDark = "#d9622b";
  const legs = "#6d7bb8";
  const shoe = "#3a3fd1";

  // After the swing the bat wraps around behind the helmet.
  if (pose === "follow") bat(p, 14, 14, 2, 2);

  // Legs: a wide stance, the front foot stepping on contact.
  const step = pose === "contact" || pose === "follow" ? 2 : 0;
  p.rect(9, 27, 4, 10, legs).rect(19 + step, 27, 4, 10, legs);
  p.rect(8, 37, 6, 2, shoe).rect(19 + step, 37, 6, 2, shoe);

  // Torso and backpack.
  const twist = pose === "contact" || pose === "follow" ? 1 : 0;
  p.rect(9 + twist, 15, 13, 13, suit).rect(20 + twist, 15, 2, 13, suitDark);
  p.rect(9 + twist, 21, 13, 2, "#ffffff");
  p.rect(10 + twist, 15, 6, 6, "#c7d2fe").rect(12 + twist, 17, 2, 2, "#ffd166");

  // Arms to the hands.
  const hands: Record<string, Point> = {
    stance: [21, 16],
    load: [20, 17],
    contact: [25, 24],
    follow: [14, 14],
    cheer: [16, 4],
  };
  const [hx, hy] = hands[pose];
  for (const sx of [18, 21]) {
    const steps = 6;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      p.rect(
        sx + twist + (hx - sx - twist) * t,
        17 + (hy - 17) * t,
        2,
        2,
        suit,
      );
    }
  }
  p.rect(hx - 1, hy - 1, 3, 3, WHITE);

  // Helmet with the visor toward the plate.
  p.disc(16 + twist, 9, 6.5, "#c7d2fe").disc(15.5 + twist, 8.5, 6, WHITE);
  p.rect(18 + twist * 2, 6, 4, 5, "#4cc9f0").px(19 + twist * 2, 6, "#c8f4ff");
  p.rect(11 + twist, 3, 2, 10, suit);

  // Bat in front: up by the back shoulder, cocked, then level over the plate.
  if (pose === "stance") bat(p, 21, 16, 27, 1);
  if (pose === "load") bat(p, 20, 17, 32, 4);
  if (pose === "contact") bat(p, 25, 24, 43, 25);
  if (pose === "cheer") bat(p, 16, 4, 28, 1);
  return p.outline(INK);
}

function ball(size: number): Pixels {
  const p = new Pixels(10, 10);
  const r = size / 2;
  p.ellipse(5, 5, r - 0.01, r - 0.01, "#ffffff");
  if (size >= 4) p.px(5 + Math.floor(r / 2), 5 + Math.floor(r / 2), "#c7d2fe");
  if (size >= 5) {
    p.px(5 - Math.floor(r / 2), 4, "#ef4444").px(
      5 - Math.floor(r / 2),
      6,
      "#ef4444",
    );
    p.px(5 + Math.floor(r / 2) - 1, 3, "#ef4444").px(
      5 + Math.floor(r / 2) - 1,
      5,
      "#ef4444",
    );
  }
  return size >= 3 ? p.outline(INK) : p;
}

function shadow(size: number): Pixels {
  const p = new Pixels(10, 4);
  return p.ellipse(
    5,
    2,
    size / 2,
    Math.max(0.6, size / 6),
    "rgba(11, 16, 38, 0.45)",
  );
}

/** The sweet-spot ring over the plate (dim and bright). */
function ring(bright: boolean): Pixels {
  const p = new Pixels(26, 12);
  p.ring(13, 6, 12, 5, "#ffd166");
  p.ring(13, 6, 11, 4, bright ? "#fff3b0" : "#e09f1f");
  return p;
}
