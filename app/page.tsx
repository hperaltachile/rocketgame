import type { Metadata } from "next";
import Link from "next/link";
import GameCard from "@/components/GameCard";
import RocketLogo from "@/components/RocketLogo";
import { GAMES } from "@/lib/games/registry";

export const metadata: Metadata = { alternates: { canonical: "/" } };

export default function Home() {
  return (
    <>
      <section className="grid items-center gap-8 py-4 md:grid-cols-[1.2fr_1fr] md:py-10">
        <div>
          <h1 className="font-display text-4xl leading-tight font-semibold text-balance sm:text-5xl">
            Quick games,{" "}
            <span className="text-accent">launched in a second.</span>
          </h1>
          <p className="mt-4 max-w-prose text-lg text-muted">
            Free space-themed browser games. No sign-up, no downloads — pick a
            game and play right away, on your phone or keyboard.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/games/2048" className="btn-primary">
              <span aria-hidden="true">🔢</span> Play 2048
            </Link>
            <Link href="#games" className="btn-secondary">
              Browse all games
            </Link>
          </div>
        </div>
        <div className="relative mx-auto flex aspect-square w-full max-w-72 items-center justify-center rounded-full bg-surface-2">
          <RocketLogo className="animate-float size-3/5" />
        </div>
      </section>

      <section aria-labelledby="games" className="mt-10 scroll-mt-6">
        <h2 id="games" className="font-display text-2xl font-semibold">
          All games
        </h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {GAMES.map((game) => (
            <GameCard key={game.slug} game={game} />
          ))}
        </ul>
      </section>
    </>
  );
}
