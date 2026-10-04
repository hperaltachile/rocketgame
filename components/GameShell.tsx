"use client";

import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { Direction } from "@/lib/input";
import { formatBest, type GameInfo } from "@/lib/games/registry";
import FullscreenButton from "./fullscreen/FullscreenButton";
import { useFullscreen } from "./fullscreen/useFullscreen";
import {
  useBest,
  useCoarsePointer,
  usePortrait,
  useReducedMotion,
  useSetting,
} from "./hooks";
import SoundToggle from "./SoundToggle";
import TouchControls, { type TouchLayout } from "./TouchControls";

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
  /** Settings shown above the board, e.g. difficulty (hidden in fullscreen). */
  controls?: ReactNode;
  howToPlay: ReactNode;
  /** Show the sound toggle (only for games with audio). */
  hasSound?: boolean;
  /** Hide the best-score box (for games that show their own record in `stats`). */
  hideBest?: boolean;
  /** Board width / height, e.g. 1 or 1.5. The board is scaled to fit, never stretched. */
  aspect?: number;
  /** Widest the board gets on the page (fullscreen uses the whole screen). */
  maxWidth?: string;
  /** Plays best sideways: phones in portrait get a "turn sideways" hint. */
  landscape?: boolean;
  /** On-screen controls for fullscreen on touch screens. */
  touch?: TouchLayout;
  onDirection?: (dir: Direction | null) => void;
  onAction?: (id: string, pressed: boolean) => void;
  /** Short message floating over the top of the board ("GOAL!", "You made 2048!"). */
  callout?: ReactNode;
  /** Shown under the board on the page only, e.g. an arrow pad. */
  below?: ReactNode;
  /** The board itself: fills a box of the given aspect ratio. */
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
  hideBest = false,
  aspect = 1,
  maxWidth = "28rem",
  landscape = false,
  touch,
  onDirection,
  onAction,
  callout,
  below,
  children,
}: Props) {
  const best = useBest(game.slug);
  const stageRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const hadFocusRef = useRef(false);
  const fullscreen = useFullscreen(stageRef, { landscape });
  const coarse = useCoarsePointer();
  const portrait = usePortrait();
  const reducedMotion = useReducedMotion();
  const [touchOn, setTouchOn] = useSetting("touchControls");
  const [rotateDismissed, setRotateDismissed] = useState(false);

  const askToRotate =
    landscape && coarse && portrait && fullscreen.active && !rotateDismissed;
  const hasTouchControls =
    !!touch && (!!touch.pad || (touch.actions?.length ?? 0) > 0);
  const showTouchControls =
    hasTouchControls &&
    fullscreen.active &&
    coarse &&
    touchOn &&
    status === "playing" &&
    !askToRotate;

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === "Escape" && fullscreen.active) {
      // Leaving fullscreen pauses the game (see below).
      fullscreen.exit();
      event.preventDefault();
      return;
    }
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

  // Leaving fullscreen (button, Esc, Back gesture) or being asked to rotate
  // pauses, so nothing happens while the player isn't looking.
  const pauseIfPlaying = useEffectEvent(() => {
    if (status === "playing") onPause();
  });
  const wasFullscreen = useRef(false);
  useEffect(() => {
    if (wasFullscreen.current && !fullscreen.active) pauseIfPlaying();
    wasFullscreen.current = fullscreen.active;
  }, [fullscreen.active]);
  useEffect(() => {
    if (askToRotate) pauseIfPlaying();
  }, [askToRotate]);

  // While playing: no pull-to-refresh or page bounce, and the whole game in
  // view (on a phone held sideways the page is taller than the screen).
  const revealStage = useEffectEvent(() => {
    const stage = stageRef.current;
    if (!stage || fullscreen.active) return;
    const box = stage.getBoundingClientRect();
    if (box.top < 0 || box.bottom > window.innerHeight) {
      stage.scrollIntoView({
        block: "end",
        behavior: reducedMotion ? "auto" : "smooth",
      });
    }
  });
  useEffect(() => {
    if (status !== "playing") return;
    revealStage();
    const root = document.documentElement;
    root.classList.add("is-playing");
    return () => root.classList.remove("is-playing");
  }, [status]);

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

  const allStats: Stat[] = [
    ...(score !== undefined
      ? [{ label: scoreLabel, value: score.toLocaleString("en-US") }]
      : []),
    ...stats,
    ...(!hideBest
      ? [
          {
            label: game.best.label,
            value: best === null ? "—" : formatBest(game, best),
          },
        ]
      : []),
  ];

  const stageStyle = {
    "--aspect": aspect,
    "--board-max": maxWidth,
  } as CSSProperties;

  return (
    <section
      aria-labelledby="game-title"
      className="mx-auto w-full max-w-2xl"
      onPointerDownCapture={markInteracted}
      onKeyDownCapture={markInteracted}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 sm:mb-3">
        <h1
          id="game-title"
          className="flex items-center gap-2 font-display text-2xl font-semibold sm:text-3xl"
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

      <dl className="mb-2 flex flex-wrap gap-2 text-sm sm:mb-3">
        {allStats.map((stat) => (
          <StatBox key={stat.label} label={stat.label} value={stat.value} />
        ))}
      </dl>

      {controls && <div className="mb-3">{controls}</div>}

      <div
        ref={stageRef}
        data-game-stage
        data-fullscreen={fullscreen.mode}
        style={stageStyle}
        className={`game-stage ${status === "playing" || fullscreen.active ? "touch-none" : ""}`}
        onContextMenu={(event) => event.preventDefault()}
      >
        {fullscreen.active && (
          <FullscreenHud
            stats={allStats}
            status={status}
            onPause={onPause}
            onResume={onResume}
            touchToggle={
              coarse && hasTouchControls
                ? { on: touchOn, set: setTouchOn }
                : undefined
            }
          />
        )}

        <div className="game-fit">
          <div className="game-board relative">
            <div
              ref={boardRef}
              tabIndex={-1}
              inert={status !== "playing"}
              className="size-full rounded-2xl outline-none"
            >
              {children}
            </div>

            {callout && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center px-3"
              >
                {callout}
              </div>
            )}

            {status !== "playing" && !askToRotate && (
              <div className="bg-overlay absolute inset-0 z-30 flex items-center justify-center overflow-auto rounded-2xl p-3 backdrop-blur-sm">
                <div
                  role="dialog"
                  aria-modal="false"
                  aria-labelledby="overlay-title"
                  className="w-full max-w-xs rounded-2xl border border-line bg-surface p-4 text-center text-text shadow-xl sm:p-5"
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
                      <p className="mt-1 text-muted">
                        Press P or Esc to resume.
                      </p>
                      {fullscreen.active && (
                        // The fullscreen corners only fit Pause and the
                        // controls toggle on a phone held sideways, so the
                        // other settings live here.
                        <div className="mt-3 flex justify-center gap-2">
                          {hasSound && <SoundToggle />}
                          {coarse && hasTouchControls && <VibrationToggle />}
                        </div>
                      )}
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
        </div>

        {showTouchControls && touch && (
          <TouchControls
            layout={touch}
            onDirection={onDirection}
            onAction={onAction}
          />
        )}

        {askToRotate && (
          <div
            role="dialog"
            aria-labelledby="rotate-title"
            className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-[#0b1026]/90 p-6 text-center text-white"
          >
            <span aria-hidden="true" className="animate-rotate-phone text-6xl">
              📱
            </span>
            <h2
              id="rotate-title"
              className="font-display text-2xl font-semibold"
            >
              Turn your phone sideways!
            </h2>
            <p className="text-white/80">
              This game plays best with your phone on its side.
            </p>
            <button
              type="button"
              className="mt-2 rounded-lg px-3 py-2 text-sm text-white/80 underline underline-offset-4"
              onClick={() => setRotateDismissed(true)}
            >
              Play anyway
            </button>
          </div>
        )}

        <div className="game-bar">
          {landscape && coarse && portrait && !fullscreen.active && (
            <p className="text-sm text-muted">
              <span aria-hidden="true">📱↻ </span>Tip: turn your phone sideways
              and tap full screen for a bigger game.
            </p>
          )}
          <FullscreenButton
            active={fullscreen.active}
            onToggle={fullscreen.toggle}
            className="game-fs-button ml-auto"
          />
        </div>
      </div>

      {below && <div className="mt-3">{below}</div>}

      <section
        aria-labelledby="how-to-play"
        className="mt-6 rounded-2xl border border-line bg-surface p-5"
      >
        <h2 id="how-to-play" className="font-display text-xl font-semibold">
          How to play
        </h2>
        <div className="prose-game mt-2 text-muted">{howToPlay}</div>
        <p className="mt-2 text-sm text-muted">
          Press <kbd>P</kbd> or <kbd>Esc</kbd> to pause. Tap the{" "}
          <span aria-hidden="true">⛶</span> button for full screen.
        </p>
      </section>
    </section>
  );
}

function StatBox({ label, value }: Stat) {
  return (
    <div className="min-w-20 rounded-xl border border-line bg-surface px-3 py-1 sm:min-w-24 sm:py-1.5">
      <dt className="text-xs tracking-wide text-muted uppercase">{label}</dt>
      <dd className="font-display text-lg font-semibold tabular-nums sm:text-xl">
        {value}
      </dd>
    </div>
  );
}

/** Score and buttons pinned to the corners while in fullscreen. */
function FullscreenHud({
  stats,
  status,
  onPause,
  onResume,
  touchToggle,
}: {
  stats: Stat[];
  status: GameStatus;
  onPause: () => void;
  onResume: () => void;
  touchToggle?: { on: boolean; set: (on: boolean) => void };
}) {
  return (
    <>
      <dl className="hud-left pointer-events-none absolute top-3 z-20 flex gap-1.5">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg bg-[#0b1026]/65 px-2.5 py-1 text-white backdrop-blur"
          >
            <dt className="text-[0.65rem] tracking-wide text-white/75 uppercase">
              {stat.label}
            </dt>
            <dd className="font-display text-lg leading-tight font-semibold tabular-nums">
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>
      <div className="hud-right absolute top-3 z-20 flex gap-2">
        {(status === "playing" || status === "paused") && (
          <HudButton
            label={status === "playing" ? "Pause" : "Resume"}
            onClick={status === "playing" ? onPause : onResume}
          >
            {status === "playing" ? "⏸" : "▶"}
          </HudButton>
        )}
        {touchToggle && (
          <HudButton
            label="On-screen controls"
            pressed={touchToggle.on}
            onClick={() => touchToggle.set(!touchToggle.on)}
          >
            🎮
          </HudButton>
        )}
      </div>
    </>
  );
}

function HudButton({
  label,
  pressed,
  onClick,
  children,
}: {
  label: string;
  pressed?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      onClick={onClick}
      className={`flex size-12 items-center justify-center rounded-xl border border-white/30 text-xl text-white backdrop-blur ${
        pressed === false ? "bg-[#0b1026]/40 opacity-60" : "bg-[#0b1026]/65"
      }`}
    >
      <span aria-hidden="true">{children}</span>
    </button>
  );
}

function VibrationToggle() {
  const [vibration, setVibration] = useSetting("vibration");
  if (!("vibrate" in navigator)) return null;
  return (
    <button
      type="button"
      className="btn-secondary"
      aria-pressed={vibration}
      aria-label="Vibration"
      title={vibration ? "Turn vibration off" : "Turn vibration on"}
      onClick={() => setVibration(!vibration)}
    >
      <span aria-hidden="true">{vibration ? "📳" : "📴"}</span>
    </button>
  );
}
