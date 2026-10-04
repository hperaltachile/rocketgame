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
  type Settings,
} from "@/lib/storage";

/** Raw localStorage value, kept in sync across components and tabs. `null` during SSR. */
export function useStoredRaw(key: string): string | null {
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

/** One on/off setting from `Settings`, with a setter that persists it. */
export function useSetting(
  name: keyof Settings,
): [boolean, (on: boolean) => void] {
  const raw = useStoredRaw(SETTINGS_KEY);
  const value = useMemo(() => parseSettings(raw)[name], [raw, name]);
  const setValue = useCallback(
    (on: boolean) => writeSettings({ [name]: on }),
    [name],
  );
  return [value, setValue];
}

export const useSound = () => useSetting("sound");

/** Live result of a CSS media query; `false` during SSR. */
export function useMediaQuery(query: string): boolean {
  const subscribeQuery = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribeQuery,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export const useReducedMotion = () =>
  useMediaQuery("(prefers-reduced-motion: reduce)");

/** Touch screen as the main input (phones, tablets), not mouse + keyboard. */
export const useCoarsePointer = () => useMediaQuery("(pointer: coarse)");

export const usePortrait = () => useMediaQuery("(orientation: portrait)");
