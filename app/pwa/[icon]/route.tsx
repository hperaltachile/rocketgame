import { ImageResponse } from "next/og";
import { ROCKET_DATA_URI } from "@/lib/og";

/**
 * PNG app icons for the web app manifest ("Add to Home Screen"). Maskable
 * icons keep the rocket inside the safe circle, since phones crop them.
 */
const ICONS = {
  "icon-192.png": { size: 192, maskable: false },
  "icon-512.png": { size: 512, maskable: false },
  "maskable-512.png": { size: 512, maskable: true },
} as const;

type IconName = keyof typeof ICONS;

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(ICONS).map((icon) => ({ icon }));
}

export async function GET(
  _request: Request,
  { params }: RouteContext<"/pwa/[icon]">,
) {
  const { icon } = await params;
  const { size, maskable } = ICONS[icon as IconName];
  const rocket = Math.round(size * (maskable ? 0.56 : 0.78));
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0b1026",
        borderRadius: maskable ? 0 : size * 0.22,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
      <img src={ROCKET_DATA_URI} width={rocket} height={rocket} />
    </div>,
    { width: size, height: size },
  );
}
