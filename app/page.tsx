import type { Metadata } from "next";
import Link from "next/link";
import GameCard from "@/components/GameCard";
import RocketLogo from "@/components/RocketLogo";
import { GAMES } from "@/lib/games/registry";

export const metadata: Metadata = { alternates: { canonical: "/" } };

export default function Home() {
  return (
    <>
      <section className="grid items-center gap-6 py-2 sm:gap-8 sm:py-4 md:grid-cols-[1.2fr_1fr] md:py-10">
        <div>
          <h1 className="font-display text-3xl leading-tight font-semibold text-balance sm:text-5xl">
            Quick games,{" "}
            <span className="text-accent">launched in a second.</span>
          </h1>
          <p className="mt-3 max-w-prose text-muted sm:mt-4 sm:text-lg">
            Free, safe games for kids — inspired by the fun little games from
            Google. Play right in your Chrome browser at recess, lunch, or after
            your work!
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/games/rocket-run" className="btn-primary">
              <span aria-hidden="true">🚀</span> Play Rocket Run
            </Link>
            <Link href="#games" className="btn-secondary">
              Browse all games
            </Link>
          </div>
          <Link
            href="/about"
            className="mt-4 inline-block rounded text-sm text-muted underline-offset-4 hover:text-text hover:underline"
          >
            About RocketGame →
          </Link>
        </div>
        <div className="relative mx-auto hidden aspect-square w-full max-w-72 items-center justify-center rounded-full bg-surface-2 md:flex">
          <RocketLogo className="animate-float size-3/5" />
        </div>
      </section>

      <section aria-labelledby="games" className="mt-8 scroll-mt-6 sm:mt-10">
        <h2 id="games" className="font-display text-2xl font-semibold">
          All games
        </h2>
        <ul className="mt-4 grid grid-cols-1 gap-3 min-[340px]:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {GAMES.map((game) => (
            <GameCard key={game.slug} game={game} />
          ))}
        </ul>
      </section>
    </>
  );
}
