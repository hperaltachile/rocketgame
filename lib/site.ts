export const SITE_URL = "https://rocketgame.app";
export const SITE_NAME = "RocketGame";
export const SITE_DESCRIPTION =
  "Free, safe and kid-friendly browser games, inspired by the fun little games from Google. No downloads, no sign-up — play right in Chrome at school or at home.";

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
