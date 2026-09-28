"use client";

import type { ReactNode } from "react";

/**
 * Fixed-aspect box for a Phaser canvas. Before the first Start it shows a
 * lightweight poster instead, so Phaser only downloads when someone plays.
 */
export default function Stage({
  aspect,
  loaded,
  poster,
  children,
}: {
  aspect: string;
  loaded: boolean;
  poster: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className="relative w-full touch-none overflow-hidden rounded-2xl bg-[#0b1026] ring-2 ring-line select-none"
      style={{ aspectRatio: aspect }}
    >
      {loaded ? (
        <div className="absolute inset-0">{children}</div>
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center text-7xl"
          style={{
            backgroundImage:
              "radial-gradient(1.5px 1.5px at 20% 30%, #fff8, transparent), radial-gradient(1px 1px at 70% 60%, #fff8, transparent), radial-gradient(1.5px 1.5px at 45% 80%, #fff6, transparent), radial-gradient(1px 1px at 85% 20%, #fff8, transparent), radial-gradient(circle at 80% 10%, #2b3668, transparent 50%)",
          }}
        >
          {poster}
        </div>
      )}
    </div>
  );
}
