# RocketGame

Quick, free browser mini-games with a rockets-and-space theme — [rocketgame.app](https://rocketgame.app).

Built with Next.js (App Router), TypeScript, Tailwind CSS, Phaser 3 (action games) and plain React (puzzle games).

## Games

| Game             | Engine | What it is                                                                                                   |
| ---------------- | ------ | ------------------------------------------------------------------------------------------------------------ |
| 🚀 Rocket Run    | Phaser | Boost through an asteroid field. Gets harder over six sectors: wobbly rocks, rock gates, comets, rock walls. |
| ⚽ Nova Shootout | Phaser | Pixel-art penalty kicks against Bolt the robot goalie (Easy, Medium, Hard).                                  |
| ⚾ Cosmic Slam   | Phaser | Pixel-art batting against the Moon Pitcher. Time your swing for hits and home runs.                          |
| 🐍 Snake         | Phaser | Eat stars, grow longer, don't bite your tail.                                                                |
| 💣 Minesweeper   | React  | 9×9 field, 10 mines, first click always safe.                                                                |
| ⭕ Tic-Tac-Toe   | React  | Easy or Hard (unbeatable) computer.                                                                          |
| 🪐 Memory Match  | React  | Pair up 8 planets in as few moves as you can.                                                                |
| 🔢 2048          | React  | Slide and merge tiles.                                                                                       |

Every game has fullscreen, on-screen touch controls on phones, sound, pause, and a best score saved in the browser.

## Status

_Last updated 2026-10-18._

- **Live:** all 8 games at [rocketgame.app](https://rocketgame.app), deployed from `main` by Vercel.
- **Latest release** ([#13](https://github.com/hperaltachile/rocketgame/pull/13)):
  - Rocket Run got progressive difficulty in sectors.
  - Comet Kick became **Nova Shootout** and Star Slugger became **Cosmic Slam**, both redrawn as retro pixel art.
  - Old links redirect, and saved scores carry over.
- **Open follow-ups:**
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

Game rules live in `lib/games/<slug>/` as plain TypeScript so they can be tested without React or Phaser.
