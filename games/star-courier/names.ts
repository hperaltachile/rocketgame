/**
 * Power-up names, icons and colours, shared by the page and the 3D scene.
 * Kept free of Three.js so the page can use them without downloading it.
 */

import type { PowerUpKind } from "@/lib/games/star-courier/config";

export const POWER_NAMES: Record<PowerUpKind, string> = {
  warp: "Warp Dash",
  magnet: "Star Magnet",
  boots: "Moon Boots",
  twin: "Twin Stars",
  shield: "Bubble Shield",
};

export const POWER_ICONS: Record<PowerUpKind, string> = {
  warp: "💨",
  magnet: "🧲",
  boots: "👢",
  twin: "✨",
  shield: "🫧",
};

export const POWER_COLORS: Record<PowerUpKind, string> = {
  warp: "#4cc9f0",
  magnet: "#ff5e5b",
  boots: "#c39bff",
  twin: "#ffd23f",
  shield: "#2ec4b6",
};
