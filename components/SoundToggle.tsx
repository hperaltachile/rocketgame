"use client";

import { useSound } from "./hooks";

export default function SoundToggle() {
  const [sound, setSound] = useSound();
  return (
    <button
      type="button"
      className="btn-secondary"
      aria-pressed={sound}
      aria-label="Sound"
      title={sound ? "Mute sound" : "Turn sound on"}
      onClick={() => setSound(!sound)}
    >
      <span aria-hidden="true">{sound ? "🔊" : "🔇"}</span>
    </button>
  );
}
