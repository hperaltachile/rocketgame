"use client";

import { useEffect, useEffectEvent, useRef, type ReactNode } from "react";
import { formatBest, type GameInfo } from "@/lib/games/registry";
import { useBest } from "./hooks";
import SoundToggle from "./SoundToggle";

export type GameStatus = "ready" | "playing" | "paused" | "over";

type Stat = { label: string; value: ReactNode };

type Props = {
  game: GameInfo;
  status: GameStatus;
  /** Current score. Omit for games without one (the stats slot can replace it). */
  score?: number;
  scoreLabel?: string;
  /** Extra numbers shown next to the score, e.g. moves or a timer. */
  stats?: Stat[];
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onRestart: () => void;
  /** Heading and text for the game-over screen. */
  overTitle?: string;
  overMessage?: ReactNode;
  isNewBest?: boolean;
  /** Settings shown on the start screen and in the toolbar, e.g. difficulty. */
  controls?: ReactNode;
  howToPlay: ReactNode;
  /** Show the sound toggle (only for games with audio). */
  hasSound?: boolean;
  children: ReactNode;
};

const SCROLL_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  " ",
  "PageUp",
  "PageDown",
]);

function isInteractive(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    target.closest("button, a, input, select, textarea, [contenteditable]") !==
      null
  );
}

export default function GameShell({
  game,
  status,
  score,
  scoreLabel = "Score",
  stats = [],
  onStart,
  onPause,
  onResume,
  onRestart,
  overTitle = "Game over",
  overMessage,
  isNewBest = false,
  controls,
  howToPlay,
  hasSound = false,
  children,
}: Props) {
  const best = useBest(game.slug);
  const boardRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const hadFocusRef = useRef(false);

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === "p" || event.key === "P" || event.key === "Escape") {
      if (status === "playing") onPause();
      else if (status === "paused") onResume();
      else return;
      event.preventDefault();
      return;
    }
    // Keep arrows and Space from scrolling the page mid-game. Space on a
    // focused button still activates it.
    if (status === "playing" && SCROLL_KEYS.has(event.key)) {
      if (event.key === " " && isInteractive(event.target)) return;
      event.preventDefault();
    }
  });

  const onVisibilityChange = useEffectEvent(() => {
    if (document.hidden && status === "playing") onPause();
  });

  useEffect(() => {
    const keyHandler = (event: KeyboardEvent) => onKeyDown(event);
    const visibilityHandler = () => onVisibilityChange();
    window.addEventListener("keydown", keyHandler);
    document.addEventListener("visibilitychange", visibilityHandler);
    return () => {
      window.removeEventListener("keydown", keyHandler);
      document.removeEventListener("visibilitychange", visibilityHandler);
    };
  }, []);

  // Move focus between the overlay button and the board as the state changes,
  // but only once the player has interacted (don't steal focus on page load).
  useEffect(() => {
    if (!hadFocusRef.current) return;
    if (status === "playing") boardRef.current?.focus({ preventScroll: true });
    else primaryRef.current?.focus({ preventScroll: true });
  }, [status]);

  const markInteracted = () => {
    hadFocusRef.current = true;
  };

  return (
    <section
      aria-labelledby="game-title"
      className="mx-auto w-full max-w-2xl"
      onPointerDownCapture={markInteracted}
      onKeyDownCapture={markInteracted}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h1
          id="game-title"
          className="flex items-center gap-2 font-display text-3xl font-semibold"
        >
          <span aria-hidden="true">{game.icon}</span>
          {game.name}
        </h1>
        <div className="flex items-center gap-2">
          {hasSound && <SoundToggle />}
          {(status === "playing" || status === "paused") && (
            <button
              type="button"
              className="btn-secondary"
              onClick={status === "playing" ? onPause : onResume}
              aria-keyshortcuts="P Escape"
            >
              {status === "playing" ? "Pause" : "Resume"}
            </button>
          )}
          {status !== "ready" && (
            <button type="button" className="btn-secondary" onClick={onRestart}>
              Restart
            </button>
          )}
        </div>
      </div>

      <dl className="mb-3 flex flex-wrap gap-2 text-sm">
        {score !== undefined && (
          <StatBox label={scoreLabel} value={score.toLocaleString("en-US")} />
        )}
        {stats.map((stat) => (
          <StatBox key={stat.label} label={stat.label} value={stat.value} />
        ))}
        <StatBox
          label={game.best.label}
          value={best === null ? "—" : formatBest(game, best)}
        />
      </dl>

      {controls && <div className="mb-3">{controls}</div>}

      <div className="relative">
        <div
          ref={boardRef}
          tabIndex={-1}
          inert={status !== "playing"}
          className="rounded-2xl outline-none"
        >
          {children}
        </div>

        {status !== "playing" && (
          <div className="bg-overlay absolute inset-0 z-10 flex items-center justify-center rounded-2xl p-4 backdrop-blur-sm">
            <div
              role="dialog"
              aria-modal="false"
              aria-labelledby="overlay-title"
              className="w-full max-w-xs rounded-2xl border border-line bg-surface p-5 text-center shadow-xl"
            >
              {status === "ready" && (
                <>
                  <h2
                    id="overlay-title"
                    className="font-display text-2xl font-semibold"
                  >
                    Ready?
                  </h2>
                  <p className="mt-1 text-muted">{game.tagline}</p>
                  <button
                    ref={primaryRef}
                    type="button"
                    className="btn-primary mt-4 w-full"
                    onClick={onStart}
                  >
                    Start
                  </button>
                </>
              )}
              {status === "paused" && (
                <>
                  <h2
                    id="overlay-title"
                    className="font-display text-2xl font-semibold"
                  >
                    Paused
                  </h2>
                  <p className="mt-1 text-muted">Press P or Esc to resume.</p>
                  <button
                    ref={primaryRef}
                    type="button"
                    className="btn-primary mt-4 w-full"
                    onClick={onResume}
                  >
                    Resume
                  </button>
                  <button
                    type="button"
                    className="btn-secondary mt-2 w-full"
                    onClick={onRestart}
                  >
                    Restart
                  </button>
                </>
              )}
              {status === "over" && (
                <>
                  <h2
                    id="overlay-title"
                    className="font-display text-2xl font-semibold"
                  >
                    {overTitle}
                  </h2>
                  <div role="status" className="mt-1 text-muted">
                    {overMessage}
                    {isNewBest && (
                      <p className="mt-1 font-semibold text-accent">
                        New best! 🎉
                      </p>
                    )}
                  </div>
                  <button
                    ref={primaryRef}
                    type="button"
                    className="btn-primary mt-4 w-full"
                    onClick={onRestart}
                  >
                    Play again
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <section
        aria-labelledby="how-to-play"
        className="mt-6 rounded-2xl border border-line bg-surface p-5"
      >
        <h2 id="how-to-play" className="font-display text-xl font-semibold">
          How to play
        </h2>
        <div className="prose-game mt-2 text-muted">{howToPlay}</div>
        <p className="mt-2 text-sm text-muted">
          Press <kbd>P</kbd> or <kbd>Esc</kbd> to pause.
        </p>
      </section>
    </section>
  );
}

function StatBox({ label, value }: Stat) {
  return (
    <div className="min-w-24 rounded-xl border border-line bg-surface px-3 py-1.5">
      <dt className="text-xs tracking-wide text-muted uppercase">{label}</dt>
      <dd className="font-display text-xl font-semibold tabular-nums">
        {value}
      </dd>
    </div>
  );
}
