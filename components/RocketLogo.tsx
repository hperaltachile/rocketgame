/** Original RocketGame rocket mark. */
export default function RocketLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M26 46c-4 4-4 10-4 12 2 0 8 0 12-4Z" fill="#ffb020" />
      <path d="M27 45c-2 3-2 6-2 8 2 0 5 0 8-2Z" fill="#ff5a1f" />
      <path
        d="M44 8c-10 2-18 10-22 22l-6 2-6 8 10 2 4 4 2 10 8-6 2-6c12-4 20-12 22-22 1-6-8-15-14-14Z"
        fill="#e8ecff"
        stroke="#1b2350"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <circle
        cx="40"
        cy="24"
        r="6"
        fill="#4cc9f0"
        stroke="#1b2350"
        strokeWidth="2.5"
      />
      <path d="M22 30 10 32l-4 8 10-2Z M34 42l-2 12 8-4 2-10Z" fill="#ff5a1f" />
    </svg>
  );
}
