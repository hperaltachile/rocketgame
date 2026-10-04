"use client";

/** Expand / shrink toggle used by every game (48×48, easy for small fingers). */
export default function FullscreenButton({
  active,
  onToggle,
  className = "",
}: {
  active: boolean;
  onToggle: () => void;
  className?: string;
}) {
  const label = active ? "Exit full screen" : "Full screen";
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      title={label}
      data-fullscreen-button
      className={`inline-flex size-12 shrink-0 items-center justify-center rounded-xl border border-white/30 bg-[#0b1026]/60 text-white backdrop-blur transition-transform hover:bg-[#0b1026]/80 active:scale-95 ${className}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="size-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {active ? (
          // Corners pointing in: shrink back.
          <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
        ) : (
          // Corners pointing out: expand.
          <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
        )}
      </svg>
    </button>
  );
}
