import { afterEach, describe, expect, it, vi } from "vitest";
import { readJSON, writeJSON } from "./storage";

describe("storage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns the fallback when storage throws", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => {
          throw new Error("blocked");
        },
        setItem: () => {
          throw new Error("blocked");
        },
      },
    });
    expect(readJSON("x", 7)).toBe(7);
    expect(() => writeJSON("x", 1)).not.toThrow();
  });

  it("round-trips JSON values", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => store.set(k, v),
      },
    });
    writeJSON("best", { score: 2048 });
    expect(readJSON("best", null)).toEqual({ score: 2048 });
  });
});
