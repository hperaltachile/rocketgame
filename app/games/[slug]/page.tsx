import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import GameLoader from "@/components/GameLoader";
import { GAMES, getGame } from "@/lib/games/registry";
import { openGraph } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return GAMES.map((game) => ({ slug: game.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/games/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const game = getGame(slug);
  if (!game) return {};
  const title = `${game.name} — play free online`;
  const path = `/games/${game.slug}`;
  return {
    title,
    description: game.description,
    alternates: { canonical: path },
    openGraph: openGraph(title, game.description, path),
  };
}

export default async function GamePage({ params }: PageProps<"/games/[slug]">) {
  const { slug } = await params;
  const game = getGame(slug);
  if (!game) notFound();

  return (
    <>
      <nav
        aria-label="Breadcrumb"
        className="mx-auto mb-4 hidden max-w-2xl text-sm sm:block"
      >
        <Link href="/#games" className="rounded text-muted hover:text-text">
          ← All games
        </Link>
      </nav>
      {game.available ? (
        <GameLoader slug={game.slug} />
      ) : (
        <section className="mx-auto max-w-2xl rounded-2xl border border-line bg-surface p-8 text-center">
          <p aria-hidden="true" className="text-6xl">
            {game.icon}
          </p>
          <h1 className="mt-4 font-display text-3xl font-semibold">
            {game.name}
          </h1>
          <p className="mt-2 text-muted">{game.description}</p>
          <p className="mt-6 font-semibold">
            This game is still on the launch pad — check back soon!
          </p>
          <Link href="/#games" className="btn-primary mt-6">
            Play another game
          </Link>
        </section>
      )}
    </>
  );
}
