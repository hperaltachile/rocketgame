import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  parseSettings,
  readBest,
  readJSON,
  readRaw,
  recordBest,
  SETTINGS_KEY,
  writeJSON,
  writeSettings,
} from "./storage";

afterEach(() => vi.unstubAllGlobals());

describe("when storage is blocked", () => {
  beforeEach(() => {
    const blocked = () => {
      throw new Error("blocked");
    };
    vi.stubGlobal("window", {
      localStorage: { getItem: blocked, setItem: blocked },
    });
  });

  it("reads fall back and writes don't throw", () => {
    expect(readJSON("x", 7)).toBe(7);
    expect(readBest("snake")).toBeNull();
    expect(() => writeJSON("x", 1)).not.toThrow();
    expect(recordBest("snake", 5, "high")).toBe(true);
  });
});

describe("with working storage", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => store.set(k, v),
      },
      dispatchEvent: vi.fn(),
    });
  });

  it("round-trips JSON values", () => {
    writeJSON("best", { score: 2048 });
    expect(readJSON("best", null)).toEqual({ score: 2048 });
  });

  it("ignores corrupt JSON", () => {
    window.localStorage.setItem("bad", "{nope");
    expect(readJSON("bad", "fallback")).toBe("fallback");
  });

  it("keeps the highest score when higher is better", () => {
    expect(recordBest("2048", 100, "high")).toBe(true);
    expect(recordBest("2048", 50, "high")).toBe(false);
    expect(recordBest("2048", 100, "high")).toBe(false);
    expect(recordBest("2048", 120, "high")).toBe(true);
    expect(readBest("2048")).toBe(120);
  });

  it("keeps the lowest value when lower is better", () => {
    expect(recordBest("minesweeper", 60, "low")).toBe(true);
    expect(recordBest("minesweeper", 75, "low")).toBe(false);
    expect(recordBest("minesweeper", 42, "low")).toBe(true);
    expect(readBest("minesweeper")).toBe(42);
  });

  it("merges settings patches over defaults", () => {
    expect(parseSettings(readRaw(SETTINGS_KEY))).toEqual({ sound: true });
    writeSettings({ sound: false });
    expect(parseSettings(readRaw(SETTINGS_KEY))).toEqual({ sound: false });
  });
});
