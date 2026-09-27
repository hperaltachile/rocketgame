import Link from "next/link";
import type { GameInfo } from "@/lib/games/registry";
import BestScore from "./BestScore";

export default function GameCard({ game }: { game: GameInfo }) {
  return (
    <li>
      <Link
        href={`/games/${game.slug}`}
        className="group flex h-full gap-4 rounded-2xl border border-line bg-surface p-4 transition-transform hover:-translate-y-0.5 hover:shadow-lg"
      >
        <span
          aria-hidden="true"
          className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-3xl"
        >
          {game.icon}
        </span>
        <span className="flex min-w-0 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2 font-display text-lg font-semibold">
            {game.name}
            {!game.available && (
              <span className="rounded-full bg-surface-2 px-2 py-0.5 font-sans text-xs font-medium text-muted">
                Coming soon
              </span>
            )}
          </span>
          <span className="text-sm text-muted">{game.tagline}</span>
          <BestScore slug={game.slug} />
        </span>
      </Link>
    </li>
  );
}
