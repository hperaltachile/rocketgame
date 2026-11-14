# RocketGame

Quick, free browser mini-games with a rockets-and-space theme — [rocketgame.app](https://rocketgame.app).

Built with Next.js (App Router), TypeScript, Tailwind CSS, Neon Postgres (leaderboards), Phaser 3 (action and platform games), three.js (the 3D runner Star Courier) and plain React (puzzle games).

## Games

| Game             | Engine   | What it is                                                                                                   |
| ---------------- | -------- | ------------------------------------------------------------------------------------------------------------ |
| 🦊 Astro Hop     | Phaser   | Pixel-art platformer: run and jump Kit the space fox through three worlds to the beacon.                     |
| 📦 Star Courier  | three.js | 3D three-lane runner: dodge crates, laser gates and freighters while Gloop the space-jelly chases you.       |
| 🚀 Rocket Run    | Phaser   | Boost through an asteroid field. Gets harder over six sectors: wobbly rocks, rock gates, comets, rock walls. |
| ⚽ Nova Shootout | Phaser   | Pixel-art penalty kicks against Bolt the robot goalie (Easy, Medium, Hard).                                  |
| ⚾ Cosmic Slam   | Phaser   | Pixel-art batting against the Moon Pitcher. Time your swing for hits and home runs.                          |
| 🐍 Snake         | Phaser   | Eat stars, grow longer, don't bite your tail.                                                                |
| 💣 Minesweeper   | React    | 9×9 field, 10 mines, first click always safe.                                                                |
| ⭕ Tic-Tac-Toe   | React    | Easy or Hard (unbeatable) computer.                                                                          |
| 🪐 Memory Match  | React    | Pair up 8 planets in as few moves as you can.                                                                |
| 🔢 2048          | React    | Slide and merge tiles.                                                                                       |

Every game has fullscreen, on-screen touch controls on phones, sound, pause, and a best score saved in the browser. All but Tic-Tac-Toe also have a shared **Top 10** leaderboard, with space names built from word lists (no typing).

## Status

_Last updated 2026-11-14._

- **Live:** all 10 games at [rocketgame.app](https://rocketgame.app), deployed from `main` by Vercel.
- **Leaderboards (in review):** a Top 10 per game, on Neon Postgres (connected in Vercel for Production and Preview). Each deployment creates the tables during its build, so they go live when the PR is merged.
- **Latest release:** **Astro Hop**, a retro platformer with three worlds: Clover Plains, Crystal Caves and Sky Bridges ([#19](https://github.com/hperaltachile/rocketgame/pull/19)).
- **Before that:** **Star Courier**, the first 3D game (three.js, [#15](https://github.com/hperaltachile/rocketgame/pull/15)), with missions, the Hangar shop and records ([#17](https://github.com/hperaltachile/rocketgame/pull/17)).
- **Earlier** ([#13](https://github.com/hperaltachile/rocketgame/pull/13)):
  - Rocket Run got progressive difficulty in sectors.
  - Comet Kick became **Nova Shootout** and Star Slugger became **Cosmic Slam**, both redrawn as retro pixel art.
  - Old links redirect, and saved scores carry over.
- **Open follow-ups:**
  - Try Star Courier on a real phone (swipes, fullscreen, sound).
  - Try Astro Hop on a real phone and with a kid: the touch pad plus Jump and Run buttons, and whether the worlds feel fair. More worlds can be added as rows of text in `lib/games/astro-hop/levels.ts`.
  - `npm audit` still lists 8 moderate warnings in lint-only tooling (`minimatch` under `typescript-eslint`). Update `eslint-config-next` once a fixed `typescript-eslint` ships.
  - Test Nova Shootout and Cosmic Slam on a real iPhone (the WebKit e2e suite needs Playwright, which isn't installed).
  - Old links take two redirects (`/games/comet-kick` → `/games/nova-shootout/` → `/games/nova-shootout`); make it one.
  - Vercel Web Analytics is set up but had recorded no page views as of 2026-10-18. Confirm it counts a real visit.
- **History:** see [CHANGELOG.md](CHANGELOG.md). How to work on the project: [CLAUDE.md](CLAUDE.md).

## Development

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # Vitest unit tests for game logic
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm run format       # Prettier
npm run build        # production build
```

Browser tests (headless Edge) live in `scripts/e2e/`; see CLAUDE.md for how to run them.

Game rules live in `lib/games/<slug>/` as plain TypeScript so they can be tested without React, Phaser or three.js.
