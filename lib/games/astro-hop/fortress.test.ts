import { describe, expect, it } from "vitest";
import { autoplay } from "./autopilot";
import { BLIP, BOSS, FLOW, KIT, POINTS, ROWS, TILE } from "./config";
import {
  BLIP_FLIGHT,
  BLIP_LOOP,
  blipBox,
  fireBarOrbs,
  type FireBar,
} from "./hazards";
import { LEVELS, type LevelDef } from "./levels";
import { newGame, NO_INPUT, step, type Game, type Input } from "./logic";

/**
 * A 40-wide fortress test level: floor on rows 13–14, then each mark is
 * written over it (`text` from `col` on `row`).
 */
function fortress(marks: [col: number, row: number, text: string][]): LevelDef {
  const rows = Array.from({ length: ROWS }, (_, r) =>
    (r >= 13 ? "#" : ".").repeat(40).split(""),
  );
  for (const [col, row, text] of marks) {
    text.split("").forEach((ch, i) => (rows[row][col + i] = ch));
  }
  return {
    id: "T-4",
    name: "TEST FORT",
    theme: "fortress",
    time: 300,
    rows: rows.map((r) => r.join("")),
  };
}

/** Big Clank on a bridge (cols 12–20), the switch at col 24. */
const BOSS_ROOM: [number, number, string][] = [
  [2, 12, "K"],
  [12, 13, "========="],
  [12, 14, "~~~~~~~~~"],
  [17, 12, "Z"],
  [24, 12, "S"],
];

function run(game: Game, seconds: number, pressed: Partial<Input> = {}) {
  const held = { ...NO_INPUT, ...pressed };
  for (let i = 0; i < Math.round(seconds * 60); i++) step(game, held);
}

/** A game on a test level (twice, so clearing it isn't a win), past the intro. */
function play(level: LevelDef): Game {
  const game = newGame(0, [level, level]);
  run(game, FLOW.intro + 0.35);
  expect(game.phase).toBe("play");
  game.events.length = 0;
  return game;
}

function makeBig(game: Game) {
  const p = game.player;
  const feet = p.y + p.h;
  p.size = "big";
  p.w = KIT.big.w;
  p.h = KIT.big.h;
  p.y = feet - p.h;
}

/** Puts Kit at the left of the screen, flashing (safe from bolts) for a while. */
function stepAway(game: Game) {
  const p = game.player;
  p.x = game.camX;
  p.y = 13 * TILE - p.h;
  p.vy = 0;
  p.invulnerable = KIT.invulnerable;
}

/** Plays until Kit loses a life (or the time is up); true if he did. */
function losesLife(game: Game, seconds: number) {
  for (let i = 0; i < seconds * 60; i++) {
    step(game, NO_INPUT);
    if (game.phase === "dying") return true;
  }
  return false;
}

/** Drops Kit onto Big Clank's head. */
function stompBoss(game: Game) {
  const boss = game.boss!;
  const p = game.player;
  p.x = boss.x + boss.w / 2 - p.w / 2;
  p.y = boss.y - p.h + 1;
  p.vy = 120;
  step(game, NO_INPUT);
}

describe("lava", () => {
  it("costs a life, even for Big Kit", () => {
    const game = play(
      fortress([
        [2, 12, "K"],
        [8, 13, "~~"],
        [8, 14, "~~"],
      ]),
    );
    makeBig(game);
    run(game, 2, { right: true });
    expect(game.phase).toBe("dying");
    expect(game.events.some((e) => e.type === "lava")).toBe(true);
  });
});

describe("fire bars", () => {
  const bar = (dir: 1 | -1): FireBar => ({
    col: 10,
    row: 10,
    dir,
    period: 4,
    start: -Math.PI / 2,
  });
  const tip = (b: FireBar, clock: number) => fireBarOrbs(b, clock).at(-1)!;
  const cx = 10 * TILE + TILE / 2;
  const cy = 10 * TILE + TILE / 2;

  it("turn clockwise or counter-clockwise from their start", () => {
    expect(tip(bar(1), 0).y).toBeLessThan(cy - 20); // pointing up
    expect(tip(bar(1), 1).x).toBeGreaterThan(cx + 20); // a quarter turn: right
    expect(tip(bar(-1), 1).x).toBeLessThan(cx - 20); // the other way: left
    expect(tip(bar(1), 2).y).toBeGreaterThan(cy + 20); // half a turn: down
  });

  it("hurt Kit when the orbs sweep past, and leave him alone out of reach", () => {
    const near = play(
      fortress([
        [2, 12, "K"],
        [4, 11, "*"],
      ]),
    );
    expect(losesLife(near, 6)).toBe(true);

    const far = play(
      fortress([
        [2, 12, "K"],
        [12, 10, "*"],
      ]),
    );
    expect(losesLife(far, 6)).toBe(false);
  });
});

describe("lava blips", () => {
  const blip = { col: 5, surface: 13 * TILE, offset: 0 };

  it("hop out of the lava, fall back in, then wait", () => {
    const top = blipBox(blip, BLIP_FLIGHT / 2)!;
    const low = blipBox(blip, BLIP_FLIGHT * 0.1)!;
    // Highest halfway through the hop.
    expect(top.y).toBeLessThan(low.y);
    expect(13 * TILE - top.y).toBeCloseTo(
      (BLIP.jump * BLIP.jump) / (2 * BLIP.gravity) - 4,
      0,
    );
    expect(blipBox(blip, BLIP_FLIGHT + 0.1)).toBeNull();
    // ...and it loops.
    expect(blipBox(blip, BLIP_LOOP + BLIP_FLIGHT / 2)!.y).toBeCloseTo(top.y);
  });

  it("hurt Kit when they hit him", () => {
    const game = play(
      fortress([
        [2, 12, "K"],
        [6, 13, "~^~"],
        [6, 14, "~~~"],
      ]),
    );
    // Stand right over the lava's edge, where the blip comes up.
    game.player.x = 6 * TILE - game.player.w + 6;
    game.blips[0].col = 5;
    run(game, BLIP_LOOP + 0.2);
    expect(game.phase).toBe("dying");
  });
});

describe("Big Clank", () => {
  it("wakes up on screen and paces its bridge, facing Kit", () => {
    const game = play(fortress(BOSS_ROOM));
    const boss = game.boss!;
    expect(boss.state).toBe("pace");
    expect(boss.facing).toBe(-1);
    const xs = new Set<number>();
    for (let i = 0; i < 240; i++) {
      step(game, NO_INPUT);
      xs.add(Math.round(boss.x));
      expect(boss.x).toBeGreaterThanOrEqual(boss.minX);
      expect(boss.x).toBeLessThanOrEqual(boss.maxX);
    }
    expect(xs.size).toBeGreaterThan(20);
  });

  it("takes three stomps, flashing harmlessly in between", () => {
    const game = play(fortress(BOSS_ROOM));
    const boss = game.boss!;
    const score = game.score;
    stompBoss(game);
    expect(boss.hp).toBe(BOSS.hp - BOSS.stomp);
    expect(boss.hurt).toBeGreaterThan(0);
    // A second stomp while it flashes doesn't count, and touching it doesn't hurt.
    stompBoss(game);
    expect(boss.hp).toBe(BOSS.hp - BOSS.stomp);
    game.player.x = boss.x - 4;
    game.player.y = boss.floor - game.player.h;
    game.player.vy = 0;
    step(game, NO_INPUT);
    expect(game.phase).toBe("play");

    for (let i = 0; i < 2; i++) {
      stepAway(game);
      run(game, BOSS.hurt + 0.1);
      stompBoss(game);
    }
    expect(boss.state).toBe("down");
    expect(game.events.some((e) => e.type === "bossDown")).toBe(true);
    expect(game.score - score).toBe(POINTS.bossHit * 2 + POINTS.boss);
    // Powered down, it floats away and can't hurt anyone.
    const y = boss.y;
    run(game, 2);
    expect(boss.y).toBeLessThan(y - 20);
    expect(game.phase).toBe("play");
  });

  it("takes five sparks", () => {
    const game = play(fortress(BOSS_ROOM));
    const boss = game.boss!;
    const spark = () => {
      game.sparks.push({
        id: game.nextId++,
        x: boss.x - 4,
        y: boss.y + 10,
        w: 6,
        h: 6,
        vx: 0,
        vy: 0,
        onGround: false,
        dir: 1,
      });
      step(game, NO_INPUT);
      game.bolts = [];
      run(game, 0.4);
      game.bolts = [];
    };
    for (let i = 0; i < 4; i++) spark();
    expect(boss.state).toBe("pace");
    spark();
    expect(boss.state).toBe("down");
  });

  it("tosses bolts that hurt Kit", () => {
    const game = play(fortress(BOSS_ROOM));
    game.player.x = 9 * TILE;
    run(game, 2.5);
    expect(game.events.some((e) => e.type === "bolt")).toBe(true);
    const bolt = game.bolts[0];
    game.player.x = bolt.x;
    game.player.y = bolt.y;
    step(game, NO_INPUT);
    expect(game.phase).toBe("dying");
  });

  it("is fresh again after Kit loses a life", () => {
    const game = play(fortress(BOSS_ROOM));
    stompBoss(game);
    expect(game.boss!.hp).toBeLessThan(BOSS.hp);
    game.time = 1;
    run(game, 1);
    run(game, FLOW.dying + 0.1);
    expect(game.boss!.hp).toBe(BOSS.hp);
    expect(game.boss!.state).toBe("sleep");
  });
});

describe("the power switch", () => {
  it("powers Big Clank down, ends the level and starts the next", () => {
    const game = play(fortress(BOSS_ROOM));
    const score = game.score;
    // Hop over Big Clank onto the far side, then walk to the switch.
    game.player.x = 22 * TILE;
    run(game, 1, { right: true });
    expect(game.phase).toBe("goal");
    expect(game.goal.switched).toBe(true);
    expect(game.boss!.state).toBe("down");
    expect(game.score - score).toBe(POINTS.switch);
    run(game, 20);
    expect(game.levelIndex).toBe(1);
    // The leftover time became points.
    expect(game.score).toBeGreaterThan(score + POINTS.switch);
  });

  it("finishing the last fortress wins the game", () => {
    const game = newGame(LEVELS.length - 1);
    expect(game.level.theme).toBe("fortress");
    game.lives = 99;
    expect(autoplay(game).cleared).toBe(true);
    run(game, 20);
    expect(game.phase).toBe("won");
  });
});
