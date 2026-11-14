/** The three playable couriers. Their 3D models are in games/star-courier/models.ts. */

export type CourierId = "pip" | "zuri" | "bix";

export type Courier = {
  id: CourierId;
  name: string;
  /** One line for the picker. */
  blurb: string;
  icon: string;
  colors: { suit: string; accent: string; visor: string; trim: string };
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
  },
];

export function getCourier(id: string | null | undefined): Courier {
  return COURIERS.find((c) => c.id === id) ?? COURIERS[0];
}
