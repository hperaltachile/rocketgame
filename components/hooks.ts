"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  bestKey,
  parseBest,
  parseSettings,
  readRaw,
  SETTINGS_KEY,
  subscribe,
  writeSettings,
} from "@/lib/storage";

/** Raw localStorage value, kept in sync across components and tabs. `null` during SSR. */
function useStoredRaw(key: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => readRaw(key),
    () => null,
  );
}

export function useBest(slug: string): number | null {
  const raw = useStoredRaw(bestKey(slug));
  return useMemo(() => parseBest(raw), [raw]);
}

export function useSound(): [boolean, (on: boolean) => void] {
  const raw = useStoredRaw(SETTINGS_KEY);
  const sound = useMemo(() => parseSettings(raw).sound, [raw]);
  const setSound = useCallback(
    (on: boolean) => writeSettings({ sound: on }),
    [],
  );
  return [sound, setSound];
}

function subscribeReducedMotion(onChange: () => void): () => void {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}
