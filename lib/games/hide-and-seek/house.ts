/**
 * What a house is made of: a text map, rooms, furniture and hiding spots.
 * The houses themselves are in houses.ts.
 *
 * Map legend (one character per tile):
 *   #  wall          O  window in a wall (blocks like a wall, shows stars)
 *   .  floor         d  doorway (floor; Peeka sometimes pauses here)
 *
 * Furniture sits on floor tiles (tile rects). Low furniture blocks walking
 * but not Peeka's flashlight; tall furniture blocks both. Hiding spots are
 * furniture with a `spot`.
 */

export type FloorStyle = "carpet" | "tile" | "wood" | "metal" | "grass";

export type Room = {
  id: string;
  name: string;
  /** Inside of the room, in tiles (col..col+w-1, row..row+h-1). */
  col: number;
  row: number;
  w: number;
  h: number;
  floor: FloorStyle;
  /** Floor colours (light, dark) for the art. */
  colors: [string, string];
};

export type FurnitureKind =
  | "bed"
  | "nightstand"
  | "wardrobe"
  | "toychest"
  | "plant"
  | "sink"
  | "shower"
  | "basket"
  | "towels"
  | "bookshelf"
  | "desk"
  | "telescope"
  | "globe"
  | "armchair"
  | "pots"
  | "shoerack"
  | "sofa"
  | "table"
  | "screen"
  | "crate"
  | "shelf"
  | "bigbox"
  | "closet"
  | "counter"
  | "fridge"
  | "dining"
  | "chair"
  | "cupboard"
  | "pantry"
  | "rug"
  | "rover"
  | "planter"
  | "hedge"
  | "bunk"
  | "tent"
  | "beanbag"
  | "arcade"
  | "curtain";

export type Spot = {
  id: string;
  name: string;
  /** How likely Peeka is to think of looking here (0..1). */
  suspicion: number;
  /** The floor tile you stand on to hide, and where you pop out. */
  approach: [number, number];
};

export type Furniture = {
  kind: FurnitureKind;
  col: number;
  row: number;
  w: number;
  h: number;
  /** Blocks Peeka's flashlight. */
  tall: boolean;
  /** Rugs: drawn on the floor, block nothing. */
  flat?: boolean;
  spot?: Spot;
};

export type HouseDef = {
  id: string;
  name: string;
  map: readonly string[];
  rooms: readonly Room[];
  furniture: readonly Furniture[];
  /** Where the player and Peeka start each round (tiles). */
  playerStart: [number, number];
  seekerStart: [number, number];
};

export type SpotInfo = Spot & {
  furniture: Furniture;
  room: string;
  /** Centre of the furniture (where a hidden player is), art px. */
  x: number;
  y: number;
};

// ------------------------------------------------------------------ helpers for writing houses

export const room = (
  id: string,
  name: string,
  col: number,
  row: number,
  w: number,
  h: number,
  floor: FloorStyle,
  colors: [string, string],
): Room => ({ id, name, col, row, w, h, floor, colors });

/** A piece of furniture (no hiding spot). */
export const item = (
  kind: FurnitureKind,
  col: number,
  row: number,
  w: number,
  h: number,
  tall: boolean,
): Furniture => ({ kind, col, row, w, h, tall });

/** Furniture you can hide in. */
export const spot = (
  kind: FurnitureKind,
  col: number,
  row: number,
  w: number,
  h: number,
  tall: boolean,
  hiding: Spot,
): Furniture => ({ kind, col, row, w, h, tall, spot: hiding });

export const rug = (
  col: number,
  row: number,
  w: number,
  h: number,
): Furniture => ({ kind: "rug", col, row, w, h, tall: false, flat: true });

/** The room a tile belongs to (doorways count as the hall, or the first room). */
export function roomAt(house: HouseDef, col: number, row: number): Room {
  return (
    house.rooms.find(
      (r) =>
        col >= r.col && col < r.col + r.w && row >= r.row && row < r.row + r.h,
    ) ??
    house.rooms.find((r) => r.id === "hall") ??
    house.rooms[0]
  );
}
