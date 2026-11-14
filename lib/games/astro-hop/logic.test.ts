import { describe, expect, it } from "vitest";
import { FLOW, KIT, PHYS, POINTS, ROWS, TILE, TIMER } from "./config";
import { LEVELS, type LevelDef } from "./levels";
import {
  chainPoints,
  newGame,
  NO_INPUT,
  parseUnlocked,
  polePoints,
  step,
  type Game,
  type Input,
} from "./logic";

/** A 40-wide test level: ground on rows 13–14, plus `marks` placed on top. */
function testLevel(
  marks: [col: number, row: number, text: string][],
  width = 40,
): LevelDef {
  const rows = Array.from({ length: ROWS }, (_, r) =>
    (r >= 13 ? "#" : ".").repeat(width).split(""),
  );
  for (const [col, row, text] of marks) {
    text.split("").forEach((ch, i) => (rows[row][col + i] = ch));
  }
  return {
    id: "T-1",
    name: "TEST",
    theme: "plains",
    time: 300,
    rows: rows.map((r) => r.join("")),
  };
}

const input = (patch: Partial<Input> = {}): Input => ({
  ...NO_INPUT,
  ...patch,
});

function run(game: Game, seconds: number, pressed: Partial<Input> = {}) {
  const held = input(pressed);
  for (let i = 0; i < Math.round(seconds * 60); i++) step(game, held);
}

/** A game on one test level (twice, so clearing it isn't a win), past the intro. */
function play(level: LevelDef, levels: LevelDef[] = [level, level]): Game {
  const game = newGame(0, levels);
  run(game, FLOW.intro + 0.05);
  expect(game.phase).toBe("play");
  run(game, 0.3); // land
  game.events.length = 0;
  return game;
}

const feet = (game: Game) => game.player.y + game.player.h;

describe("moving and jumping", () => {
  it("stands on the ground", () => {
    const game = play(testLevel([[2, 12, "K"]]));
    expect(game.player.onGround).toBe(true);
    expect(feet(game)).toBe(13 * TILE);
  });

  it("walks at walking speed and runs faster with Run held", () => {
    const game = play(testLevel([[2, 12, "K"]], 80));
    run(game, 1, { right: true });
    expect(game.player.vx).toBeCloseTo(PHYS.walk);
    run(game, 1, { right: true, run: true });
    expect(game.player.vx).toBeCloseTo(PHYS.run);
  });

  it("stops at walls", () => {
    const game = play(
      testLevel([
        [2, 12, "K"],
        [8, 12, "X"],
        [8, 11, "X"],
      ]),
    );
    run(game, 2, { right: true });
    expect(game.player.x + game.player.w).toBe(8 * TILE);
  });

  it("jumps higher when Jump is held", () => {
    const high = play(testLevel([[2, 12, "K"]]));
    let top = feet(high);
    for (let i = 0; i < 60; i++) {
      step(high, input({ jump: true }));
      top = Math.min(top, feet(high));
    }
    const rise = (13 * TILE - top) / TILE;
    expect(rise).toBeGreaterThan(3.5);
    expect(rise).toBeLessThan(4.6);

    const low = play(testLevel([[2, 12, "K"]]));
    let lowTop = feet(low);
    step(low, input({ jump: true }));
    for (let i = 0; i < 60; i++) {
      step(low, NO_INPUT);
      lowTop = Math.min(lowTop, feet(low));
    }
    expect((13 * TILE - lowTop) / TILE).toBeLessThan(2);
  });

  it("can jump a three-tile gap without running", () => {
    const level = testLevel([[2, 12, "K"]]);
    level.rows = level.rows.map((row, r) =>
      r >= 13 ? row.slice(0, 10) + "..." + row.slice(13) : row,
    );
    const game = play(level);
    // Walk to the edge, jump just before it.
    while (game.player.x + game.player.w < 10 * TILE - 2) {
      step(game, input({ right: true }));
    }
    run(game, 1.2, { right: true, jump: true });
    expect(game.phase).toBe("play");
    expect(game.player.onGround).toBe(true);
    expect(game.player.x).toBeGreaterThan(13 * TILE);
  });

  it("jumps up through bridges and stands on them", () => {
    const game = play(
      testLevel([
        [2, 12, "K"],
        [1, 10, "_____"],
      ]),
    );
    run(game, 0.8, { jump: true });
    run(game, 0.5);
    expect(game.player.onGround).toBe(true);
    expect(feet(game)).toBe(10 * TILE);
  });

  it("rides moving platforms", () => {
    const game = play(
      testLevel([
        [2, 12, "K"],
        [3, 13, "HHH"],
      ]),
    );
    // Put Kit on the platform and let it carry him.
    game.player.x = 4 * TILE;
    game.player.y = 13 * TILE - game.player.h - 4;
    expect(game.movers).toHaveLength(1);
    expect(game.movers[0].w).toBe(3 * TILE);
    run(game, 0.2);
    expect(game.player.riding).not.toBeNull();
    const x0 = game.player.x;
    run(game, 1.5);
    expect(game.player.x).toBeGreaterThan(x0 + TILE);
  });
});

describe("blocks and items", () => {
  it("star blocks give a coin and turn used", () => {
    const game = play(
      testLevel([
        [2, 12, "K"],
        [2, 9, "?"],
      ]),
    );
    run(game, 0.6, { jump: true });
    expect(game.grid[9][2]).toBe("U");
    expect(game.coins).toBe(1);
    expect(game.score).toBe(POINTS.coin);
    expect(game.events.some((e) => e.type === "bump")).toBe(true);
  });

  it("a Star Seed makes Kit big, and a Comet Berry gives sparks", () => {
    const game = play(
      testLevel([
        [2, 12, "K"],
        [2, 9, "M"],
      ]),
    );
    run(game, 0.6, { jump: true });
    expect(game.items[0]?.kind).toBe("seed");
    // The seed rises out, slides right and drops; follow it.
    run(game, 1);
    run(game, 3, { right: true });
    expect(game.player.size).toBe("big");
    expect(game.player.h).toBe(KIT.big.h);
    expect(game.score).toBe(POINTS.powerUp);

    const berry = play(
      testLevel([
        [2, 12, "K"],
        [2, 8, "M"],
      ]),
    );
    berry.player.size = "big";
    berry.player.h = KIT.big.h;
    berry.player.w = KIT.big.w;
    berry.player.y = 13 * TILE - KIT.big.h;
    run(berry, 0.6, { jump: true });
    expect(berry.items[0]?.kind).toBe("berry");
    run(berry, 0.8);
    // The berry waits on top of its block: hop up to it.
    berry.player.x = berry.items[0].x;
    berry.player.y = berry.items[0].y - 4;
    run(berry, 0.1);
    expect(berry.player.size).toBe("fire");
    run(berry, 0.7);
    step(berry, input({ run: true }));
    expect(berry.sparks).toHaveLength(1);
  });

  it("Big Kit breaks bricks; small Kit only bumps them", () => {
    const small = play(
      testLevel([
        [2, 12, "K"],
        [2, 9, "B"],
      ]),
    );
    run(small, 0.6, { jump: true });
    expect(small.grid[9][2]).toBe("B");

    const big = play(
      testLevel([
        [2, 12, "K"],
        [2, 8, "B"],
      ]),
    );
    big.player.size = "big";
    big.player.h = KIT.big.h;
    big.player.y = 13 * TILE - KIT.big.h;
    run(big, 0.6, { jump: true });
    expect(big.grid[8][2]).toBe(".");
    expect(big.score).toBe(POINTS.brick);
  });

  it("hidden blocks only appear when bumped from below", () => {
    const game = play(
      testLevel([
        [2, 12, "K"],
        [2, 9, "L"],
      ]),
    );
    run(game, 0.6, { jump: true });
    expect(game.grid[9][2]).toBe("U");
    expect(game.items[0]?.kind).toBe("life");

    // Walking through one at its own height doesn't stop Kit.
    const walk = play(
      testLevel([
        [2, 12, "K"],
        [6, 12, "L"],
      ]),
    );
    run(walk, 1.5, { right: true });
    expect(walk.player.x).toBeGreaterThan(7 * TILE);
  });

  it("100 coins give an extra life", () => {
    const coins = "C".repeat(30);
    const game = play(
      testLevel(
        [
          [2, 12, "K"],
          [4, 12, coins],
        ],
        60,
      ),
    );
    game.coins = 90;
    run(game, 6, { right: true });
    expect(game.lives).toBe(KIT.lives + 1);
    expect(game.coins).toBe(20);
  });
});

describe("enemies", () => {
  it("stomping a Grumble squashes it and bounces Kit", () => {
    const game = play(
      testLevel([
        [2, 12, "K"],
        [9, 12, "g"],
      ]),
    );
    const e = game.enemies[0];
    game.player.x = e.x;
    game.player.y = e.y - game.player.h - 2;
    game.player.vy = 100;
    step(game, NO_INPUT);
    expect(e.state).toBe("squashed");
    expect(game.player.vy).toBeLessThan(0);
    expect(game.score).toBe(POINTS.chain[0]);
  });

  it("touching an enemy from the side costs small Kit a life", () => {
    const game = play(
      testLevel([
        [2, 12, "K"],
        [6, 12, "g"],
      ]),
    );
    run(game, 2, { right: true });
    expect(game.phase).toBe("dying");
    run(game, FLOW.dying);
    expect(game.lives).toBe(KIT.lives - 1);
    expect(game.phase).toBe("intro");
  });

  it("a hit makes Big Kit small and flashing instead", () => {
    const game = play(
      testLevel([
        [2, 12, "K"],
        [6, 12, "g"],
      ]),
    );
    game.player.size = "big";
    game.player.h = KIT.big.h;
    game.player.y = 13 * TILE - KIT.big.h;
    run(game, 2, { right: true });
    expect(game.phase).toBe("play");
    expect(game.player.size).toBe("small");
    expect(game.player.invulnerable).toBeGreaterThan(0);
  });

  it("Shellbots become shells that can be kicked into other enemies", () => {
    const game = play(
      testLevel([
        [2, 12, "K"],
        [5, 12, "k"],
        [14, 12, "g"],
      ]),
    );
    const shellbot = game.enemies[0];
    const grumble = game.enemies[1];
    game.player.x = shellbot.x;
    game.player.y = shellbot.y - game.player.h - 2;
    game.player.vy = 100;
    step(game, NO_INPUT);
    expect(shellbot.state).toBe("shell");
    // Land beside it and walk into it: a kick.
    run(game, 0.8, { left: true });
    run(game, 1, { right: true });
    expect(shellbot.state).toBe("spin");
    run(game, 2);
    expect(grumble.state).toBe("flipped");
  });

  it("stomp chains score 100, 200, 400… then an extra life", () => {
    expect([0, 1, 2, 3].map(chainPoints)).toEqual([100, 200, 400, 800]);
    expect(chainPoints(POINTS.chain.length)).toBe("1UP");
  });
});

describe("level flow", () => {
  it("falling in a pit costs a life", () => {
    const level = testLevel([[2, 12, "K"]]);
    level.rows = level.rows.map((row, r) =>
      r >= 13 ? row.slice(0, 6) + "....." + row.slice(11) : row,
    );
    const game = play(level);
    run(game, 2, { right: true });
    expect(game.phase).toBe("dying");
  });

  it("running out of time costs a life", () => {
    const game = play(testLevel([[2, 12, "K"]]));
    run(game, game.time * TIMER.unit + 0.1);
    expect(game.phase).toBe("dying");
  });

  it("losing every life ends the game", () => {
    const game = play(
      testLevel([
        [2, 12, "K"],
        [6, 12, "g"],
      ]),
    );
    game.lives = 1;
    run(game, 2, { right: true });
    run(game, FLOW.dying + 0.1);
    expect(game.phase).toBe("over");
  });

  it("respawns at the checkpoint after passing it", () => {
    const game = play(
      testLevel([
        [2, 12, "K"],
        [10, 12, "c"],
        [20, 12, "g"],
      ]),
    );
    run(game, 4, { right: true });
    expect(game.reachedCheckpoint).toBe(true);
    run(game, FLOW.dying + 0.1);
    expect(game.player.x).toBeGreaterThan(9 * TILE);
  });

  it("the beacon pole pays more the higher Kit touches it", () => {
    const game = play(
      testLevel([
        [2, 12, "K"],
        [20, 12, "F"],
      ]),
    );
    const g = game.goal;
    expect(polePoints(g, g.poleTop)).toBe(5000);
    expect(polePoints(g, g.poleBottom)).toBe(100);
  });

  it("reaching the beacon clears the level, and the last level wins", () => {
    const level = testLevel(
      [
        [2, 12, "K"],
        [12, 12, "F"],
      ],
      40,
    );
    const game = play(level);
    run(game, 3, { right: true });
    expect(game.phase).toBe("goal");
    const scoreAtPole = game.score;
    run(game, 12);
    expect(game.levelIndex).toBe(1);
    expect(game.score).toBeGreaterThan(scoreAtPole); // time bonus
    run(game, FLOW.intro + 0.4);
    run(game, 3, { right: true });
    run(game, 12);
    expect(game.phase).toBe("won");
  });
});

describe("saved progress", () => {
  it("reads the furthest level reached, repairing odd values", () => {
    expect(parseUnlocked(null)).toBe(0);
    expect(parseUnlocked("2")).toBe(2);
    expect(parseUnlocked("99")).toBe(LEVELS.length - 1);
    expect(parseUnlocked("-3")).toBe(0);
    expect(parseUnlocked("1.5")).toBe(0);
    expect(parseUnlocked("{oops")).toBe(0);
  });
});
