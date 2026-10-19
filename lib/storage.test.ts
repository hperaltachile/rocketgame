import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  migrateRenamedGames,
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
    expect(parseSettings(readRaw(SETTINGS_KEY))).toEqual({
      sound: true,
      touchControls: true,
      vibration: true,
    });
    writeSettings({ sound: false });
    writeSettings({ vibration: false });
    expect(parseSettings(readRaw(SETTINGS_KEY))).toEqual({
      sound: false,
      touchControls: true,
      vibration: false,
    });
  });

  it("ignores settings of the wrong type", () => {
    expect(parseSettings('{"sound":"no","touchControls":0}')).toEqual({
      sound: true,
      touchControls: true,
      vibration: true,
    });
  });
});

describe("migrateRenamedGames", () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = new Map();
    vi.stubGlobal("window", {
      localStorage: {
        get length() {
          return store.size;
        },
        key: (i: number) => [...store.keys()][i] ?? null,
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => store.set(k, v),
        removeItem: (k: string) => store.delete(k),
      },
    });
  });

  it("moves the best score and game settings to the new slug", () => {
    store.set("rocketgame:best:old-game", "4");
    store.set("rocketgame:old-game:difficulty", '"hard"');
    store.set("rocketgame:best:snake", "9");
    migrateRenamedGames({ "old-game": "new-game" });
    expect(readBest("new-game")).toBe(4);
    expect(readRaw("rocketgame:new-game:difficulty")).toBe('"hard"');
    expect(readRaw("rocketgame:best:old-game")).toBeNull();
    expect(readBest("snake")).toBe(9);
  });

  it("never overwrites what the new slug already has", () => {
    store.set("rocketgame:best:old-game", "2");
    store.set("rocketgame:best:new-game", "5");
    migrateRenamedGames({ "old-game": "new-game" });
    expect(readBest("new-game")).toBe(5);
  });

  it("does nothing when storage is blocked", () => {
    vi.stubGlobal("window", {});
    expect(() => migrateRenamedGames({ a: "b" })).not.toThrow();
  });
});
