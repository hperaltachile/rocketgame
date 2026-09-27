import { OG_SIZE, ogCard } from "@/lib/og";

export const alt = "RocketGame — quick, free browser games";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return ogCard(
    "Quick, free browser games",
    "No sign-up, no downloads. Pick a game and play.",
  );
}
