/** Safe localStorage helpers: never throw, even when storage is blocked. */

const CHANGE_EVENT = "rocketgame:storage";

export function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function readJSON<T>(key: string, fallback: T): T {
  const raw = readRaw(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked or full: the site keeps working without persistence.
    return;
  }
  try {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // No event support (e.g. tests); nothing to notify.
  }
}

/** Subscribe to changes from this tab and from other tabs. */
export function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

// Best scores

export function bestKey(slug: string): string {
  return `rocketgame:best:${slug}`;
}

export function parseBest(raw: string | null): number | null {
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

export function readBest(slug: string): number | null {
  return parseBest(readRaw(bestKey(slug)));
}

/** Saves `value` if it beats the stored best. Returns whether it was a new best. */
export function recordBest(
  slug: string,
  value: number,
  direction: "high" | "low",
): boolean {
  const current = readBest(slug);
  const isBetter =
    current === null ||
    (direction === "high" ? value > current : value < current);
  if (isBetter) writeJSON(bestKey(slug), value);
  return isBetter;
}

// Settings

export const SETTINGS_KEY = "rocketgame:settings";

export type Settings = { sound: boolean };

const DEFAULT_SETTINGS: Settings = { sound: true };

export function parseSettings(raw: string | null): Settings {
  if (raw === null) return DEFAULT_SETTINGS;
  try {
    const value = JSON.parse(raw) as Partial<Settings>;
    return {
      sound:
        typeof value.sound === "boolean" ? value.sound : DEFAULT_SETTINGS.sound,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function writeSettings(patch: Partial<Settings>): void {
  writeJSON(SETTINGS_KEY, {
    ...parseSettings(readRaw(SETTINGS_KEY)),
    ...patch,
  });
}
