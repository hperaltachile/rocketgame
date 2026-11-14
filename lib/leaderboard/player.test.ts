import { describe, expect, it } from "vitest";
import { isValidName } from "./names";
import { parsePlayer } from "./player";

const ID = "3f2b8c1e-9d4a-4b6f-8e2a-1c5d7f9b0a12";

describe("parsePlayer", () => {
  it("reads a good save", () => {
    const raw = JSON.stringify({
      id: ID,
      name: "Cosmic Fox 42",
      saved: { snake: 30 },
    });
    expect(parsePlayer(raw)).toEqual({
      id: ID,
      name: "Cosmic Fox 42",
      saved: { snake: 30 },
    });
  });

  it("gives up without a valid id", () => {
    for (const raw of [null, "", "{", "null", "42", '{"id":"abc"}']) {
      expect(parsePlayer(raw)).toBeNull();
    }
  });

  it("repairs a bad name and bad saved scores", () => {
    const player = parsePlayer(
      JSON.stringify({
        id: ID,
        name: "Typed Name",
        saved: { snake: "lots", "2048": 512, memory: null },
      }),
    )!;
    expect(isValidName(player.name)).toBe(true);
    expect(player.saved).toEqual({ "2048": 512 });
  });
});
