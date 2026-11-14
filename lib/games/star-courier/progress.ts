/**
 * Star Courier progress kept between runs: banked stardust, unlocked
 * couriers and suits, power-up upgrades, mission sets and the courier rank,
 * the Daily Delivery, and the top-5 records. All pure; the page loads and
 * saves it with lib/storage.ts (`rocketgame:star-courier:save`).
 */

import { seeded } from "../rng";
import { POWER_UPS, type PowerUpKind } from "./config";
import { COURIERS, SUIT_PRICE, getCourier, type CourierId } from "./couriers";
import type { RunStats } from "./logic";
import { WORLDS } from "./worlds";

export const SAVE_KEY = "rocketgame:star-courier:save";

// Missions

export type MissionKind =
  | "stardust"
  | "jumps"
  | "slides"
  | "powerUps"
  | "distance"
  | "score"
  | "freighters";

export type Mission = {
  kind: MissionKind;
  /** true: reach the target in a single run. false: add up over runs. */
  oneRun: boolean;
  target: number;
};

type Template = {
  kind: MissionKind;
  oneRun: boolean;
  base: number;
  step: number;
  /** Not offered before this mission set (too hard early on). */
  fromSet: number;
};

const TEMPLATES: readonly Template[] = [
  { kind: "stardust", oneRun: false, base: 150, step: 150, fromSet: 0 },
  { kind: "stardust", oneRun: true, base: 50, step: 35, fromSet: 0 },
  { kind: "jumps", oneRun: false, base: 15, step: 10, fromSet: 0 },
  { kind: "slides", oneRun: false, base: 10, step: 8, fromSet: 0 },
  { kind: "distance", oneRun: true, base: 400, step: 250, fromSet: 0 },
  { kind: "powerUps", oneRun: false, base: 3, step: 2, fromSet: 1 },
  { kind: "score", oneRun: true, base: 600, step: 450, fromSet: 1 },
  { kind: "freighters", oneRun: true, base: 2, step: 1, fromSet: 3 },
];

/** Rounds a target to a friendly number (5, 10, 25, 50...). */
function friendly(n: number): number {
  const unit = n >= 1000 ? 50 : n >= 200 ? 25 : n >= 50 ? 5 : 1;
  return Math.max(1, Math.round(n / unit) * unit);
}

/** The three missions of a mission set; the same set always gives the same three. */
export function missionsFor(set: number): Mission[] {
  const rng = seeded(set * 7919 + 13);
  const pool = TEMPLATES.filter((t) => t.fromSet <= set);
  const chosen: Template[] = [];
  while (chosen.length < 3) {
    const t = pool[Math.floor(rng() * pool.length)];
    if (!chosen.some((c) => c.kind === t.kind)) chosen.push(t);
  }
  return chosen.map((t) => ({
    kind: t.kind,
    oneRun: t.oneRun,
    target: friendly(t.base + t.step * (set - t.fromSet)),
  }));
}

const fmt = (n: number) => n.toLocaleString("en-US");

export function missionText(m: Mission): string {
  const n = fmt(m.target);
  const run = m.oneRun ? " in one run" : "";
  switch (m.kind) {
    case "stardust":
      return `Collect ${n} stardust${run}`;
    case "jumps":
      return `Jump ${n} times${run}`;
    case "slides":
      return `Slide ${n} times${run}`;
    case "powerUps":
      return `Grab ${n} power-ups${run}`;
    case "distance":
      return `Run ${n} m${run}`;
    case "score":
      return `Score ${n} points${run}`;
    case "freighters":
      return `Dodge ${n} freighters${run}`;
  }
}

/** What a finished run counts toward missions. */
export type RunResult = RunStats & { distance: number; score: number };

function amount(kind: MissionKind, r: RunResult): number {
  switch (kind) {
    case "stardust":
      return r.stardust;
    case "jumps":
      return r.jumps;
    case "slides":
      return r.slides;
    case "powerUps":
      return r.powerUps;
    case "distance":
      return Math.floor(r.distance);
    case "score":
      return Math.floor(r.score);
    case "freighters":
      return r.freightersDodged;
  }
}

/** New progress on a mission after a run: added up, or the best single run. */
function advance(m: Mission, progress: number, r: RunResult): number {
  const got = amount(m.kind, r);
  return Math.min(
    m.target,
    m.oneRun ? Math.max(progress, got) : progress + got,
  );
}

// Daily Delivery

export const DAILY_REWARD = 500;

const DAILY: readonly Mission[] = [
  { kind: "stardust", oneRun: true, target: 120 },
  { kind: "slides", oneRun: false, target: 15 },
  { kind: "jumps", oneRun: false, target: 25 },
  { kind: "distance", oneRun: true, target: 900 },
  { kind: "powerUps", oneRun: false, target: 4 },
  { kind: "score", oneRun: true, target: 1200 },
  { kind: "stardust", oneRun: false, target: 300 },
];

/** Local calendar day, like "2026-11-14". */
export function dayKey(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

/** Today's Daily Delivery: the same for everyone on a given day. */
export function dailyMission(day: string): Mission {
  let hash = 0;
  for (const ch of day) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return DAILY[hash % DAILY.length];
}

// Rank and shop

/** The rank multiplier: ×1 to start, +1 for every finished mission set. */
export const MAX_RANK = 29;
export const rankMultiplier = (rank: number) => 1 + Math.min(rank, MAX_RANK);
/** Stardust for finishing mission set `set` (0-based). */
export const setReward = (set: number) => 200 + 100 * set;

export const MAX_UPGRADE = 5;
/** Price of the next upgrade level (level = current level, 0–4). */
export const upgradePrice = (level: number) => 400 * 2 ** level;

// The save

export type TopRun = {
  score: number;
  distance: number;
  courier: CourierId;
  day: string;
};

/** What the last run achieved, for the game-over screen. */
export type LastRun = {
  /** Metres run, so the page can tell this run's results from an older one. */
  distance: number;
  stardust: number;
  missionsDone: string[];
  rankUp: boolean;
  dailyDone: boolean;
  newRecord: boolean;
  newBestDistance: boolean;
};

export type Save = {
  /** Banked stardust, to spend in the Hangar. */
  bank: number;
  owned: CourierId[];
  courier: CourierId;
  /** Suits owned and worn, per courier. */
  suits: Record<CourierId, string[]>;
  wearing: Record<CourierId, string>;
  /** Chosen world, or null for the world of the day. */
  world: string | null;
  upgrades: Record<PowerUpKind, number>;
  /** Mission sets finished (= courier rank). */
  rank: number;
  missionProgress: number[];
  daily: { day: string; progress: number; done: boolean };
  top: TopRun[];
  bestDistance: number;
  last: LastRun | null;
};

export function newSave(): Save {
  return {
    bank: 0,
    owned: ["pip"],
    courier: "pip",
    suits: { pip: ["classic"], zuri: ["classic"], bix: ["classic"] },
    wearing: { pip: "classic", zuri: "classic", bix: "classic" },
    world: null,
    upgrades: { warp: 0, magnet: 0, boots: 0, twin: 0, shield: 0 },
    rank: 0,
    missionProgress: [0, 0, 0],
    daily: { day: "", progress: 0, done: false },
    top: [],
    bestDistance: 0,
    last: null,
  };
}

const int = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER) =>
  typeof v === "number" && Number.isFinite(v)
    ? Math.min(max, Math.max(min, Math.floor(v)))
    : min;
const isCourier = (v: unknown): v is CourierId =>
  COURIERS.some((c) => c.id === v);

/** Reads a save from storage, repairing anything missing or broken. */
export function parseSave(raw: string | null): Save {
  const save = newSave();
  if (raw === null) return save;
  let v: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return save;
    v = parsed as Record<string, unknown>;
  } catch {
    return save;
  }
  save.bank = int(v.bank);
  if (Array.isArray(v.owned))
    save.owned = [
      ...new Set(["pip" as CourierId, ...v.owned.filter(isCourier)]),
    ];
  if (isCourier(v.courier) && save.owned.includes(v.courier))
    save.courier = v.courier;
  for (const c of COURIERS) {
    const ids = c.suits.map((s) => s.id);
    const owned = (v.suits as Record<string, unknown> | undefined)?.[c.id];
    if (Array.isArray(owned))
      save.suits[c.id] = [
        ...new Set([ids[0], ...owned.filter((s) => ids.includes(s))]),
      ];
    const worn = (v.wearing as Record<string, unknown> | undefined)?.[c.id];
    if (typeof worn === "string" && save.suits[c.id].includes(worn))
      save.wearing[c.id] = worn;
  }
  if (typeof v.world === "string" && WORLDS.some((w) => w.id === v.world))
    save.world = v.world;
  for (const k of POWER_UPS)
    save.upgrades[k] = int(
      (v.upgrades as Record<string, unknown> | undefined)?.[k],
      0,
      MAX_UPGRADE,
    );
  save.rank = int(v.rank, 0, MAX_RANK);
  const goals = missionsFor(save.rank);
  if (Array.isArray(v.missionProgress))
    save.missionProgress = goals.map((m, i) =>
      int((v.missionProgress as unknown[])[i], 0, m.target),
    );
  const daily = v.daily as Record<string, unknown> | undefined;
  if (daily && typeof daily.day === "string")
    save.daily = {
      day: daily.day,
      progress: int(daily.progress),
      done: daily.done === true,
    };
  if (Array.isArray(v.top))
    save.top = v.top
      .filter((t): t is Record<string, unknown> => !!t && typeof t === "object")
      .map((t) => ({
        score: int(t.score),
        distance: int(t.distance),
        courier: isCourier(t.courier) ? t.courier : "pip",
        day: typeof t.day === "string" ? t.day : "",
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  save.bestDistance = int(v.bestDistance);
  return save;
}

/** The Daily Delivery state for `day` (a new day starts fresh). */
export function dailyFor(save: Save, day: string) {
  return save.daily.day === day
    ? save.daily
    : { day, progress: 0, done: false };
}

/**
 * Adds a finished run to the save: banks the stardust, moves missions and
 * the Daily Delivery along, ranks up when a set is done, and keeps records.
 */
export function applyRun(save: Save, run: RunResult, day: string): Save {
  const next: Save = structuredClone(save);
  const last: LastRun = {
    distance: Math.floor(run.distance),
    stardust: run.stardust,
    missionsDone: [],
    rankUp: false,
    dailyDone: false,
    newRecord: false,
    newBestDistance: false,
  };
  next.bank += run.stardust;

  const goals = missionsFor(save.rank);
  next.missionProgress = goals.map((m, i) => {
    const before = save.missionProgress[i] ?? 0;
    const after = advance(m, before, run);
    if (before < m.target && after >= m.target)
      last.missionsDone.push(missionText(m));
    return after;
  });
  if (
    goals.every((m, i) => next.missionProgress[i] >= m.target) &&
    save.rank < MAX_RANK
  ) {
    next.bank += setReward(save.rank);
    next.rank = save.rank + 1;
    next.missionProgress = [0, 0, 0];
    last.rankUp = true;
  }

  const daily = dailyFor(save, day);
  const dm = dailyMission(day);
  next.daily = { ...daily };
  if (!daily.done) {
    next.daily.progress = advance(dm, daily.progress, run);
    if (next.daily.progress >= dm.target) {
      next.daily.done = true;
      next.bank += DAILY_REWARD;
      last.dailyDone = true;
    }
  }

  const entry: TopRun = {
    score: Math.floor(run.score),
    distance: Math.floor(run.distance),
    courier: save.courier,
    day,
  };
  if (entry.score > 0) {
    next.top = [...save.top, entry]
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    last.newRecord = next.top.includes(entry);
  }
  if (entry.distance > save.bestDistance) {
    next.bestDistance = entry.distance;
    last.newBestDistance = save.bestDistance > 0;
  }
  next.last = last;
  return next;
}

/** Buying things: each returns the new save, or null if it can't be bought. */
export function buyCourier(save: Save, id: CourierId): Save | null {
  const price = getCourier(id).price;
  if (save.owned.includes(id) || save.bank < price) return null;
  return {
    ...save,
    bank: save.bank - price,
    owned: [...save.owned, id],
    courier: id,
  };
}

export function buySuit(save: Save, id: CourierId, suit: string): Save | null {
  const courier = getCourier(id);
  if (!courier.suits.some((s) => s.id === suit)) return null;
  if (!save.owned.includes(id) || save.suits[id].includes(suit)) return null;
  if (save.bank < SUIT_PRICE) return null;
  return {
    ...save,
    bank: save.bank - SUIT_PRICE,
    suits: { ...save.suits, [id]: [...save.suits[id], suit] },
    wearing: { ...save.wearing, [id]: suit },
  };
}

export function buyUpgrade(save: Save, kind: PowerUpKind): Save | null {
  const level = save.upgrades[kind];
  if (level >= MAX_UPGRADE) return null;
  const price = upgradePrice(level);
  if (save.bank < price) return null;
  return {
    ...save,
    bank: save.bank - price,
    upgrades: { ...save.upgrades, [kind]: level + 1 },
  };
}
