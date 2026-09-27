import { ImageResponse } from "next/og";

/** Same drawing as components/RocketLogo.tsx and app/icon.svg. */
export const ROCKET_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="M26 46c-4 4-4 10-4 12 2 0 8 0 12-4Z" fill="#ffb020"/><path d="M27 45c-2 3-2 6-2 8 2 0 5 0 8-2Z" fill="#ff5a1f"/><path d="M44 8c-10 2-18 10-22 22l-6 2-6 8 10 2 4 4 2 10 8-6 2-6c12-4 20-12 22-22 1-6-8-15-14-14Z" fill="#e8ecff" stroke="#1b2350" stroke-width="2.5" stroke-linejoin="round"/><circle cx="40" cy="24" r="6" fill="#4cc9f0" stroke="#1b2350" stroke-width="2.5"/><path d="M22 30 10 32l-4 8 10-2Z M34 42l-2 12 8-4 2-10Z" fill="#ff5a1f"/></svg>`;

export const ROCKET_DATA_URI = `data:image/svg+xml;base64,${Buffer.from(ROCKET_SVG).toString("base64")}`;

export const OG_SIZE = { width: 1200, height: 630 };

/** Branded 1200×630 social card. */
export function ogCard(title: string, subtitle: string): ImageResponse {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        gap: 56,
        padding: "0 88px",
        color: "#eef1ff",
        backgroundColor: "#0b1026",
        backgroundImage:
          "radial-gradient(circle at 85% 20%, #2b3668 0%, transparent 45%), radial-gradient(circle at 10% 90%, #3b1d6e 0%, transparent 40%)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
      <img src={ROCKET_DATA_URI} width={300} height={300} />
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <div style={{ fontSize: 34, color: "#ff7a45", fontWeight: 700 }}>
          RocketGame
        </div>
        <div
          style={{
            fontSize: 76,
            fontWeight: 700,
            lineHeight: 1.05,
            marginTop: 12,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 34,
            color: "#aab2d8",
            marginTop: 20,
            lineHeight: 1.3,
          }}
        >
          {subtitle}
        </div>
      </div>
    </div>,
    OG_SIZE,
  );
}
