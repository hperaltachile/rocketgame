"use client";

import { useRef, type PointerEvent } from "react";
import { directionFromVector, type Direction } from "@/lib/input";
import { useSetting } from "./hooks";

export type TouchAction = {
  id: string;
  label: string;
  icon?: string;
  /** For toggles (e.g. Minesweeper's flag mode): shown as pressed. */
  active?: boolean;
};

export type TouchLayout = {
  /** Arrow pad / thumb stick on the left. */
  pad?: boolean;
  /** Big buttons on the right. */
  actions?: TouchAction[];
};

/** Short buzz on press, if the device can and the player hasn't turned it off. */
export function useVibrate() {
  const [enabled] = useSetting("vibration");
  return () => {
    if (!enabled) return;
    try {
      navigator.vibrate?.(12);
    } catch {
      // Not allowed (e.g. no user gesture yet): skip silently.
    }
  };
}

const ARROWS: { dir: Direction; label: string; className: string }[] = [
  { dir: "up", label: "↑", className: "col-start-2 row-start-1" },
  { dir: "left", label: "←", className: "col-start-1 row-start-2" },
  { dir: "right", label: "→", className: "col-start-3 row-start-2" },
  { dir: "down", label: "↓", className: "col-start-2 row-start-3" },
];

/**
 * Arrow pad that also works as a thumb stick: the direction follows the
 * finger's angle from the centre, so sliding the thumb steers. Calls
 * `onDirection(dir)` whenever the direction changes and `onDirection(null)`
 * on release. The arrows are real buttons for keyboard and screen readers.
 */
export function DPad({
  onDirection,
  label,
  variant = "inline",
  className = "",
}: {
  onDirection: (dir: Direction | null) => void;
  label: string;
  variant?: "inline" | "overlay";
  className?: string;
}) {
  const vibrate = useVibrate();
  const pointer = useRef<number | null>(null);
  const current = useRef<Direction | null>(null);

  const update = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const dx = event.clientX - (box.left + box.width / 2);
    const dy = event.clientY - (box.top + box.height / 2);
    const dir = directionFromVector(dx, dy, box.width * 0.12);
    if (dir === current.current) return;
    current.current = dir;
    if (dir) vibrate();
    onDirection(dir);
  };

  const release = () => {
    pointer.current = null;
    if (current.current === null) return;
    current.current = null;
    onDirection(null);
  };

  const overlay = variant === "overlay";
  return (
    <div
      role="group"
      aria-label={label}
      data-touch-pad
      className={`grid touch-none grid-cols-3 grid-rows-3 select-none ${
        overlay
          ? "size-38 rounded-full border-2 border-white/35 bg-white/15 p-1.5 text-white shadow-lg backdrop-blur-sm"
          : "size-40 gap-1.5"
      } ${className}`}
      onPointerDown={(event) => {
        if (pointer.current !== null) return;
        event.preventDefault();
        pointer.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        update(event);
      }}
      onPointerMove={(event) => {
        if (event.pointerId === pointer.current) update(event);
      }}
      onPointerUp={(event) => {
        if (event.pointerId === pointer.current) release();
      }}
      onPointerCancel={(event) => {
        if (event.pointerId === pointer.current) release();
      }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {ARROWS.map(({ dir, label: arrow, className: cell }) => (
        <button
          key={dir}
          type="button"
          tabIndex={overlay ? -1 : 0}
          aria-label={`Go ${dir}`}
          className={`${cell} flex items-center justify-center text-2xl font-semibold ${
            overlay ? "rounded-full" : "btn-secondary min-h-13 p-0"
          }`}
          // Pointer presses are handled by the pad; this keeps Enter/Space working.
          onClick={(event) => {
            if (event.detail !== 0) return;
            onDirection(dir);
            onDirection(null);
          }}
        >
          <span aria-hidden="true">{arrow}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * Big round action button ("Boost", "Kick", "Swing"...). Fires on
 * pointerdown with no click delay; each button tracks its own finger, so
 * two can be held at once.
 */
export function ActionButton({
  action,
  onAction,
}: {
  action: TouchAction;
  onAction: (id: string, pressed: boolean) => void;
}) {
  const vibrate = useVibrate();
  const pointer = useRef<number | null>(null);

  const up = () => {
    if (pointer.current === null) return;
    pointer.current = null;
    onAction(action.id, false);
  };

  return (
    <button
      type="button"
      data-touch-action={action.id}
      aria-pressed={action.active}
      className={`flex size-20 touch-none flex-col items-center justify-center rounded-full border-2 font-display text-sm leading-tight font-semibold text-white shadow-lg backdrop-blur-sm select-none active:scale-95 ${
        action.active
          ? "border-white/80 bg-[#ff7a45]/70"
          : "border-white/35 bg-white/15"
      }`}
      onPointerDown={(event) => {
        if (pointer.current !== null) return;
        event.preventDefault();
        pointer.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        vibrate();
        onAction(action.id, true);
      }}
      onPointerUp={up}
      onPointerCancel={up}
      onContextMenu={(event) => event.preventDefault()}
      onClick={(event) => {
        if (event.detail !== 0) return;
        onAction(action.id, true);
        onAction(action.id, false);
      }}
    >
      {action.icon && (
        <span aria-hidden="true" className="text-2xl leading-none">
          {action.icon}
        </span>
      )}
      {action.label}
    </button>
  );
}

/**
 * On-screen controls for fullscreen play on touch screens: pad on the left
 * thumb, actions on the right thumb. The layer itself lets taps through to
 * the game; only the controls catch them.
 */
export default function TouchControls({
  layout,
  onDirection,
  onAction,
}: {
  layout: TouchLayout;
  onDirection?: (dir: Direction | null) => void;
  onAction?: (id: string, pressed: boolean) => void;
}) {
  return (
    <div
      data-touch-controls
      className="pointer-events-none absolute inset-0 z-20"
    >
      {layout.pad && onDirection && (
        <div className="tc-left pointer-events-auto absolute bottom-6">
          <DPad variant="overlay" label="Move" onDirection={onDirection} />
        </div>
      )}
      {layout.actions && layout.actions.length > 0 && onAction && (
        <div className="tc-right pointer-events-auto absolute bottom-20 flex flex-col-reverse gap-3">
          {layout.actions.map((action) => (
            <ActionButton key={action.id} action={action} onAction={onAction} />
          ))}
        </div>
      )}
    </div>
  );
}
