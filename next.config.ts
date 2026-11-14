import type { NextConfig } from "next";
import { RENAMED_SLUGS } from "./lib/games/registry";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      // Arcade-physics-only build: we don't use Matter.js.
      phaser: "phaser/dist/phaser-arcade-physics.min.js",
    },
  },
  // Renamed games keep their old links working.
  // Two rules per game: with `:path*` alone, the bare page redirected to
  // `/games/<new>/` and then again to drop the trailing slash.
  redirects() {
    return Object.entries(RENAMED_SLUGS).flatMap(([from, to]) => [
      {
        source: `/games/${from}`,
        destination: `/games/${to}`,
        permanent: true,
      },
      {
        source: `/games/${from}/:path+`,
        destination: `/games/${to}/:path+`,
        permanent: true,
      },
    ]);
  },
};

export default nextConfig;
