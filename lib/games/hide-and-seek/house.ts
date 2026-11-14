/**
 * The Moonbase House: one compact home of connected rooms. Edit the layout
 * here, then run `npm test` (it checks every floor tile and hiding spot can
 * be reached, and that the rooms keep two ways in or out where promised).
 *
 * Map legend (one character per tile):
 *   #  wall          O  window in a wall (blocks like a wall, shows stars)
 *   .  floor         d  doorway (floor; Peeka sometimes pauses here)
 *
 * Furniture sits on floor tiles and is listed in FURNITURE (tile rects).
 * Low furniture blocks walking but not Peeka's flashlight; tall furniture
 * blocks both. Hiding spots are furniture with a `spot`.
 */

export const MAP = [
  "####OO########O##########OO###O#####",
  "#..........#......#................#",
  "O..........#......#................#",
  "O..........#......#................O",
  "#..........#......#................O",
  "#..........d......#................#",
  "#..........d......#................#",
  "#..........#......#................#",
  "####dd########dd######dd#######dd###",
  "O..................................O",
  "O..................................O",
  "######dd##########dd#######dd#######",
  "#..............#......#............#",
  "#..............#......#............#",
  "O..............#......#............O",
  "O..............#......d............O",
  "#..............#......d............#",
  "#..............#......#............#",
  "#..............d......#............#",
  "O..............d......#............O",
  "O..............#......#............O",
  "#..............#......#............#",
  "#..............#......#............#",
  "#####OO####################OO#######",
] as const;

export const COLS = MAP[0].length;
export const ROWS = MAP.length;

export type FloorStyle = "carpet" | "tile" | "wood" | "metal";

export type Room = {
  id: string;
  name: string;
  /** Inside of the room, in tiles (inclusive of col..col+w-1). */
  col: number;
  row: number;
  w: number;
  h: number;
  floor: FloorStyle;
  /** Floor colours (light, dark) for the art. */
  colors: [string, string];
};

export const ROOMS: readonly Room[] = [
  {
    id: "bedroom",
    name: "Bedroom",
    col: 1,
    row: 1,
    w: 10,
    h: 7,
    floor: "carpet",
    colors: ["#7c6fd6", "#6a5cc4"],
  },
  {
    id: "bathroom",
    name: "Bathroom",
    col: 12,
    row: 1,
    w: 6,
    h: 7,
    floor: "tile",
    colors: ["#9fe3e8", "#7fcbd4"],
  },
  {
    id: "study",
    name: "Study",
    col: 19,
    row: 1,
    w: 16,
    h: 7,
    floor: "wood",
    colors: ["#b9825a", "#a5714c"],
  },
  {
    id: "hall",
    name: "Hall",
    col: 1,
    row: 9,
    w: 34,
    h: 2,
    floor: "metal",
    colors: ["#8590b3", "#76809f"],
  },
  {
    id: "living",
    name: "Living Room",
    col: 1,
    row: 12,
    w: 14,
    h: 11,
    floor: "wood",
    colors: ["#c99a6b", "#b6885b"],
  },
  {
    id: "storage",
    name: "Storage Bay",
    col: 16,
    row: 12,
    w: 6,
    h: 11,
    floor: "metal",
    colors: ["#7a8399", "#687088"],
  },
  {
    id: "kitchen",
    name: "Kitchen",
    col: 23,
    row: 12,
    w: 12,
    h: 11,
    floor: "tile",
    colors: ["#f2d48a", "#e2bf6e"],
  },
];

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
  | "rug";

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

const f = (
  kind: FurnitureKind,
  col: number,
  row: number,
  w: number,
  h: number,
  tall: boolean,
  spot?: Spot,
): Furniture => ({ kind, col, row, w, h, tall, spot });

const rug = (col: number, row: number, w: number, h: number): Furniture => ({
  kind: "rug",
  col,
  row,
  w,
  h,
  tall: false,
  flat: true,
});

export const FURNITURE: readonly Furniture[] = [
  // Bedroom
  rug(4, 3, 5, 3),
  f("bed", 1, 1, 2, 3, false, {
    id: "bed",
    name: "Under the Bed",
    suspicion: 0.9,
    approach: [3, 2],
  }),
  f("nightstand", 3, 1, 1, 1, false),
  f("wardrobe", 8, 1, 2, 1, true, {
    id: "wardrobe",
    name: "Wardrobe",
    suspicion: 0.95,
    approach: [8, 2],
  }),
  f("toychest", 1, 7, 2, 1, false),
  f("plant", 10, 7, 1, 1, true),
  // Bathroom
  f("sink", 12, 1, 2, 1, false),
  f("shower", 16, 1, 2, 2, true, {
    id: "shower",
    name: "Shower Curtain",
    suspicion: 0.8,
    approach: [16, 3],
  }),
  f("towels", 12, 3, 1, 1, false),
  f("basket", 17, 6, 1, 1, false, {
    id: "basket",
    name: "Laundry Basket",
    suspicion: 0.45,
    approach: [16, 6],
  }),
  // Study
  f("bookshelf", 19, 1, 1, 3, true),
  f("desk", 25, 1, 3, 1, false, {
    id: "desk",
    name: "Desk Cubby",
    suspicion: 0.55,
    approach: [26, 2],
  }),
  f("bookshelf", 33, 1, 2, 1, true),
  f("globe", 29, 4, 1, 1, false),
  f("telescope", 34, 6, 1, 1, true),
  f("armchair", 20, 6, 2, 1, false),
  // Hall
  f("pots", 1, 9, 1, 1, true, {
    id: "plant",
    name: "Plant Pots",
    suspicion: 0.35,
    approach: [2, 9],
  }),
  f("shoerack", 34, 10, 1, 1, false),
  // Living room
  rug(3, 19, 7, 3),
  f("bookshelf", 1, 12, 1, 2, true),
  f("plant", 14, 12, 1, 1, true),
  f("sofa", 4, 18, 5, 1, false, {
    id: "sofa",
    name: "Behind the Sofa",
    suspicion: 0.75,
    approach: [6, 17],
  }),
  f("table", 5, 20, 3, 1, false),
  f("screen", 4, 22, 5, 1, false),
  f("armchair", 12, 20, 2, 1, false),
  // Storage bay
  f("shelf", 16, 12, 1, 4, true),
  f("bigbox", 20, 12, 2, 1, true, {
    id: "box",
    name: "Tall Storage Box",
    suspicion: 0.6,
    approach: [20, 13],
  }),
  f("crate", 19, 17, 1, 1, false),
  f("crate", 18, 20, 2, 1, false),
  f("shelf", 21, 19, 1, 3, true),
  f("closet", 16, 22, 2, 1, true, {
    id: "closet",
    name: "Coat Closet",
    suspicion: 0.9,
    approach: [16, 21],
  }),
  // Kitchen
  f("counter", 29, 12, 5, 1, false),
  f("fridge", 34, 12, 1, 2, true),
  f("dining", 27, 17, 4, 2, false),
  f("chair", 26, 17, 1, 1, false),
  f("chair", 31, 18, 1, 1, false),
  f("plant", 34, 17, 1, 1, true),
  f("cupboard", 23, 22, 2, 1, true, {
    id: "cupboard",
    name: "Kitchen Cupboard",
    suspicion: 0.7,
    approach: [23, 21],
  }),
  f("pantry", 34, 21, 1, 2, true, {
    id: "pantry",
    name: "Pantry",
    suspicion: 0.6,
    approach: [33, 21],
  }),
];

export type SpotInfo = Spot & {
  furniture: Furniture;
  room: string;
  /** Centre of the furniture (where a hidden player is), art px. */
  x: number;
  y: number;
};

/** Where the player and Peeka start each round (tiles). */
export const PLAYER_START: [number, number] = [18, 10];
export const SEEKER_START: [number, number] = [17, 9];

/** The room a tile belongs to (doorways count as the Hall). */
export function roomAt(col: number, row: number): Room {
  return (
    ROOMS.find(
      (r) =>
        col >= r.col && col < r.col + r.w && row >= r.row && row < r.row + r.h,
    ) ?? ROOMS.find((r) => r.id === "hall")!
  );
}
