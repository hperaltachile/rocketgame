import { describe, expect, it } from "vitest";
import { directionFromVector, KEY_DIRECTIONS } from "./input";

describe("directionFromVector", () => {
  it("picks the dominant axis", () => {
    expect(directionFromVector(30, 5)).toBe("right");
    expect(directionFromVector(-30, 10)).toBe("left");
    expect(directionFromVector(4, -40)).toBe("up");
    expect(directionFromVector(-8, 25)).toBe("down");
  });

  it("returns null inside the dead zone", () => {
    expect(directionFromVector(3, 4, 5)).toBeNull();
    expect(directionFromVector(3, 5, 5)).toBe("down");
    expect(directionFromVector(0, 0)).toBeNull();
  });
});

describe("KEY_DIRECTIONS", () => {
  it("maps arrows and WASD in both cases", () => {
    expect(KEY_DIRECTIONS.ArrowLeft).toBe("left");
    expect(KEY_DIRECTIONS.w).toBe("up");
    expect(KEY_DIRECTIONS.D).toBe("right");
    expect(KEY_DIRECTIONS.x).toBeUndefined();
  });
});
