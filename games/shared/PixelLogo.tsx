import { GLYPH_H, textPixels, textWidth } from "@/lib/pixelFont";

/**
 * A game title in the RocketGame pixel font, as crisp SVG: gradient letters
 * with a dark outline and drop shadow, matching the in-game banners. Lines
 * are centred; `colors` run from the top of the letters to the bottom.
 */
export default function PixelLogo({
  lines,
  colors,
  className,
}: {
  lines: string[];
  colors: [string, string, string];
  className?: string;
}) {
  const width = Math.max(...lines.map(textWidth));
  const lineH = GLYPH_H + 3;
  const height = lines.length * lineH;
  const id = `pixel-logo-${lines.join("-").replace(/[^a-z0-9]/gi, "")}`;
  const pixels = lines.flatMap((line, row) => {
    const dx = Math.floor((width - textWidth(line)) / 2);
    return textPixels(line).map((p) => ({ x: p.x + dx, y: p.y + row * lineH }));
  });
  const rects = (dx: number, dy: number, fill: string) =>
    pixels.map((p, i) => (
      <rect
        key={i}
        x={p.x + dx}
        y={p.y + dy}
        width={1.02}
        height={1.02}
        fill={fill}
      />
    ));
  const outline = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
    [-1, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
  ];
  return (
    <svg
      viewBox={`-2 -2 ${width + 4} ${height + 3}`}
      className={className}
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id={id}
          x1="0"
          y1="0"
          x2="0"
          y2={lineH}
          gradientUnits="userSpaceOnUse"
          spreadMethod="repeat"
        >
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.12" stopColor={colors[0]} />
          <stop offset="0.45" stopColor={colors[1]} />
          <stop offset="0.75" stopColor={colors[2]} />
        </linearGradient>
      </defs>
      <g fill="#05030f">{rects(1, 2, "#05030f")}</g>
      {outline.map(([dx, dy]) => (
        <g key={`${dx},${dy}`}>{rects(dx, dy, "#140c2c")}</g>
      ))}
      <g>{rects(0, 0, `url(#${id})`)}</g>
    </svg>
  );
}
