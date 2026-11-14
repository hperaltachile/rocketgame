/**
 * The houses, played in order (round 1 in the first house picked, then the
 * next, and around). Add one by appending a HouseDef, then run `npm test`:
 * it checks the house is walled in, every floor tile and hiding spot can be
 * reached, every room has two ways in or out, and the balance bots still
 * find it fair.
 */

import { item, room, rug, spot, type HouseDef } from "./house";

/** The first house: a cozy family home on a moon base. */
const MOONBASE: HouseDef = {
  id: "moonbase",
  name: "Moonbase House",
  map: [
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
  ],
  rooms: [
    room("bedroom", "Bedroom", 1, 1, 10, 7, "carpet", ["#7c6fd6", "#6a5cc4"]),
    room("bathroom", "Bathroom", 12, 1, 6, 7, "tile", ["#9fe3e8", "#7fcbd4"]),
    room("study", "Study", 19, 1, 16, 7, "wood", ["#b9825a", "#a5714c"]),
    room("hall", "Hall", 1, 9, 34, 2, "metal", ["#8590b3", "#76809f"]),
    room("living", "Living Room", 1, 12, 14, 11, "wood", [
      "#c99a6b",
      "#b6885b",
    ]),
    room("storage", "Storage Bay", 16, 12, 6, 11, "metal", [
      "#7a8399",
      "#687088",
    ]),
    room("kitchen", "Kitchen", 23, 12, 12, 11, "tile", ["#f2d48a", "#e2bf6e"]),
  ],
  furniture: [
    // Bedroom
    rug(4, 3, 5, 3),
    spot("bed", 1, 1, 2, 3, false, {
      id: "bed",
      name: "Under the Bed",
      suspicion: 0.9,
      approach: [3, 2],
    }),
    item("nightstand", 3, 1, 1, 1, false),
    spot("wardrobe", 8, 1, 2, 1, true, {
      id: "wardrobe",
      name: "Wardrobe",
      suspicion: 0.95,
      approach: [8, 2],
    }),
    item("toychest", 1, 7, 2, 1, false),
    item("plant", 10, 7, 1, 1, true),
    // Bathroom
    item("sink", 12, 1, 2, 1, false),
    spot("shower", 16, 1, 2, 2, true, {
      id: "shower",
      name: "Shower Curtain",
      suspicion: 0.8,
      approach: [16, 3],
    }),
    item("towels", 12, 3, 1, 1, false),
    spot("basket", 17, 6, 1, 1, false, {
      id: "basket",
      name: "Laundry Basket",
      suspicion: 0.45,
      approach: [16, 6],
    }),
    // Study
    item("bookshelf", 19, 1, 1, 3, true),
    spot("desk", 25, 1, 3, 1, false, {
      id: "desk",
      name: "Desk Cubby",
      suspicion: 0.55,
      approach: [26, 2],
    }),
    item("bookshelf", 33, 1, 2, 1, true),
    item("globe", 29, 4, 1, 1, false),
    item("telescope", 34, 6, 1, 1, true),
    item("armchair", 20, 6, 2, 1, false),
    // Hall
    spot("pots", 1, 9, 1, 1, true, {
      id: "plant",
      name: "Plant Pots",
      suspicion: 0.4,
      approach: [2, 9],
    }),
    item("shoerack", 34, 10, 1, 1, false),
    // Living room
    rug(3, 19, 7, 3),
    item("bookshelf", 1, 12, 1, 2, true),
    item("plant", 14, 12, 1, 1, true),
    spot("sofa", 4, 18, 5, 1, false, {
      id: "sofa",
      name: "Behind the Sofa",
      suspicion: 0.75,
      approach: [6, 17],
    }),
    item("table", 5, 20, 3, 1, false),
    item("screen", 4, 22, 5, 1, false),
    item("armchair", 12, 20, 2, 1, false),
    // Storage bay
    item("shelf", 16, 12, 1, 4, true),
    spot("bigbox", 20, 12, 2, 1, true, {
      id: "box",
      name: "Tall Storage Box",
      suspicion: 0.6,
      approach: [20, 13],
    }),
    item("crate", 19, 17, 1, 1, false),
    item("crate", 18, 20, 2, 1, false),
    item("shelf", 21, 19, 1, 3, true),
    spot("closet", 16, 22, 2, 1, true, {
      id: "closet",
      name: "Coat Closet",
      suspicion: 0.9,
      approach: [16, 21],
    }),
    // Kitchen
    item("counter", 29, 12, 5, 1, false),
    item("fridge", 34, 12, 1, 2, true),
    item("dining", 27, 17, 4, 2, false),
    item("chair", 26, 17, 1, 1, false),
    item("chair", 31, 18, 1, 1, false),
    item("plant", 34, 17, 1, 1, true),
    spot("cupboard", 23, 22, 2, 1, true, {
      id: "cupboard",
      name: "Kitchen Cupboard",
      suspicion: 0.7,
      approach: [23, 21],
    }),
    spot("pantry", 34, 21, 1, 2, true, {
      id: "pantry",
      name: "Pantry",
      suspicion: 0.6,
      approach: [33, 21],
    }),
  ],
  playerStart: [18, 10],
  seekerStart: [17, 9],
};

/**
 * A garden habitat: a glass greenhouse in the middle with a ring hall all
 * the way round it, so there's always another way to go.
 */
const GREENHOUSE: HouseDef = {
  id: "greenhouse",
  name: "Greenhouse Dome",
  map: [
    "###OO#########O##O#########OO###",
    "#......#................#......#",
    "#......d................d......#",
    "#......d................d......#",
    "#......#................#......#",
    "O......####dd######dd####......#",
    "O......#................d......#",
    "#......#................d......#",
    "#......#..#####dd#####..#......#",
    "#......d..#..........#..########",
    "#......d..#..........#..#......#",
    "#......#..d..........d..#......#",
    "########..d..........d..#......#",
    "#......#..#..........#..#......O",
    "#......#..#..........#..d......O",
    "#......d..#####dd#####..d......#",
    "#......d................#......#",
    "O......#................#......#",
    "O......####dd######dd####......#",
    "#......#................#......O",
    "#......d................d......#",
    "#......d................d......#",
    "#......#................#......#",
    "###O#########O####O#########O###",
  ],
  rooms: [
    room("garage", "Rover Garage", 1, 1, 6, 11, "metal", [
      "#7a8399",
      "#687088",
    ]),
    room("kids", "Kids' Room", 1, 13, 6, 10, "carpet", ["#f29fc5", "#e383b0"]),
    room("kitchen", "Kitchen", 8, 1, 16, 4, "tile", ["#f2d48a", "#e2bf6e"]),
    room("game", "Game Room", 8, 19, 16, 4, "carpet", ["#5b8def", "#4a78d6"]),
    room("bathroom", "Bathroom", 25, 1, 6, 8, "tile", ["#9fe3e8", "#7fcbd4"]),
    room("music", "Music Room", 25, 10, 6, 13, "wood", ["#b9825a", "#a5714c"]),
    room("greenhouse", "Greenhouse", 11, 9, 10, 6, "grass", [
      "#6fcf73",
      "#5bb860",
    ]),
    room("hall", "Ring Hall", 8, 6, 16, 12, "metal", ["#8590b3", "#76809f"]),
  ],
  furniture: [
    // Rover garage
    spot("rover", 1, 1, 3, 2, true, {
      id: "rover",
      name: "Behind the Moon Rover",
      suspicion: 0.7,
      approach: [2, 3],
    }),
    item("crate", 5, 1, 1, 1, false),
    item("shelf", 6, 5, 1, 3, true),
    item("crate", 4, 11, 1, 1, false),
    spot("cupboard", 1, 11, 2, 1, true, {
      id: "tools",
      name: "Tool Cupboard",
      suspicion: 0.6,
      approach: [1, 10],
    }),
    // Kitchen
    item("fridge", 10, 1, 1, 2, true),
    item("counter", 13, 1, 5, 1, false),
    item("dining", 16, 3, 3, 1, false),
    item("chair", 15, 3, 1, 1, false),
    spot("pantry", 23, 1, 1, 2, true, {
      id: "pantry",
      name: "Pantry",
      suspicion: 0.6,
      approach: [22, 2],
    }),
    // Bathroom
    item("sink", 25, 1, 2, 1, false),
    spot("shower", 29, 1, 2, 2, true, {
      id: "shower",
      name: "Shower Curtain",
      suspicion: 0.8,
      approach: [29, 3],
    }),
    spot("basket", 30, 8, 1, 1, false, {
      id: "basket",
      name: "Laundry Basket",
      suspicion: 0.55,
      approach: [29, 8],
    }),
    // Ring hall
    spot("pots", 8, 17, 1, 1, true, {
      id: "plant",
      name: "Plant Pots",
      suspicion: 0.5,
      approach: [9, 17],
    }),
    item("plant", 23, 17, 1, 1, true),
    item("plant", 23, 6, 1, 1, true),
    // Greenhouse
    item("planter", 12, 10, 3, 1, false),
    item("planter", 17, 10, 3, 1, false),
    item("planter", 12, 13, 3, 1, false),
    item("planter", 17, 13, 3, 1, false),
    item("hedge", 11, 9, 1, 1, true),
    spot("hedge", 20, 14, 1, 1, true, {
      id: "leaves",
      name: "Behind the Big Leaves",
      suspicion: 0.6,
      approach: [19, 14],
    }),
    // Kids' room
    rug(3, 17, 3, 3),
    spot("bunk", 1, 13, 2, 3, false, {
      id: "bunk",
      name: "Under the Bunk Bed",
      suspicion: 0.85,
      approach: [3, 14],
    }),
    item("toychest", 5, 13, 2, 1, false),
    spot("tent", 3, 21, 3, 2, false, {
      id: "fort",
      name: "Blanket Fort",
      suspicion: 0.75,
      approach: [4, 20],
    }),
    // Game room
    spot("beanbag", 9, 21, 2, 2, false, {
      id: "beanbags",
      name: "Beanbag Pile",
      suspicion: 0.6,
      approach: [11, 21],
    }),
    item("arcade", 14, 22, 1, 1, true),
    item("arcade", 15, 22, 1, 1, true),
    item("screen", 17, 22, 4, 1, false),
    // Music room
    spot("curtain", 30, 12, 1, 3, true, {
      id: "curtain",
      name: "Behind the Curtain",
      suspicion: 0.65,
      approach: [29, 13],
    }),
    item("bookshelf", 25, 22, 2, 1, true),
    item("armchair", 27, 20, 2, 1, false),
    item("plant", 30, 22, 1, 1, true),
  ],
  playerStart: [16, 17],
  seekerStart: [15, 16],
};

/**
 * A tall, twisty home around one long hall: lots of small rooms that open
 * into each other, and a library full of bookshelves.
 */
const STAR_TOWER: HouseDef = {
  id: "tower",
  name: "Star Tower",
  map: [
    "####O####O############OO#####OO###",
    "#..............#..#..............#",
    "#..............#..#..............#",
    "O..............d..d..............#",
    "#..............d..d..............O",
    "#..............#..#..............O",
    "#..............#..#..............#",
    "###dd######dd###..#..............#",
    "#.......#......#..#..............#",
    "#.......#......#..###########dd###",
    "O.......d......d..#.......#......#",
    "#.......d......d..#.......#......#",
    "#.......#......#..d.......d......O",
    "#.......#......#..d.......d......#",
    "####dd##########..#.......#......#",
    "#..............#..#.......#......#",
    "#..............#..#.......###dd###",
    "O..............d..#.......#......#",
    "O..............d..#.......d......O",
    "#..............#..#.......d......#",
    "#..............#..#.......#......#",
    "######O###O###########O#######O###",
  ],
  rooms: [
    room("library", "Library", 1, 1, 14, 6, "wood", ["#a56b43", "#8f5b37"]),
    room("bedroom", "Bedroom", 1, 8, 7, 6, "carpet", ["#7c6fd6", "#6a5cc4"]),
    room("bathroom", "Bathroom", 9, 8, 6, 6, "tile", ["#9fe3e8", "#7fcbd4"]),
    room("dining", "Dining Room", 1, 15, 14, 6, "tile", ["#f2d48a", "#e2bf6e"]),
    room("hall", "Tower Hall", 16, 1, 2, 20, "metal", ["#8590b3", "#76809f"]),
    room("observatory", "Observatory", 19, 1, 14, 8, "carpet", [
      "#3d3f8f",
      "#33357a",
    ]),
    room("workshop", "Workshop", 19, 10, 7, 11, "metal", [
      "#7a8399",
      "#687088",
    ]),
    room("storage", "Storage Room", 27, 10, 6, 6, "wood", [
      "#c99a6b",
      "#b6885b",
    ]),
    room("lounge", "Lounge", 27, 17, 6, 4, "carpet", ["#2a9d8f", "#238679"]),
  ],
  furniture: [
    // Library: rows of tall shelves
    item("bookshelf", 3, 2, 1, 3, true),
    item("bookshelf", 6, 2, 1, 3, true),
    item("bookshelf", 9, 2, 1, 3, true),
    item("bookshelf", 12, 2, 1, 3, true),
    spot("beanbag", 1, 5, 2, 2, false, {
      id: "nook",
      name: "Reading Nook",
      suspicion: 0.55,
      approach: [3, 5],
    }),
    item("globe", 14, 6, 1, 1, false),
    // Bedroom
    spot("bed", 1, 8, 2, 3, false, {
      id: "bed",
      name: "Under the Bed",
      suspicion: 0.9,
      approach: [3, 9],
    }),
    spot("wardrobe", 6, 13, 2, 1, true, {
      id: "wardrobe",
      name: "Wardrobe",
      suspicion: 0.95,
      approach: [6, 12],
    }),
    item("nightstand", 1, 11, 1, 1, false),
    // Bathroom
    spot("shower", 13, 8, 2, 2, true, {
      id: "shower",
      name: "Shower Curtain",
      suspicion: 0.8,
      approach: [13, 10],
    }),
    item("sink", 9, 13, 2, 1, false),
    // Dining room
    rug(4, 16, 6, 4),
    item("dining", 5, 17, 4, 2, false),
    item("chair", 4, 17, 1, 1, false),
    item("chair", 9, 18, 1, 1, false),
    spot("cupboard", 1, 20, 2, 1, true, {
      id: "cupboard",
      name: "Kitchen Cupboard",
      suspicion: 0.7,
      approach: [1, 19],
    }),
    spot("pantry", 14, 19, 1, 2, true, {
      id: "pantry",
      name: "Pantry",
      suspicion: 0.6,
      approach: [13, 19],
    }),
    // Tower hall
    spot("pots", 16, 1, 1, 1, true, {
      id: "plant",
      name: "Plant Pots",
      suspicion: 0.35,
      approach: [16, 2],
    }),
    // Observatory
    item("telescope", 26, 4, 1, 1, true),
    item("globe", 22, 2, 1, 1, false),
    spot("desk", 29, 1, 3, 1, false, {
      id: "desk",
      name: "Desk Cubby",
      suspicion: 0.55,
      approach: [30, 2],
    }),
    item("armchair", 23, 7, 2, 1, false),
    item("bookshelf", 32, 6, 1, 2, true),
    // Workshop
    item("shelf", 19, 10, 1, 1, true),
    item("crate", 25, 10, 1, 1, false),
    spot("rover", 22, 15, 3, 2, true, {
      id: "rover",
      name: "Behind the Moon Rover",
      suspicion: 0.7,
      approach: [21, 15],
    }),
    spot("bigbox", 19, 20, 2, 1, true, {
      id: "box",
      name: "Tall Storage Box",
      suspicion: 0.6,
      approach: [19, 19],
    }),
    // Storage room
    item("shelf", 32, 10, 1, 4, true),
    spot("closet", 27, 15, 2, 1, true, {
      id: "closet",
      name: "Coat Closet",
      suspicion: 0.9,
      approach: [27, 14],
    }),
    // Lounge
    spot("sofa", 28, 20, 4, 1, false, {
      id: "sofa",
      name: "Behind the Sofa",
      suspicion: 0.75,
      approach: [30, 19],
    }),
    item("plant", 32, 17, 1, 1, true),
  ],
  playerStart: [17, 11],
  seekerStart: [16, 10],
};

export const HOUSES: readonly HouseDef[] = [MOONBASE, GREENHOUSE, STAR_TOWER];
