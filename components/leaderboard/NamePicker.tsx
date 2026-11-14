"use client";

import { useId } from "react";
import {
  ADJECTIVES,
  buildName,
  CREATURES,
  NUMBER_MAX,
  NUMBER_MIN,
  randomParts,
  type NameParts,
} from "@/lib/leaderboard/names";

const NUMBERS = Array.from(
  { length: NUMBER_MAX - NUMBER_MIN + 1 },
  (_, i) => NUMBER_MIN + i,
);

const SELECT =
  "min-h-11 w-full rounded-lg border border-line bg-surface px-1 text-sm text-text";

/** Build a space name from word lists. Nothing typed, so it's always safe to show. */
export default function NamePicker({
  parts,
  onChange,
}: {
  parts: NameParts;
  onChange: (parts: NameParts) => void;
}) {
  const id = useId();
  return (
    <fieldset className="mt-3 text-left">
      <legend className="text-sm font-semibold">Build your space name</legend>
      <div className="mt-2 grid grid-cols-[1fr_1fr_3.75rem] gap-2">
        <label htmlFor={`${id}-a`} className="sr-only">
          Word
        </label>
        <select
          id={`${id}-a`}
          className={SELECT}
          value={parts.adjective}
          onChange={(e) =>
            onChange({ ...parts, adjective: Number(e.target.value) })
          }
        >
          {ADJECTIVES.map((word, i) => (
            <option key={word} value={i}>
              {word}
            </option>
          ))}
        </select>
        <label htmlFor={`${id}-c`} className="sr-only">
          Creature
        </label>
        <select
          id={`${id}-c`}
          className={SELECT}
          value={parts.creature}
          onChange={(e) =>
            onChange({ ...parts, creature: Number(e.target.value) })
          }
        >
          {CREATURES.map((word, i) => (
            <option key={word} value={i}>
              {word}
            </option>
          ))}
        </select>
        <label htmlFor={`${id}-n`} className="sr-only">
          Number
        </label>
        <select
          id={`${id}-n`}
          className={SELECT}
          value={parts.number}
          onChange={(e) =>
            onChange({ ...parts, number: Number(e.target.value) })
          }
        >
          {NUMBERS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        className="btn-secondary mt-2 w-full"
        onClick={() => onChange(randomParts())}
      >
        🎲 Surprise me
      </button>
      <p className="sr-only" aria-live="polite">
        Your name: {buildName(parts)}
      </p>
    </fieldset>
  );
}
