/** Shared input helpers for keyboard, swipe and on-screen controls. */

export type Direction = "up" | "down" | "left" | "right";

export const KEY_DIRECTIONS: Readonly<Record<string, Direction>> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
  W: "up",
  S: "down",
  A: "left",
  D: "right",
};

/**
 * Direction of a finger offset (dx, dy) from a pad's centre, or null inside
 * the dead zone. Screen coordinates: positive dy points down.
 */
export function directionFromVector(
  dx: number,
  dy: number,
  deadZone = 0,
): Direction | null {
  if (Math.hypot(dx, dy) <= deadZone) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}
