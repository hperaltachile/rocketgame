import Phaser from "phaser";
import { GLYPH_H, textPixels, textWidth } from "@/lib/pixelFont";

export { seeded } from "@/lib/games/rng";

/**
 * Pixel-art kit for the retro (16/32-bit style) games. Art is drawn in code,
 * one "art pixel" at a time, on small canvases that become crisp
 * nearest-neighbour textures. A 720×480 world is 240×160 art pixels.
 */

/** World units per art pixel. Show textures with `.setScale(ART)`. */
export const ART = 3;

/** 4×4 ordered-dither thresholds, for SNES-style gradients. */
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((row) => row.map((v) => (v + 0.5) / 16));

export type Point = [number, number];

/** A small canvas drawn in whole art pixels, with no anti-aliasing. */
export class Pixels {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx = this.canvas.getContext("2d")!;
    this.ctx.imageSmoothingEnabled = false;
  }

  rect(x: number, y: number, w: number, h: number, color: string): this {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(
      Math.round(x),
      Math.round(y),
      Math.round(w),
      Math.round(h),
    );
    return this;
  }

  px(x: number, y: number, color: string): this {
    return this.rect(x, y, 1, 1, color);
  }

  /** Makes a box transparent again. */
  clear(x: number, y: number, w = 1, h = 1): this {
    this.ctx.clearRect(Math.round(x), Math.round(y), w, h);
    return this;
  }

  /** Filled ellipse centred on (cx, cy), drawn row by row. */
  ellipse(cx: number, cy: number, rx: number, ry: number, color: string): this {
    for (let y = Math.ceil(-ry); y <= Math.floor(ry); y++) {
      const half = rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry)));
      const x0 = Math.round(cx - half);
      const x1 = Math.round(cx + half);
      if (x1 >= x0) this.rect(x0, Math.round(cy + y), x1 - x0 + 1, 1, color);
    }
    return this;
  }

  disc(cx: number, cy: number, r: number, color: string): this {
    return this.ellipse(cx, cy, r, r, color);
  }

  /** One-pixel ellipse outline. */
  ring(cx: number, cy: number, rx: number, ry: number, color: string): this {
    const inside = (x: number, y: number) =>
      ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        if (
          inside(x, y) &&
          (!inside(x + 1, y) ||
            !inside(x - 1, y) ||
            !inside(x, y + 1) ||
            !inside(x, y - 1))
        ) {
          this.px(x, y, color);
        }
      }
    }
    return this;
  }

  /** Straight one-pixel line (Bresenham). */
  line(x0: number, y0: number, x1: number, y1: number, color: string): this {
    let [x, y] = [Math.round(x0), Math.round(y0)];
    const [ex, ey] = [Math.round(x1), Math.round(y1)];
    const dx = Math.abs(ex - x);
    const dy = -Math.abs(ey - y);
    const sx = x < ex ? 1 : -1;
    const sy = y < ey ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.px(x, y, color);
      if (x === ex && y === ey) return this;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  }

  /** Filled polygon: every pixel whose centre is inside. */
  poly(points: Point[], color: string): this {
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.max(...ys); y++) {
      for (let x = Math.floor(Math.min(...xs)); x <= Math.max(...xs); x++) {
        if (insidePolygon(x + 0.5, y + 0.5, points)) this.px(x, y, color);
      }
    }
    return this;
  }

  /**
   * Ordered-dither mix of `a` and `b` over a box: `amount` 0 is all `a`, 1
   * all `b`. With `a` null, `b` is dithered over what's already there.
   */
  dither(
    x: number,
    y: number,
    w: number,
    h: number,
    a: string | null,
    b: string,
    amount: number,
  ): this {
    if (a !== null) this.rect(x, y, w, h, a);
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const gx = x + i;
        const gy = y + j;
        if (BAYER[((gy % 4) + 4) % 4][((gx % 4) + 4) % 4] < amount)
          this.px(gx, gy, b);
      }
    }
    return this;
  }

  /** Vertical gradient through `colors`: solid bands with dithered steps between them. */
  gradient(x: number, y: number, w: number, h: number, colors: string[]): this {
    const steps = colors.length - 1;
    for (let j = 0; j < h; j++) {
      const t = (j / Math.max(1, h - 1)) * steps;
      const i = Math.min(steps - 1, Math.floor(t));
      const f = t - i;
      // Quantise to 4 dither levels per band: the banding is the look.
      this.dither(
        x,
        y + j,
        w,
        1,
        colors[i],
        colors[i + 1],
        Math.round(f * 4) / 4,
      );
    }
    return this;
  }

  /** Adds a one-pixel outline in `color` around everything drawn so far. */
  outline(color: string, diagonals = false): this {
    const image = this.ctx.getImageData(0, 0, this.w, this.h);
    const solid = (x: number, y: number) =>
      x >= 0 &&
      y >= 0 &&
      x < this.w &&
      y < this.h &&
      image.data[(y * this.w + x) * 4 + 3] > 0;
    const edge: Point[] = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (solid(x, y)) continue;
        if (
          solid(x + 1, y) ||
          solid(x - 1, y) ||
          solid(x, y + 1) ||
          solid(x, y - 1) ||
          (diagonals &&
            (solid(x + 1, y + 1) ||
              solid(x - 1, y - 1) ||
              solid(x + 1, y - 1) ||
              solid(x - 1, y + 1)))
        ) {
          edge.push([x, y]);
        }
      }
    }
    for (const [x, y] of edge) this.px(x, y, color);
    return this;
  }

  /** Text in the RocketGame pixel font; `scale` font pixels per art pixel. */
  text(text: string, x: number, y: number, color: string, scale = 1): this {
    for (const p of textPixels(text)) {
      this.rect(x + p.x * scale, y + p.y * scale, scale, scale, color);
    }
    return this;
  }

  /** Draws another pixel canvas onto this one. */
  stamp(other: Pixels, x: number, y: number, flipX = false): this {
    if (!flipX) {
      this.ctx.drawImage(other.canvas, Math.round(x), Math.round(y));
      return this;
    }
    this.ctx.save();
    this.ctx.translate(Math.round(x) + other.w, Math.round(y));
    this.ctx.scale(-1, 1);
    this.ctx.drawImage(other.canvas, 0, 0);
    this.ctx.restore();
    return this;
  }
}

/** Whether (x, y) is inside the polygon (even-odd rule). */
export function insidePolygon(x: number, y: number, points: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Turns a pixel canvas into a crisp (nearest-neighbour) texture. */
export function addTexture(scene: Phaser.Scene, key: string, art: Pixels) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const texture = scene.textures.addCanvas(key, art.canvas)!;
  texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  return texture;
}

/** Equal-size frames side by side as one texture; frames are named 0, 1, 2… */
export function addSheet(scene: Phaser.Scene, key: string, frames: Pixels[]) {
  const { w, h } = frames[0];
  const sheet = new Pixels(w * frames.length, h);
  frames.forEach((frame, i) => sheet.stamp(frame, i * w, 0));
  const texture = addTexture(scene, key, sheet);
  frames.forEach((_, i) => texture.add(i, 0, i * w, 0, w, h));
  return texture;
}

/** An image of a pixel texture at its world size. */
export function art(
  scene: Phaser.Scene,
  x: number,
  y: number,
  key: string,
  frame?: number,
) {
  return scene.add.image(x, y, key, frame).setScale(ART);
}

export type BannerStyle = {
  /** Fill colours from the top of the letters to the bottom. */
  fill: string[];
  outline?: string;
  shadow?: string;
  /** Art pixels per font pixel. */
  scale?: number;
};

/**
 * Big title text: gradient-filled letters with a highlight, a dark outline
 * and a drop shadow, like a 16-bit title screen.
 */
export function bannerArt(text: string, style: BannerStyle): Pixels {
  const scale = style.scale ?? 2;
  const outline = style.outline ?? "#140c2c";
  const shadow = style.shadow ?? "#05030f";
  const textW = textWidth(text) * scale;
  const textH = GLYPH_H * scale;
  const letters = new Pixels(textW, textH);
  for (let row = 0; row < textH; row++) {
    const t = row / Math.max(1, textH - 1);
    const color =
      row < scale - 1 || (row === 0 && scale === 1)
        ? "#ffffff"
        : style.fill[
            Math.min(style.fill.length - 1, Math.floor(t * style.fill.length))
          ];
    for (const p of textPixels(text)) {
      if (Math.floor(row / scale) === p.y) {
        letters.rect(p.x * scale, row, scale, 1, color);
      }
    }
  }
  const out = new Pixels(textW + 4, textH + 5);
  // Shadow: the outlined letters, offset down, in one dark colour.
  const silhouette = new Pixels(textW + 2, textH + 2);
  for (const p of textPixels(text)) {
    silhouette.rect(1 + p.x * scale, 1 + p.y * scale, scale, scale, outline);
  }
  silhouette.outline(outline, true);
  const shadowArt = new Pixels(silhouette.w, silhouette.h);
  shadowArt.stamp(silhouette, 0, 0);
  shadowArt.ctx.globalCompositeOperation = "source-in";
  shadowArt.rect(0, 0, shadowArt.w, shadowArt.h, shadow);
  out.stamp(shadowArt, 1, 3);
  out.stamp(silhouette, 0, 0);
  out.stamp(letters, 1, 1);
  return out;
}

export function addBanner(
  scene: Phaser.Scene,
  key: string,
  text: string,
  style: BannerStyle,
) {
  return addTexture(scene, key, bannerArt(text, style));
}

export const BANNER = {
  gold: { fill: ["#fff27a", "#ffd166", "#ff9f1c", "#e8590c"] },
  sky: { fill: ["#c8f4ff", "#4cc9f0", "#3a86ff", "#3a3fd1"] },
  mint: { fill: ["#e2fff4", "#7ee8c9", "#2fbf8f", "#1b8a6b"] },
  pink: { fill: ["#ffe0f0", "#f472b6", "#db2777", "#9d174d"] },
  violet: { fill: ["#efe6ff", "#c4b5fd", "#a78bfa", "#6d28d9"] },
} satisfies Record<string, BannerStyle>;

/**
 * Pops a banner in the middle of the screen: zooms in with a bounce, holds,
 * then floats away. With reduced motion it simply appears and fades.
 */
export function popBanner(
  scene: Phaser.Scene,
  key: string,
  x: number,
  y: number,
  options: { hold?: number; reduced?: boolean; depth?: number } = {},
) {
  const hold = options.hold ?? 900;
  const image = art(scene, x, y, key).setDepth(options.depth ?? 50);
  if (options.reduced) {
    image.setAlpha(0);
    scene.tweens.add({
      targets: image,
      alpha: 1,
      duration: 120,
      yoyo: true,
      hold,
      onComplete: () => image.destroy(),
    });
    return image;
  }
  image.setScale(0.2 * ART);
  scene.tweens.chain({
    targets: image,
    tweens: [
      { scale: ART, duration: 260, ease: "Back.easeOut" },
      { y: y - 3, duration: hold / 2, yoyo: true, ease: "Sine.easeInOut" },
      { alpha: 0, y: y - 24, duration: 220, ease: "Quad.easeIn" },
    ],
    onComplete: () => image.destroy(),
  });
  return image;
}

/** Scattered pixel stars (1 px, a few with a 4-point twinkle). */
export function starField(
  p: Pixels,
  count: number,
  maxY: number,
  rng: () => number,
) {
  for (let i = 0; i < count; i++) {
    const x = Math.floor(rng() * p.w);
    const y = Math.floor(rng() * maxY);
    const bright = rng();
    p.px(
      x,
      y,
      bright > 0.7 ? "#ffffff" : bright > 0.35 ? "#c7d2fe" : "#6d7bb8",
    );
    if (bright > 0.95) {
      p.px(x - 1, y, "#6d7bb8").px(x + 1, y, "#6d7bb8");
      p.px(x, y - 1, "#6d7bb8").px(x, y + 1, "#6d7bb8");
    }
  }
}

const ALIEN_COLORS = [
  ["#7ee8c9", "#2fbf8f"],
  ["#ffd166", "#e09f1f"],
  ["#ff9f5a", "#d9622b"],
  ["#a78bfa", "#6d28d9"],
  ["#4cc9f0", "#2272b8"],
  ["#f472b6", "#be185d"],
];

/**
 * One row of the alien crowd, `h` = 10 art px tall: round heads with eyes,
 * some with antennas, and arms that are up when `armsUp(i)` says so.
 */
export function crowdRow(
  width: number,
  offset: number,
  seed: () => number,
  armsUp: (i: number) => boolean,
): Pixels {
  const p = new Pixels(width, 10);
  let i = 0;
  for (let x = offset; x < width + 6; x += 7, i++) {
    const [skin, shade] =
      ALIEN_COLORS[Math.floor(seed() * ALIEN_COLORS.length)];
    const shirt = ["#3a3fd1", "#ff7a45", "#1b8a6b", "#9d174d", "#e8ecff"][
      Math.floor(seed() * 5)
    ];
    const antenna = seed() < 0.35;
    const lift = armsUp(i) ? 1 : 0;
    // Shoulders, head, eyes.
    p.rect(x - 3, 7 - lift, 7, 3 + lift, shirt);
    p.disc(x, 4 - lift, 2.6, skin);
    p.rect(x - 2, 6 - lift, 5, 1, shade);
    p.px(x - 1, 4 - lift, "#140c2c").px(x + 1, 4 - lift, "#140c2c");
    if (antenna) p.px(x, 0 - lift, skin).px(x, 1 - lift, shade);
    if (lift) {
      p.rect(x - 4, 2, 1, 5, skin).rect(x + 4, 2, 1, 5, skin);
    }
  }
  return p;
}

/** Square pixel particle (1×1 art px) for sparks, trails and confetti. */
export function addPixelParticle(
  scene: Phaser.Scene,
  key: string,
  w = 1,
  h = 1,
) {
  return addTexture(scene, key, new Pixels(w, h).rect(0, 0, w, h, "#ffffff"));
}

/** A star burst for goals and big hits: 4 frames, growing and fading. */
export function burstArt(frame: number): Pixels {
  const p = new Pixels(17, 17);
  const c = 8;
  const gold = "#ffd166";
  if (frame === 0) {
    p.rect(c - 1, c - 1, 3, 3, "#ffffff")
      .rect(c, c - 3, 1, 7, gold)
      .rect(c - 3, c, 7, 1, gold);
  } else if (frame === 1) {
    p.rect(c, c - 6, 1, 13, gold).rect(c - 6, c, 13, 1, gold);
    p.line(c - 4, c - 4, c + 4, c + 4, "#ffffff").line(
      c - 4,
      c + 4,
      c + 4,
      c - 4,
      "#ffffff",
    );
    p.rect(c - 1, c - 1, 3, 3, "#ffffff");
  } else {
    const r = frame === 2 ? 6 : 8;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const x = Math.round(c + Math.cos(a) * r);
      const y = Math.round(c + Math.sin(a) * r);
      p.px(x, y, i % 2 ? gold : "#ffffff");
      if (frame === 2)
        p.px(
          Math.round(c + Math.cos(a) * (r - 2)),
          Math.round(c + Math.sin(a) * (r - 2)),
          gold,
        );
    }
  }
  return p;
}

export function twinkleArt(): Pixels {
  const p = new Pixels(3, 3);
  return p
    .px(1, 0, "#c7d2fe")
    .rect(0, 1, 3, 1, "#c7d2fe")
    .px(1, 2, "#c7d2fe")
    .px(1, 1, "#ffffff");
}

/** A tiny comet that streaks across the sky now and then. */
export function cometArt(): Pixels {
  const p = new Pixels(14, 3);
  const tail = ["#2b3668", "#3d4a8a", "#6d7bb8", "#9aa6d8", "#c7d2fe"];
  tail.forEach((color, i) => p.rect(2 + i * 2, 1, 2, 1, color));
  p.rect(12, 0, 2, 3, "#ffffff").px(11, 1, "#e8ecff");
  return p;
}
