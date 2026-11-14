import { describe, expect, it } from "vitest";
import {
  FIREBAR,
  MOVER,
  PHYS,
  POINTS,
  POLE_TILES,
  ROCKET_OFFSET,
  ROWS,
  TILE,
} from "./config";
import { LEADERBOARD } from "@/lib/leaderboard/rules";
import { LEVELS } from "./levels";
import { autoplay } from "./autopilot";
import { isSolid, newGame, parseLevel } from "./logic";

const LEGEND = new Set(".#XB?MLT_CFcKgkfHV~^*%=SZ".split(""));

/** How far a fire bar's orbs reach from the centre of its block. */
const FIREBAR_REACH = (FIREBAR.orbs - 1) * FIREBAR.spacing + FIREBAR.size / 2;

/** Whether Kit (small, standing on the tile at col, row) is in a fire bar's reach. */
function inFireBarReach(rows: string[], col: number, row: number): boolean {
  const kit = { x: col * TILE + 3, y: (row + 1) * TILE - 14, w: 10, h: 14 };
  return rows.some((cells, r) =>
    [...cells].some((ch, c) => {
      if (ch !== "*" && ch !== "%") return false;
      const cx = c * TILE + TILE / 2;
      const cy = r * TILE + TILE / 2;
      const nx = Math.max(kit.x, Math.min(cx, kit.x + kit.w));
      const ny = Math.max(kit.y, Math.min(cy, kit.y + kit.h));
      return Math.hypot(nx - cx, ny - cy) < FIREBAR_REACH;
    }),
  );
}

/**
 * Kit's walking jump (no Run), sampled every tick: how far he has moved and
 * how high his feet are above where he took off.
 */
function walkingJump(): { x: number; h: number }[] {
  const samples: { x: number; h: number }[] = [];
  let x = 0;
  let y = 0;
  let vy = -(PHYS.jump + PHYS.walk * PHYS.jumpRunBonus);
  const dt = 1 / 60;
  while (y < 12 * TILE) {
    vy = Math.min(
      vy + (vy < 0 ? PHYS.gravityHold : PHYS.gravity) * dt,
      PHYS.maxFall,
    );
    x += PHYS.walk * dt;
    y += vy * dt;
    samples.push({ x, h: -y });
  }
  return samples;
}

/** Furthest Kit can travel while his feet are still at least `rise` tiles up. */
function reach(samples: { x: number; h: number }[], rise: number): number {
  let best = -Infinity;
  for (const s of samples) if (s.h >= rise * TILE) best = Math.max(best, s.x);
  return best;
}

/**
 * Can Kit get from the start to the beacon without Run? A search over the
 * cells he can stand in, joined by walking and by walking jumps (with a few
 * pixels of slack so it isn't pixel-perfect). Moving platforms count as
 * floor along their whole path.
 */
function beaconReachable(rows: string[]): boolean {
  const { grid, start, flag, movers } = parseLevel({
    id: "",
    name: "",
    theme: "plains",
    time: 0,
    rows,
  });
  const cols = grid[0].length;
  const floor = new Set<string>();
  for (const m of movers) {
    for (let i = 0; i < m.len + (m.kind === "h" ? MOVER.range : 0); i++) {
      for (let j = 0; j <= (m.kind === "v" ? MOVER.range : 0); j++) {
        floor.add(`${m.col + i},${m.row - j}`);
      }
    }
  }
  const cell = (c: number, r: number) =>
    c < 0 || c >= cols ? "#" : r < 0 ? "." : r >= ROWS ? "." : grid[r][c];
  const open = (c: number, r: number) => !isSolid(cell(c, r));
  const standable = (c: number, r: number) =>
    open(c, r) &&
    (isSolid(cell(c, r + 1)) ||
      cell(c, r + 1) === "_" ||
      floor.has(`${c},${r + 1}`));

  const samples = walkingJump();
  const slack = 6;
  const seen = new Set<string>([`${start.col},${start.row}`]);
  const queue = [[start.col, start.row]];
  while (queue.length) {
    const [c, r] = queue.shift()!;
    if (c >= flag.col - 1) return true;
    for (let c2 = c - 8; c2 <= c + 8; c2++) {
      for (let r2 = 0; r2 < ROWS; r2++) {
        const key = `${c2},${r2}`;
        if (seen.has(key) || !standable(c2, r2)) continue;
        const dc = Math.abs(c2 - c);
        const rise = r - r2;
        const ok =
          (dc === 1 && rise === 0) ||
          (dc === 0 && rise < 0) ||
          ((dc - 1) * TILE + slack <= reach(samples, rise) &&
            // Room overhead to take off.
            open(c, r - 1));
        if (ok) {
          seen.add(key);
          queue.push([c2, r2]);
        }
      }
    }
  }
  return false;
}

describe.each(LEVELS.map((level) => [level.id, level] as const))(
  "level %s",
  (_id, level) => {
    it("is well formed", () => {
      expect(level.rows).toHaveLength(ROWS);
      const width = level.rows[0].length;
      for (const row of level.rows) {
        expect(row.length).toBe(width);
        for (const ch of row) expect(LEGEND.has(ch), `tile "${ch}"`).toBe(true);
      }
      const all = level.rows.join("");
      expect(all.split("K")).toHaveLength(2);
      // One goal: a beacon pole, or (in a fortress) a power switch.
      expect(all.split("F").length + all.split("S").length).toBe(3);
      expect(all.split("c").length).toBeLessThanOrEqual(2);
    });

    const fortress = level.theme === "fortress";
    it.runIf(fortress)("has Big Clank, its bridge and the switch", () => {
      const all = level.rows.join("");
      expect(all.split("Z")).toHaveLength(2);
      expect(all.split("S")).toHaveLength(2);
      const { grid, flag, boss } = parseLevel(level);
      // Big Clank stands on its bridge, and the switch is past it on solid ground.
      expect(grid[boss!.row + 1][boss!.col]).toBe("=");
      expect(flag.col).toBeGreaterThan(boss!.col);
      expect(isSolid(grid[flag.row + 1][flag.col])).toBe(true);
      // Open sky over the rocket, so it can blast off.
      const rocket = flag.col + ROCKET_OFFSET;
      for (let c = rocket - 1; c <= rocket + 1; c++) {
        for (let r = 0; r <= flag.row; r++) expect(grid[r][c]).toBe(".");
      }
      expect(grid[0].length - rocket).toBeGreaterThanOrEqual(12);
    });

    it("keeps lava pits to three tiles or less", () => {
      // Lava under Big Clank's bridge doesn't count: Kit never touches it.
      level.rows.forEach((row, r) => {
        const open = [...row]
          .map((ch, c) => (level.rows[r - 1]?.[c] === "=" ? "#" : ch))
          .join("");
        for (const run of open.match(/[~^]+/g) ?? [])
          expect(run.length).toBeLessThanOrEqual(3);
      });
    });

    it("keeps fire bars away from the start, checkpoint and landings", () => {
      const { start, checkpoint } = parseLevel(level);
      expect(inFireBarReach(level.rows, start.col, start.row)).toBe(false);
      if (checkpoint) {
        expect(inFireBarReach(level.rows, checkpoint.col, checkpoint.row)).toBe(
          false,
        );
      }
      // The first tile after any pit or lava gap, where Kit lands.
      const floor = level.rows[13];
      for (let c = 1; c < floor.length; c++) {
        if (isSolid(floor[c]) && !isSolid(floor[c - 1])) {
          expect(inFireBarReach(level.rows, c, 12), `col ${c}`).toBe(false);
        }
      }
    });

    it.runIf(!fortress)(
      "has a beacon with room for its pole and the rocket",
      () => {
        const { grid, flag } = parseLevel(level);
        expect(flag.row - POLE_TILES).toBeGreaterThanOrEqual(1);
        for (let r = flag.row - POLE_TILES; r < flag.row; r++) {
          expect(grid[r][flag.col]).toBe(".");
        }
        expect(isSolid(grid[flag.row + 1][flag.col])).toBe(true);
        const rocket = flag.col + ROCKET_OFFSET;
        // The camera can scroll far enough to show the rocket take off.
        expect(grid[0].length - rocket).toBeGreaterThanOrEqual(12);
      },
    );

    it("has tubes two tiles wide", () => {
      for (const row of level.rows) {
        for (const run of row.match(/T+/g) ?? []) expect(run.length).toBe(2);
      }
    });

    it("can be finished without holding Run", () => {
      expect(beaconReachable(level.rows)).toBe(true);
    });

    it("the autopilot (walking, never running) reaches the beacon", () => {
      const game = newGame(LEVELS.indexOf(level));
      game.lives = 99;
      const result = autoplay(game);
      expect(result.cleared).toBe(true);
      // Fair for kids: no deaths a careful walker can't avoid, and lots of
      // time to spare on the clock.
      expect(result.deaths).toBeLessThanOrEqual(1);
      expect(result.seconds).toBeLessThan(level.time * 0.5 * 0.6);
    });
  },
);

it("the reachability check catches an impossible gap", () => {
  const rows = Array.from({ length: ROWS }, (_, r) =>
    r >= 13 ? "#".repeat(10) + ".".repeat(6) + "#".repeat(24) : ".".repeat(40),
  );
  rows[12] = "..K" + rows[12].slice(3, 30) + "F" + rows[12].slice(31);
  expect(beaconReachable(rows)).toBe(false);
  const ok = rows.map((r, i) =>
    i >= 13 ? "#".repeat(10) + "..." + "#".repeat(27) : r,
  );
  expect(beaconReachable(ok)).toBe(true);
});

it("a perfect run through every level stays under the Top 10 cap", () => {
  // Generous: every coin and block, every enemy knocked out by the top of a
  // shell chain, the top of the pole (or the switch and Big Clank) and a full
  // clock turned into points.
  let total = 0;
  for (const level of LEVELS) {
    const all = level.rows.join("");
    const count = (chars: string) =>
      [...all].filter((ch) => chars.includes(ch)).length;
    total += count("C?") * POINTS.coin;
    total += count("ML") * POINTS.powerUp;
    total += count("B") * POINTS.brick;
    total += count("gkf") * Math.max(...POINTS.shellChain);
    total += level.time * POINTS.timeTick;
    total += all.includes("S")
      ? POINTS.switch + POINTS.boss + 2 * POINTS.bossHit
      : POINTS.pole[0][1];
  }
  expect(total).toBeLessThan(LEADERBOARD["astro-hop"]!.max);
});
