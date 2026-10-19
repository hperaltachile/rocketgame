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
  redirects() {
    return Object.entries(RENAMED_SLUGS).map(([from, to]) => ({
      source: `/games/${from}/:path*`,
      destination: `/games/${to}/:path*`,
      permanent: true,
    }));
  },
};

export default nextConfig;
