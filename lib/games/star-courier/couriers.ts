/** The three playable couriers. Their 3D models are in games/star-courier/models.ts. */

export type CourierId = "pip" | "zuri" | "bix";

export type CourierColors = {
  suit: string;
  accent: string;
  visor: string;
  trim: string;
};

/** A colour outfit. The first one of each courier is free. */
export type Suit = { id: string; name: string; colors: CourierColors };

export type Courier = {
  id: CourierId;
  name: string;
  /** One line for the picker. */
  blurb: string;
  icon: string;
  colors: CourierColors;
  /** Stardust to unlock the courier (0 = free). */
  price: number;
  suits: readonly Suit[];
};

export const COURIERS: readonly Courier[] = [
  {
    id: "pip",
    name: "Pip",
    blurb: "Small, speedy and never without a big round helmet.",
    icon: "🧑‍🚀",
    colors: {
      suit: "#ff8a3d",
      accent: "#ffd23f",
      visor: "#4cc9f0",
      trim: "#2b2f45",
    },
    price: 0,
    suits: [
      {
        id: "classic",
        name: "Classic",
        colors: {
          suit: "#ff8a3d",
          accent: "#ffd23f",
          visor: "#4cc9f0",
          trim: "#2b2f45",
        },
      },
      {
        id: "nebula",
        name: "Nebula",
        colors: {
          suit: "#7b61ff",
          accent: "#ff8fab",
          visor: "#fff3b0",
          trim: "#1d1640",
        },
      },
      {
        id: "solar",
        name: "Solar",
        colors: {
          suit: "#ffd23f",
          accent: "#ff5e3a",
          visor: "#2ec4b6",
          trim: "#3d2b1f",
        },
      },
    ],
  },
  {
    id: "zuri",
    name: "Zuri",
    blurb: "Tall, calm, and her scarf flies like a comet tail.",
    icon: "🧣",
    colors: {
      suit: "#2ec4b6",
      accent: "#ff5e5b",
      visor: "#fff3b0",
      trim: "#1d3557",
    },
    price: 1500,
    suits: [
      {
        id: "classic",
        name: "Classic",
        colors: {
          suit: "#2ec4b6",
          accent: "#ff5e5b",
          visor: "#fff3b0",
          trim: "#1d3557",
        },
      },
      {
        id: "aurora",
        name: "Aurora",
        colors: {
          suit: "#c39bff",
          accent: "#7cf5ff",
          visor: "#ffffff",
          trim: "#2b2140",
        },
      },
      {
        id: "ember",
        name: "Ember",
        colors: {
          suit: "#f05d5e",
          accent: "#ffd23f",
          visor: "#ffe0b0",
          trim: "#3b1f2b",
        },
      },
    ],
  },
  {
    id: "bix",
    name: "Bix",
    blurb: "A little delivery robot who rolls on one big wheel.",
    icon: "🤖",
    colors: {
      suit: "#9b5de5",
      accent: "#f15bb5",
      visor: "#00f5d4",
      trim: "#2b2140",
    },
    price: 3000,
    suits: [
      {
        id: "classic",
        name: "Classic",
        colors: {
          suit: "#9b5de5",
          accent: "#f15bb5",
          visor: "#00f5d4",
          trim: "#2b2140",
        },
      },
      {
        id: "chrome",
        name: "Chrome",
        colors: {
          suit: "#c9d1d9",
          accent: "#4cc9f0",
          visor: "#ff8a3d",
          trim: "#3a4166",
        },
      },
      {
        id: "lime",
        name: "Lime",
        colors: {
          suit: "#9ef01a",
          accent: "#ff7b39",
          visor: "#4361ee",
          trim: "#1b3a2b",
        },
      },
    ],
  },
];

export function getCourier(id: string | null | undefined): Courier {
  return COURIERS.find((c) => c.id === id) ?? COURIERS[0];
}

/** A courier wearing one of its suits (unknown suits fall back to the first). */
export function dressed(
  courier: Courier,
  suitId: string | null | undefined,
): Courier {
  const suit = courier.suits.find((s) => s.id === suitId) ?? courier.suits[0];
  return { ...courier, colors: suit.colors };
}

/** Stardust price of a suit that isn't the free first one. */
export const SUIT_PRICE = 600;
