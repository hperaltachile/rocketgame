"use client";

import { useState } from "react";
import { POWER_UPS, powerUpTime } from "@/lib/games/star-courier/config";
import {
  COURIERS,
  SUIT_PRICE,
  getCourier,
} from "@/lib/games/star-courier/couriers";
import {
  DAILY_REWARD,
  MAX_UPGRADE,
  buyCourier,
  buySuit,
  buyUpgrade,
  dailyFor,
  dailyMission,
  missionText,
  missionsFor,
  rankMultiplier,
  setReward,
  upgradePrice,
  type Mission,
  type Save,
} from "@/lib/games/star-courier/progress";
import { WORLDS, type World } from "@/lib/games/star-courier/worlds";
import { POWER_COLORS, POWER_ICONS, POWER_NAMES } from "./names";

const TABS = [
  { id: "couriers", label: "Couriers" },
  { id: "upgrades", label: "Upgrades" },
  { id: "missions", label: "Missions" },
  { id: "records", label: "Records" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const fmt = (n: number) => n.toLocaleString("en-US");

function Progress({ mission, value }: { mission: Mission; value: number }) {
  const done = value >= mission.target;
  return (
    <li className="space-y-1">
      <div className="flex justify-between gap-2 text-sm">
        <span className={done ? "line-through opacity-70" : ""}>
          {done ? "✅ " : ""}
          {missionText(mission)}
        </span>
        <span className="shrink-0 text-muted tabular-nums">
          {fmt(Math.min(value, mission.target))}/{fmt(mission.target)}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={missionText(mission)}
        aria-valuemin={0}
        aria-valuemax={mission.target}
        aria-valuenow={Math.min(value, mission.target)}
        className="h-2 overflow-hidden rounded-full bg-line"
      >
        <div
          className="h-full rounded-full bg-accent"
          style={{
            width: `${(Math.min(value, mission.target) / mission.target) * 100}%`,
          }}
        />
      </div>
    </li>
  );
}

/**
 * The Hangar, shown above the game on the page: pick and unlock couriers,
 * suits and worlds, buy power-up upgrades, and check missions and records.
 */
export default function Hangar({
  save,
  world,
  today,
  onChange,
}: {
  save: Save;
  /** The world that will be played (chosen, or the world of the day). */
  world: World;
  today: string;
  onChange: (save: Save) => void;
}) {
  const [tab, setTab] = useState<Tab>("couriers");
  const buy = (next: Save | null) => next && onChange(next);
  const goals = missionsFor(save.rank);
  const daily = dailyFor(save, today);
  const dm = dailyMission(today);

  return (
    <section
      aria-label="Hangar"
      className="rounded-2xl border border-line bg-surface p-3 sm:p-4"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">Hangar</h2>
        <p className="text-sm font-semibold">
          <span aria-hidden="true">✦ </span>
          {fmt(save.bank)} stardust ·{" "}
          <span title="Your score multiplier">
            Rank {save.rank + 1} (×{rankMultiplier(save.rank)})
          </span>
        </p>
      </div>

      <div
        role="tablist"
        aria-label="Hangar sections"
        className="mb-3 flex flex-wrap gap-2"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`hangar-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls="hangar-panel"
            className={tab === t.id ? "btn-primary" : "btn-secondary"}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div
        id="hangar-panel"
        role="tabpanel"
        aria-labelledby={`hangar-tab-${tab}`}
      >
        {tab === "couriers" && (
          <div className="space-y-4">
            <ul className="grid gap-2 sm:grid-cols-3">
              {COURIERS.map((c) => {
                const owned = save.owned.includes(c.id);
                const chosen = save.courier === c.id;
                return (
                  <li
                    key={c.id}
                    className={`rounded-xl border p-3 ${chosen ? "border-accent" : "border-line"}`}
                  >
                    <p className="font-semibold">
                      <span aria-hidden="true">{c.icon}</span> {c.name}
                    </p>
                    <p className="mt-1 text-sm text-muted">{c.blurb}</p>
                    {owned ? (
                      <>
                        <button
                          type="button"
                          aria-pressed={chosen}
                          className={`mt-2 w-full ${chosen ? "btn-primary" : "btn-secondary"}`}
                          onClick={() => onChange({ ...save, courier: c.id })}
                        >
                          {chosen ? "Running" : "Choose"}
                        </button>
                        <div
                          role="group"
                          aria-label={`${c.name}'s suits`}
                          className="mt-2 flex flex-wrap gap-2"
                        >
                          {c.suits.map((s) => {
                            const has = save.suits[c.id].includes(s.id);
                            const wearing = save.wearing[c.id] === s.id;
                            return (
                              <button
                                key={s.id}
                                type="button"
                                aria-pressed={wearing}
                                disabled={!has && save.bank < SUIT_PRICE}
                                title={
                                  has
                                    ? s.name
                                    : `${s.name}: ${SUIT_PRICE} stardust`
                                }
                                className={`flex min-h-11 items-center gap-1.5 rounded-lg border px-2 text-sm disabled:opacity-50 ${wearing ? "border-accent font-semibold" : "border-line"}`}
                                onClick={() =>
                                  has
                                    ? onChange({
                                        ...save,
                                        wearing: {
                                          ...save.wearing,
                                          [c.id]: s.id,
                                        },
                                      })
                                    : buy(buySuit(save, c.id, s.id))
                                }
                              >
                                <span
                                  aria-hidden="true"
                                  className="size-4 rounded-full border border-line"
                                  style={{
                                    background: `linear-gradient(135deg, ${s.colors.suit} 50%, ${s.colors.accent} 50%)`,
                                  }}
                                />
                                {s.name}
                                {!has && (
                                  <span className="text-muted">
                                    ✦{SUIT_PRICE}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={save.bank < c.price}
                        className="btn-secondary mt-2 w-full disabled:opacity-50"
                        onClick={() => buy(buyCourier(save, c.id))}
                      >
                        Unlock for ✦{fmt(c.price)}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
            <div>
              <h3 className="mb-2 text-sm font-semibold">
                World{" "}
                <span className="font-normal text-muted">
                  ({save.world ? "your pick" : "world of the day"})
                </span>
              </h3>
              <div
                role="group"
                aria-label="World"
                className="flex flex-wrap gap-2"
              >
                <button
                  type="button"
                  aria-pressed={save.world === null}
                  className={
                    save.world === null ? "btn-primary" : "btn-secondary"
                  }
                  onClick={() => onChange({ ...save, world: null })}
                >
                  Daily
                </button>
                {WORLDS.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    aria-pressed={save.world === w.id}
                    title={w.blurb}
                    className={
                      save.world === w.id ? "btn-primary" : "btn-secondary"
                    }
                    onClick={() => onChange({ ...save, world: w.id })}
                  >
                    {w.name}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-sm text-muted">
                Next run: {world.name}. {world.blurb}
              </p>
            </div>
          </div>
        )}

        {tab === "upgrades" && (
          <ul className="space-y-2">
            {POWER_UPS.map((kind) => {
              const level = save.upgrades[kind];
              const maxed = level >= MAX_UPGRADE;
              const price = upgradePrice(level);
              return (
                <li
                  key={kind}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-3"
                >
                  <span aria-hidden="true" className="text-2xl">
                    {POWER_ICONS[kind]}
                  </span>
                  <div className="min-w-32 flex-1">
                    <p className="font-semibold">{POWER_NAMES[kind]}</p>
                    <p className="text-sm text-muted">
                      Lasts{" "}
                      {powerUpTime(kind, level).toFixed(1).replace(/\.0$/, "")}{" "}
                      s
                      {!maxed &&
                        ` → ${powerUpTime(kind, level + 1)
                          .toFixed(1)
                          .replace(/\.0$/, "")} s`}
                    </p>
                    <div
                      className="mt-1 flex gap-1"
                      role="img"
                      aria-label={`Level ${level} of ${MAX_UPGRADE}`}
                    >
                      {Array.from({ length: MAX_UPGRADE }, (_, i) => (
                        <span
                          key={i}
                          className="h-2 w-5 rounded-full"
                          style={{
                            background:
                              i < level ? POWER_COLORS[kind] : "var(--line)",
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={maxed || save.bank < price}
                    className="btn-secondary disabled:opacity-50"
                    onClick={() => buy(buyUpgrade(save, kind))}
                  >
                    {maxed ? "Maxed out!" : `Upgrade ✦${fmt(price)}`}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {tab === "missions" && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold">
                Mission set {save.rank + 1}
              </h3>
              <p className="mb-2 text-sm text-muted">
                Finish all three to reach rank {save.rank + 2}: your score
                multiplier goes up to ×{rankMultiplier(save.rank + 1)}, plus ✦
                {fmt(setReward(save.rank))}.
              </p>
              <ul className="space-y-2">
                {goals.map((m, i) => (
                  <Progress
                    key={i}
                    mission={m}
                    value={save.missionProgress[i] ?? 0}
                  />
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold">📦 Daily Delivery</h3>
              <p className="mb-2 text-sm text-muted">
                {daily.done
                  ? "Delivered today! A new one arrives tomorrow."
                  : `A new job every day. Reward: ✦${fmt(DAILY_REWARD)}.`}
              </p>
              <ul>
                <Progress
                  mission={dm}
                  value={daily.done ? dm.target : daily.progress}
                />
              </ul>
            </div>
          </div>
        )}

        {tab === "records" && (
          <div className="space-y-2">
            <p className="text-sm">
              Best distance:{" "}
              <strong>
                {save.bestDistance ? `${fmt(save.bestDistance)} m` : "—"}
              </strong>{" "}
              <span className="text-muted">
                (look for the golden arch on the track!)
              </span>
            </p>
            {save.top.length ? (
              <table className="w-full text-sm">
                <caption className="sr-only">Your top 5 runs</caption>
                <thead>
                  <tr className="text-left text-muted">
                    <th className="py-1 font-normal">#</th>
                    <th className="py-1 font-normal">Score</th>
                    <th className="py-1 font-normal">Distance</th>
                    <th className="py-1 font-normal">Courier</th>
                    <th className="py-1 font-normal">Day</th>
                  </tr>
                </thead>
                <tbody>
                  {save.top.map((t, i) => (
                    <tr key={i} className="border-t border-line">
                      <td className="py-1">{i + 1}</td>
                      <td className="py-1 font-semibold tabular-nums">
                        {fmt(t.score)}
                      </td>
                      <td className="py-1 tabular-nums">{fmt(t.distance)} m</td>
                      <td className="py-1">{getCourier(t.courier).name}</td>
                      <td className="py-1 text-muted">{t.day}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-muted">
                No runs yet. Go deliver some parcels!
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
