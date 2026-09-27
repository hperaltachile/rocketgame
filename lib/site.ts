export const SITE_URL = "https://rocketgame.me";
export const SITE_NAME = "RocketGame";
export const SITE_DESCRIPTION =
  "Quick, free browser games with a rockets-and-space theme. No sign-up, no downloads — pick a game and play right away.";

/** Page-level openGraph replaces the layout's, so always send the full set. */
export function openGraph(title: string, description: string, path: string) {
  return {
    type: "website" as const,
    siteName: SITE_NAME,
    title,
    description,
    url: path,
  };
}
