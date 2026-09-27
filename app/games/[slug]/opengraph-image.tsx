import { GAMES, getGame } from "@/lib/games/registry";
import { OG_SIZE, ogCard } from "@/lib/og";

export const alt = "A RocketGame browser game";
export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return GAMES.map((game) => ({ slug: game.slug }));
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const game = getGame(slug);
  return ogCard(
    game?.name ?? "RocketGame",
    game?.tagline ?? "Quick, free browser games",
  );
}
