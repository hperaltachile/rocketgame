import type { MetadataRoute } from "next";
import { GAMES } from "@/lib/games/registry";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    ...GAMES.map((game) => ({
      url: `${SITE_URL}/games/${game.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    { url: `${SITE_URL}/about`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
