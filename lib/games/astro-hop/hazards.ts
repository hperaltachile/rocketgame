/**
 * Fortress hazards: fire bars and lava blips. Both move on a fixed loop
 * driven only by the level clock, so where they'll be is easy to test and
 * to predict (the autopilot looks ahead the same way a kid learns the
 * rhythm). Pure functions, no game state.
 */

import { BLIP, FIREBAR, TILE } from "./config";

export type Box = { x: number; y: number; w: number; h: number };

export type FireBar = {
  col: number;
  row: number;
  /** 1 turns clockwise on screen, -1 counter-clockwise. */
  dir: 1 | -1;
  /** Seconds per turn. */
  period: number;
  /** Angle at clock 0, in radians (0 points right, π/2 down). */
  start: number;
};

export type Blip = {
  /** Column, and the lava surface it jumps out of (art pixels). */
  col: number;
  surface: number;
  /** Seconds into its loop at clock 0, so neighbours don't hop together. */
  offset: number;
};

/** The angle of a fire bar at a moment. */
export function fireBarAngle(bar: FireBar, clock: number): number {
  return bar.start + bar.dir * ((clock / bar.period) * Math.PI * 2);
}

/** Hit boxes of a fire bar's orbs (the one in the block's centre included). */
export function fireBarOrbs(bar: FireBar, clock: number): Box[] {
  const a = fireBarAngle(bar, clock);
  const cx = bar.col * TILE + TILE / 2;
  const cy = bar.row * TILE + TILE / 2;
  const s = FIREBAR.size;
  return Array.from({ length: FIREBAR.orbs }, (_, i) => ({
    x: cx + Math.cos(a) * i * FIREBAR.spacing - s / 2,
    y: cy + Math.sin(a) * i * FIREBAR.spacing - s / 2,
    w: s,
    h: s,
  }));
}

/** How long one blip hop lasts, and the whole loop. */
export const BLIP_FLIGHT = (2 * BLIP.jump) / BLIP.gravity;
export const BLIP_LOOP = BLIP_FLIGHT + BLIP.wait;

/** A blip's hit box, or null while it's down in the lava. */
export function blipBox(blip: Blip, clock: number): Box | null {
  const t = (((clock + blip.offset) % BLIP_LOOP) + BLIP_LOOP) % BLIP_LOOP;
  if (t >= BLIP_FLIGHT) return null;
  const rise = BLIP.jump * t - (BLIP.gravity * t * t) / 2;
  const s = BLIP.size;
  // It starts a little under the surface, so it pops out of the lava.
  const y = blip.surface + 4 - rise;
  return { x: blip.col * TILE + (TILE - s) / 2, y, w: s, h: s };
}

/** Whether a blip is on its way up (for the art: it faces up, then down). */
export function blipRising(blip: Blip, clock: number): boolean {
  const t = (((clock + blip.offset) % BLIP_LOOP) + BLIP_LOOP) % BLIP_LOOP;
  return t < BLIP_FLIGHT / 2;
}
