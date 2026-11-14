import { describe, expect, it } from "vitest";
import { TILE } from "./config";
import { roomAt } from "./house";
import { HOUSES } from "./houses";
import {
  buildGrid,
  clearLine,
  distanceField,
  findPath,
  gridFor,
  isSolid,
  lineOfSight,
  visionPolygon,
} from "./nav";

describe.each(HOUSES.map((house) => [house.name, house] as const))(
  "%s",
  (_name, house) => {
    const grid = buildGrid(house);
    const { map } = house;
    const cols = map[0].length;
    const rows = map.length;
    const reach = distanceField(grid, house.playerStart);
    const at = (c: number, r: number) => reach[r * cols + c];

    it("is a rectangle walled in on every side", () => {
      for (const row of map) expect(row).toHaveLength(cols);
      for (let c = 0; c < cols; c++) {
        expect("#O").toContain(map[0][c]);
        expect("#O").toContain(map[rows - 1][c]);
      }
      for (let r = 0; r < rows; r++) {
        expect("#O").toContain(map[r][0]);
        expect("#O").toContain(map[r][cols - 1]);
      }
      expect(map.join("")).toMatch(/^[#O.d]+$/);
    });

    it("has unique room ids, and every floor tile is in a room", () => {
      expect(new Set(house.rooms.map((r) => r.id)).size).toBe(
        house.rooms.length,
      );
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (map[r][c] !== ".") continue;
          const inRoom = house.rooms.some(
            (room) =>
              c >= room.col &&
              c < room.col + room.w &&
              r >= room.row &&
              r < room.row + room.h,
          );
          expect(inRoom, `tile ${c},${r}`).toBe(true);
        }
      }
    });

    it("keeps furniture on the floor of one room", () => {
      for (const f of house.furniture) {
        const room = roomAt(house, f.col, f.row);
        for (let r = f.row; r < f.row + f.h; r++) {
          for (let c = f.col; c < f.col + f.w; c++) {
            expect(map[r][c], `${f.kind} at ${c},${r}`).toBe(".");
            expect(roomAt(house, c, r).id, `${f.kind} at ${c},${r}`).toBe(
              room.id,
            );
          }
        }
      }
    });

    it("can reach every floor tile from the start", () => {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (!isSolid(grid, c, r))
            expect(at(c, r), `tile ${c},${r}`).toBeGreaterThanOrEqual(0);
        }
      }
      expect(isSolid(grid, ...house.playerStart)).toBe(false);
      expect(isSolid(grid, ...house.seekerStart)).toBe(false);
    });

    it("has 8+ hiding spots, each reachable and next to its furniture", () => {
      expect(grid.spots.length).toBeGreaterThanOrEqual(8);
      expect(new Set(grid.spots.map((s) => s.id)).size).toBe(grid.spots.length);
      expect(
        new Set(grid.spots.map((s) => s.room)).size,
      ).toBeGreaterThanOrEqual(6);
      for (const spot of grid.spots) {
        const [c, r] = spot.approach;
        expect(isSolid(grid, c, r), spot.id).toBe(false);
        expect(map[r][c], `${spot.id} approach is not a doorway`).toBe(".");
        expect(at(c, r), spot.id).toBeGreaterThanOrEqual(0);
        const f = spot.furniture;
        const touching =
          c >= f.col - 1 &&
          c <= f.col + f.w &&
          r >= f.row - 1 &&
          r <= f.row + f.h;
        expect(touching, spot.id).toBe(true);
        expect(spot.suspicion).toBeGreaterThan(0);
        expect(spot.suspicion).toBeLessThanOrEqual(1);
      }
      // Not every spot is equally safe.
      const s = grid.spots.map((x) => x.suspicion);
      expect(Math.max(...s) - Math.min(...s)).toBeGreaterThanOrEqual(0.3);
    });

    it("gives every room at least two ways in or out, so no trapping dead ends", () => {
      for (const room of house.rooms) {
        let ways = 0;
        for (let r = room.row - 1; r <= room.row + room.h; r++) {
          for (let c = room.col - 1; c <= room.col + room.w; c++) {
            const edge =
              r === room.row - 1 ||
              r === room.row + room.h ||
              c === room.col - 1 ||
              c === room.col + room.w;
            if (edge && map[r]?.[c] === "d") ways++;
          }
        }
        // Doorways are 2 tiles wide: count openings, not tiles.
        expect(Math.ceil(ways / 2), room.name).toBeGreaterThanOrEqual(2);
      }
    });

    it("finds paths to every spot without cutting corners", () => {
      for (const spot of grid.spots) {
        const path = findPath(grid, house.seekerStart, spot.approach)!;
        expect(path, spot.id).not.toBeNull();
        let prev = house.seekerStart;
        for (const tile of path) {
          expect(isSolid(grid, ...tile)).toBe(false);
          const dx = tile[0] - prev[0];
          const dy = tile[1] - prev[1];
          expect(Math.max(Math.abs(dx), Math.abs(dy))).toBe(1);
          if (dx && dy) {
            expect(isSolid(grid, prev[0] + dx, prev[1])).toBe(false);
            expect(isSolid(grid, prev[0], prev[1] + dy)).toBe(false);
          }
          prev = tile;
        }
      }
    });
  },
);

describe("navigation (Moonbase House)", () => {
  const grid = gridFor(0);
  const px = (c: number) => (c + 0.5) * TILE;

  it("returns null for a wall and [] for the same tile", () => {
    const start = HOUSES[0].playerStart;
    expect(findPath(grid, start, [0, 0])).toBeNull();
    expect(findPath(grid, start, start)).toEqual([]);
  });

  it("blocks sight with walls and tall furniture, not low furniture", () => {
    // Through the wall between the bedroom and the bathroom.
    expect(lineOfSight(grid, px(9), px(3), px(13), px(3))).toBe(false);
    // Across the open hall.
    expect(lineOfSight(grid, px(3), px(10), px(30), px(10))).toBe(true);
    // Over the low dining table (cols 27-30, rows 17-18).
    expect(lineOfSight(grid, px(26), px(17.5), px(32), px(17.5))).toBe(true);
    // Not through the tall storage shelf (col 16, rows 12-15).
    expect(lineOfSight(grid, px(17), px(13), px(15), px(13))).toBe(false);
  });

  it("clips the flashlight cone at walls", () => {
    const cone = visionPolygon(grid, 5.5 * TILE, 2.5 * TILE, 0, 0.3, 20 * TILE);
    // Facing right from the bedroom, nothing gets past the wall at col 11.
    for (const [x] of cone.slice(1))
      expect(x).toBeLessThanOrEqual(11 * TILE + 2);
  });

  it("knows when a straight walk is clear", () => {
    // Along the open hall.
    expect(clearLine(grid, px(3), px(9.5), px(30), px(9.5), 5)).toBe(true);
    // Not through the bedroom wall, and not brushing past the sofa.
    expect(clearLine(grid, px(8), px(4), px(8), px(10), 5)).toBe(false);
    expect(clearLine(grid, px(3), px(17), px(9), px(19), 5)).toBe(false);
  });

  it("wraps around the house list", () => {
    expect(gridFor(HOUSES.length)).toBe(gridFor(0));
    expect(gridFor(1).house.id).toBe(HOUSES[1].id);
  });
});
