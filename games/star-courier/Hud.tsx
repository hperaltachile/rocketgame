"use client";

import { useEffect, useState } from "react";
import PixelLogo from "../shared/PixelLogo";
import type { CourierState } from "./createGame";
import { POWER_COLORS, POWER_ICONS, POWER_NAMES } from "./names";

/** A round countdown for one power-up: the ring empties as time runs out. */
function PowerTimer({
  kind,
  left,
}: {
  kind: CourierState["power"][number]["kind"];
  left: number;
}) {
  const r = 18;
  const around = 2 * Math.PI * r;
  return (
    <div
      className="relative size-11 sm:size-12"
      title={POWER_NAMES[kind]}
      aria-label={`${POWER_NAMES[kind]}: ${Math.ceil(left * 100)}% left`}
      role="img"
    >
      <svg viewBox="0 0 44 44" className="size-full -rotate-90">
        <circle cx="22" cy="22" r={r} fill="#0b1026cc" />
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke={POWER_COLORS[kind]}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={around}
          strokeDashoffset={around * (1 - left)}
        />
      </svg>
      <span
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-center text-lg sm:text-xl"
      >
        {POWER_ICONS[kind]}
      </span>
    </div>
  );
}

/** What's drawn over the 3D view: power-up timers, sector banners and toasts. */
export default function Hud({ state }: { state: CourierState | null }) {
  /** The last message whose time on screen is up. */
  const [doneId, setDoneId] = useState(0);
  const id = state?.messageId ?? 0;
  const big = state?.banner ?? false;

  // Show each new message for a moment, then hide it.
  useEffect(() => {
    if (!id) return;
    const t = setTimeout(() => setDoneId(id), big ? 2200 : 1600);
    return () => clearTimeout(t);
  }, [id, big]);

  const text = id && id !== doneId ? (state?.message ?? "") : "";
  return (
    <div className="pointer-events-none absolute inset-0 z-10 select-none">
      <div className="absolute top-2 right-2 flex flex-col gap-1.5 sm:top-3 sm:right-3">
        {state?.power.map((p) => (
          <PowerTimer key={p.kind} kind={p.kind} left={p.left} />
        ))}
      </div>
      {state && state.multiplier > 1 && (
        <div className="absolute top-2 left-2 rounded-full bg-[#0b1026cc] px-2.5 py-1 font-display text-sm font-semibold text-[#ffe066] sm:top-3 sm:left-3">
          ×{state.multiplier}
        </div>
      )}
      {text &&
        (big ? (
          <div className="absolute inset-x-0 top-[18%] flex justify-center px-4">
            <PixelLogo
              lines={text.split(": ")}
              colors={["#fff3b0", "#ffb547", "#ff5e3a"]}
              className="animate-pop w-full max-w-72 drop-shadow-lg"
            />
          </div>
        ) : (
          <div className="absolute inset-x-0 top-3 flex justify-center px-14">
            <p className="rounded-full bg-[#0b1026d9] px-3 py-1 text-center text-sm font-semibold text-white shadow sm:text-base">
              {text}
            </p>
          </div>
        ))}
    </div>
  );
}
