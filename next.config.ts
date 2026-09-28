import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      // Arcade-physics-only build: we don't use Matter.js.
      phaser: "phaser/dist/phaser-arcade-physics.min.js",
    },
  },
};

export default nextConfig;
