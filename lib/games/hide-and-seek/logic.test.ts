import { describe, expect, it } from "vitest";
import { seeded } from "../rng";
import { playBot } from "./autopilot";
import { PLAYER, ROUND, seekerTuning, STEP, TILE } from "./config";
import { HOUSES } from "./houses";
import {
  exitRisk,
  nearSpot,
  newGame,
  nextRound,
  NO_INPUT,
  resetRound,
  roomWaypoint,
  spotById,
  spotStatus,
  step,
  type Game,
  type GameEvent,
  type Input,
} from "./logic";
import { centerOf, findPath, isSolid, tileOf, type Tile } from "./nav";
import { SEEKER } from "./config";

const run = (game: Game, seconds: number, input: Input = NO_INPUT) => {
  const events: GameEvent[] = [];
  for (let i = 0; i < Math.round(seconds / STEP); i++) {
    step(game, input);
    events.push(...game.events);
    game.events.length = 0;
  }
  return events;
};

/** Puts the player on a tile, standing still. */
const place = (game: Game, tile: Tile) => {
  const c = centerOf(tile);
  game.player.x = c.x;
  game.player.y = c.y;
};

const skipCountdown = (game: Game) => run(game, ROUND.headStart + STEP);

/** Stands the player two tiles in front of Peeka, who stops to look. */
const inFrontOfPeeka = (game: Game) => {
  const s = game.seeker;
  place(game, [Math.floor(s.x / TILE) + 2, Math.floor(s.y / TILE)]);
  lookAtPlayer(game);
};

/** Peeka stops and stares at the player (as if it just heard something). */
const lookAtPlayer = (game: Game) => {
  const s = game.seeker;
  const p = game.player;
  s.path = [];
  s.angle = Math.atan2(p.y - s.y, p.x - s.x);
  s.mode = "suspicious";
  s.wait = 3;
  s.clue = { kind: "sound", x: p.x, y: p.y, at: game.clock };
};

describe("movement", () => {
  it("walks diagonally no faster than straight", () => {
    const a = newGame(seeded(1));
    const b = newGame(seeded(1));
    const start = centerOf(HOUSES[0].playerStart);
    run(a, 0.5, { x: 1, y: 0, run: false });
    run(b, 0.5, { x: 1, y: -1, run: false });
    const straight = a.player.x - start.x;
    const diag = Math.hypot(b.player.x - start.x, b.player.y - start.y);
    expect(straight).toBeCloseTo(PLAYER.walk * 0.5, 0);
    expect(diag).toBeLessThanOrEqual(straight + 0.5);
  });

  it("never ends up inside a wall or furniture (random wandering)", () => {
    const rng = seeded(7);
    const game = newGame(seeded(2));
    let input: Input = NO_INPUT;
    for (let i = 0; i < 60 * 60; i++) {
      if (i % 20 === 0)
        input = { x: rng() * 2 - 1, y: rng() * 2 - 1, run: rng() < 0.3 };
      if (game.phase !== "countdown") {
        // Keep wandering in the countdown, so Peeka never interferes.
        const { x, y } = game.player;
        resetRound(game);
        game.player.x = x;
        game.player.y = y;
      }
      step(game, input);
      game.events.length = 0;
      const p = game.player;
      const r = PLAYER.radius - 0.01;
      for (const [x, y] of [
        [p.x - r, p.y - r],
        [p.x + r, p.y - r],
        [p.x - r, p.y + r],
        [p.x + r, p.y + r],
      ]) {
        expect(isSolid(game.grid, ...tileOf(x, y))).toBe(false);
      }
    }
  });

  it("bumps into furniture, and running into it makes a noise", () => {
    const game = newGame(seeded(3));
    place(game, [5, 17]); // just above the sofa (row 18)
    const events = run(game, 0.5, { x: 0, y: 1, run: true });
    expect(events.some((e) => e.type === "bump")).toBe(true);
    expect(events.some((e) => e.type === "noise" && e.kind === "bump")).toBe(
      true,
    );
  });
});

describe("hiding", () => {
  it("hides in a nearby spot and comes back out at its approach tile", () => {
    const game = newGame(seeded(4));
    const spot = spotById(game, "sofa");
    place(game, spot.approach);
    expect(nearSpot(game)).toBe("sofa");
    step(game, NO_INPUT, true);
    run(game, PLAYER.transition + 0.05);
    expect(game.player.hidden).toBe("sofa");
    // Hidden: movement does nothing.
    const { x, y } = game.player;
    run(game, 0.3, { x: 1, y: 0, run: false });
    expect([game.player.x, game.player.y]).toEqual([x, y]);
    step(game, NO_INPUT, true);
    run(game, PLAYER.transition + 0.05);
    expect(game.player.hidden).toBeNull();
    const a = centerOf(spot.approach);
    expect([game.player.x, game.player.y]).toEqual([a.x, a.y]);
    expect(game.hideCounts.sofa).toBe(1);
  });

  it("doesn't offer a spot that's out of reach", () => {
    const game = newGame(seeded(5));
    expect(nearSpot(game)).toBeNull();
  });

  it("can't enter the spot Peeka is opening", () => {
    const game = newGame(seeded(6));
    skipCountdown(game);
    game.seeker.inspecting = { spot: "desk", t: 0 };
    expect(spotStatus(game, "desk")).toBe("busy");
    place(game, [27, 2]);
    expect(nearSpot(game)).toBe("desk");
    step(game, NO_INPUT, true);
    expect(game.player.trans).toBeNull();
  });

  it("warns that leaving is risky when Peeka is close", () => {
    const game = newGame(seeded(8));
    skipCountdown(game);
    game.player.hidden = "sofa";
    const a = centerOf(spotById(game, "sofa").approach);
    game.seeker.x = a.x + 2 * TILE;
    game.seeker.y = a.y;
    expect(exitRisk(game)).toBe(true);
    const far = centerOf([30, 2]);
    game.seeker.x = far.x;
    game.seeker.y = far.y;
    expect(exitRisk(game)).toBe(false);
  });
});

describe("Peeka plays fair", () => {
  it("never finds a hidden player except by opening their spot", () => {
    for (let seed = 1; seed <= 25; seed++) {
      const game = newGame(seeded(seed));
      const ids = game.grid.spots.map((s) => s.id);
      const id = ids[seed % ids.length];
      place(game, spotById(game, id).approach);
      step(game, NO_INPUT, true);
      run(game, ROUND.headStart + ROUND.duration + 1);
      if (game.caught) {
        expect(game.caught.kind).toBe("checked");
        if (game.caught.kind === "checked") expect(game.caught.spot).toBe(id);
      } else {
        expect(game.roundsWon).toBe(1);
      }
    }
  });

  it.each(HOUSES.map((h, i) => [h.name, i] as const))(
    "never walks through walls or furniture, even cutting corners (%s)",
    (_name, house) => {
      for (const seed of [11, 21, 31]) {
        const game = newGame(seeded(seed), house);
        place(
          game,
          spotById(game, game.grid.spots[seed % game.grid.spots.length].id)
            .approach,
        );
        step(game, NO_INPUT, true);
        const r = SEEKER.radius - 0.01;
        for (let i = 0; i < (ROUND.headStart + ROUND.duration) * 60; i++) {
          step(game, NO_INPUT);
          game.events.length = 0;
          const s = game.seeker;
          for (const [x, y] of [
            [s.x - r, s.y - r],
            [s.x + r, s.y - r],
            [s.x - r, s.y + r],
            [s.x + r, s.y + r],
          ]) {
            expect(isSolid(game.grid, ...tileOf(x, y))).toBe(false);
          }
          if (game.phase !== "play" && game.phase !== "countdown") break;
        }
      }
    },
  );

  it("cuts across open floor instead of walking tile by tile", () => {
    const game = newGame(seeded(5));
    skipCountdown(game);
    const s = game.seeker;
    // Send Peeka from the hall to the middle of the living room.
    s.mode = "patrol";
    s.room = "living";
    s.path = [];
    const target = roomWaypoint(game, "living");
    const tiles = findPath(game.grid, tileOf(s.x, s.y), target)!;
    let tileLength = 0;
    let at = centerOf(tileOf(s.x, s.y));
    for (const t of tiles) {
      const c = centerOf(t);
      tileLength += Math.hypot(c.x - at.x, c.y - at.y);
      at = c;
    }
    let walked = 0;
    let prev = { x: s.x, y: s.y };
    for (let i = 0; i < 60 * 10 && s.look === 0; i++) {
      step(game, NO_INPUT);
      game.events.length = 0;
      walked += Math.hypot(s.x - prev.x, s.y - prev.y);
      prev = { x: s.x, y: s.y };
    }
    expect(s.look).toBeGreaterThan(0); // arrived and looking around
    expect(walked).toBeLessThan(tileLength - 4);
  });

  it("hears running, gets suspicious and investigates", () => {
    const game = newGame(seeded(12));
    skipCountdown(game);
    // Run off down the hall, behind Peeka's back.
    game.seeker.angle = -Math.PI / 2;
    const events = run(game, 0.8, { x: 1, y: 0, run: true });
    expect(events.some((e) => e.type === "heard")).toBe(true);
    expect(events.some((e) => e.type === "suspicious")).toBe(true);
    run(game, game.tuning.reaction + 0.1);
    expect(["investigate", "search", "chase"]).toContain(game.seeker.mode);
  });

  it("doesn't hear quiet walking", () => {
    const game = newGame(seeded(12));
    skipCountdown(game);
    game.seeker.angle = -Math.PI / 2;
    const events = run(game, 1.5, { x: 1, y: 0, run: false });
    expect(events.some((e) => e.type === "heard")).toBe(false);
  });

  it("chases a player it can see clearly, and catches them", () => {
    const game = newGame(seeded(13));
    skipCountdown(game);
    inFrontOfPeeka(game);
    const events = run(game, 4);
    expect(events.some((e) => e.type === "chase")).toBe(true);
    expect(game.caught?.kind).toBe("seen");
  });

  it("checks the spot it saw you slip into", () => {
    const game = newGame(seeded(17));
    skipCountdown(game);
    const spot = spotById(game, "plant");
    place(game, spot.approach);
    // Peeka a few tiles away, looking straight at you.
    const a = centerOf(spot.approach);
    game.seeker.x = a.x + 4 * TILE;
    game.seeker.y = a.y;
    lookAtPlayer(game);
    step(game, NO_INPUT, true);
    run(game, 10);
    expect(game.caught).toMatchObject({ kind: "checked", spot: "plant" });
  });

  it("remembers checked spots for a while, then forgets", () => {
    const game = newGame(seeded(14));
    skipCountdown(game);
    game.seeker.checked.desk = game.clock;
    expect(spotStatus(game, "desk")).toBe("checked");
    game.clock += game.tuning.memory + 0.1;
    expect(spotStatus(game, "desk")).toBe("free");
  });
});

describe("round flow", () => {
  it("counts down, then times exactly 1:45 and wins once", () => {
    let checkedWin = false;
    for (let seed = 15; seed < 40 && !checkedWin; seed++) {
      const game = newGame(seeded(seed));
      place(game, spotById(game, "plant").approach);
      let wins = 0;
      let caught = 0;
      let goAt = -1;
      let wonAt = -1;
      const counts: number[] = [];
      for (let i = 0; i < (ROUND.headStart + ROUND.duration + 2) * 60; i++) {
        step(game, NO_INPUT, i === 0);
        for (const e of game.events) {
          if (e.type === "countdown") counts.push(e.n);
          if (e.type === "go") goAt = game.clock;
          if (e.type === "won") {
            wins++;
            wonAt = game.clock;
          }
          if (e.type === "caught") caught++;
        }
        game.events.length = 0;
      }
      expect(counts).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
      if (caught > 0) {
        expect(caught).toBe(1);
        expect(wins).toBe(0);
        continue;
      }
      checkedWin = true;
      expect(wins).toBe(1);
      expect(goAt).toBeCloseTo(ROUND.headStart, 1);
      expect(wonAt - goAt).toBeCloseTo(ROUND.duration, 1);
      expect(game.score).toBeGreaterThanOrEqual(ROUND.duration * 10 + 500);
    }
    expect(checkedWin).toBe(true);
  });

  it("ends the game exactly once when caught", () => {
    const game = newGame(seeded(13));
    skipCountdown(game);
    inFrontOfPeeka(game);
    const events = run(game, 8);
    expect(events.filter((e) => e.type === "caught")).toHaveLength(1);
    expect(events.filter((e) => e.type === "over")).toHaveLength(1);
    expect(game.phase).toBe("over");
  });

  it("starts the next round fresh, keeping the score and what Peeka learned", () => {
    const game = newGame(seeded(16));
    game.score = 1234;
    game.hideCounts.sofa = 2;
    game.roundsWon = 1;
    game.seeker.checked.desk = 5;
    game.player.hidden = "sofa";
    resetRound(game);
    expect(game.phase).toBe("countdown");
    expect(game.time).toBe(ROUND.duration);
    expect(game.player.hidden).toBeNull();
    expect(game.seeker.checked).toEqual({});
    expect(game.seeker.mode).toBe("count");
    expect(game.score).toBe(1234);
    expect(game.hideCounts.sofa).toBe(2);
    expect(game.tuning).toEqual(seekerTuning(1));
  });

  it("makes Peeka smarter each round, easing toward a cap", () => {
    const t = [0, 1, 2, 5, 20, 100].map(seekerTuning);
    for (let i = 1; i < t.length; i++) {
      expect(t[i].speed).toBeGreaterThan(t[i - 1].speed);
      expect(t[i].range).toBeGreaterThan(t[i - 1].range);
      expect(t[i].reaction).toBeLessThan(t[i - 1].reaction);
    }
    expect(t[5].speed - t[4].speed).toBeLessThan(0.05);
    expect(t[1].speed - t[0].speed).toBeGreaterThan(t[2].speed - t[1].speed);
  });
});

describe.each(HOUSES.map((h, i) => [h.name, i] as const))(
  "balance in %s (autopilot)",
  (_name, house) => {
    const rate = (bot: "camper" | "smart", roundsWon: number, n = 60) => {
      let won = 0;
      for (let i = 0; i < n; i++) {
        const game = newGame(seeded(i * 7 + 3), house);
        game.roundsWon = roundsWon;
        resetRound(game);
        playBot(game, bot, roundsWon + 1);
        if (game.roundsWon > roundsWon) won++;
      }
      return won / n;
    };

    it("doesn't let you just wait in the first spot every round", () => {
      expect(rate("camper", 0)).toBeLessThan(0.35);
    }, 60_000);

    it("rewards smart moves in round 1, and gets harder later", () => {
      const first = rate("smart", 0);
      const later = rate("smart", 5);
      expect(first).toBeGreaterThanOrEqual(0.65);
      expect(later).toBeLessThan(first - 0.15);
    }, 120_000);
  },
);

describe("houses in a row", () => {
  it("plays each round in the next house, starting from the one picked", () => {
    const game = newGame(seeded(1), 1);
    expect(game.grid.house.id).toBe(HOUSES[1].id);
    for (let round = 2; round <= HOUSES.length + 1; round++) {
      game.round = round - 1;
      nextRound(game);
      expect(game.round).toBe(round);
      expect(game.grid.house.id).toBe(HOUSES[round % HOUSES.length].id);
      const start = centerOf(game.grid.house.playerStart);
      expect([game.player.x, game.player.y]).toEqual([start.x, start.y]);
    }
  });

  it("remembers hiding habits by kind of furniture, across houses", () => {
    const game = newGame(seeded(2));
    place(game, spotById(game, "wardrobe").approach);
    step(game, NO_INPUT, true);
    expect(game.hideCounts.wardrobe).toBe(1);
    game.round = 2; // round 3 is the Star Tower, which has a wardrobe too
    nextRound(game);
    expect(game.grid.house.id).toBe("tower");
    expect(game.hideCounts.wardrobe).toBe(1);
  });
});
