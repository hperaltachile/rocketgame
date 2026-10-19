import { describe, expect, it } from "vitest";
import { GLYPH_H, GLYPH_W, hasGlyph, textPixels, textWidth } from "./pixelFont";

describe("pixel font", () => {
  it("has every character the games show", () => {
    const used =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 !?.:/-+'" + "goal! so close";
    for (const ch of used) expect(hasGlyph(ch), ch).toBe(true);
  });

  it("measures text with one pixel between letters", () => {
    expect(textWidth("")).toBe(0);
    expect(textWidth("A")).toBe(GLYPH_W);
    expect(textWidth("GOAL!")).toBe(5 * GLYPH_W + 4);
  });

  it("keeps every pixel inside the measured box", () => {
    const text = "HOME RUN! 0123456789";
    const pixels = textPixels(text);
    expect(pixels.length).toBeGreaterThan(100);
    for (const { x, y } of pixels) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(textWidth(text));
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThan(GLYPH_H);
    }
  });

  it("draws lowercase as uppercase and spaces as nothing", () => {
    expect(textPixels("goal")).toEqual(textPixels("GOAL"));
    expect(textPixels("   ")).toEqual([]);
  });
});
