import { describe, expect, it } from "vitest";
import { COURIERS, getCourier } from "./couriers";
import { WORLDS, getWorld, worldOfTheDay } from "./worlds";

const HEX = /^#[0-9a-f]{6}$/i;

/** Every colour string anywhere in an object. */
function colours(value: unknown): string[] {
  if (typeof value === "string") return value.startsWith("#") ? [value] : [];
  if (Array.isArray(value)) return value.flatMap(colours);
  if (value && typeof value === "object")
    return Object.values(value).flatMap(colours);
  return [];
}

describe("worlds", () => {
  it("have unique ids and names", () => {
    expect(new Set(WORLDS.map((w) => w.id)).size).toBe(WORLDS.length);
    expect(new Set(WORLDS.map((w) => w.name)).size).toBe(WORLDS.length);
  });

  it("use valid colours", () => {
    for (const w of WORLDS)
      for (const c of colours(w)) expect(c, `${w.id}: ${c}`).toMatch(HEX);
  });

  it("fade things in before they spawn", () => {
    for (const w of WORLDS) {
      expect(w.fog.near).toBeLessThan(w.fog.far);
      expect(w.fog.far).toBeLessThanOrEqual(150);
    }
  });

  it("have music that stays inside its scale", () => {
    for (const w of WORLDS) {
      const m = w.music;
      expect(m.bpm).toBeGreaterThan(60);
      expect(m.melody.length).toBeGreaterThan(0);
      for (const step of [...m.melody, ...m.bassline]) {
        expect(step).toBeGreaterThanOrEqual(-1);
        expect(step).toBeLessThan(m.scale.length * 2);
      }
    }
  });

  it("rotate daily, and fall back to the first world", () => {
    const days = new Set(
      [0, 1, 2, 3].map((d) => worldOfTheDay(new Date(2026, 10, 1 + d)).id),
    );
    expect(days.size).toBe(Math.min(4, WORLDS.length));
    expect(getWorld("nope")).toBe(WORLDS[0]);
    expect(getWorld(WORLDS[1].id)).toBe(WORLDS[1]);
  });
});

describe("couriers", () => {
  it("are three, with unique ids and valid colours", () => {
    expect(COURIERS).toHaveLength(3);
    expect(new Set(COURIERS.map((c) => c.id)).size).toBe(3);
    for (const c of COURIERS)
      for (const col of colours(c.colors)) expect(col).toMatch(HEX);
    expect(getCourier(null)).toBe(COURIERS[0]);
  });
});
