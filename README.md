# RocketGame

Quick, free browser mini-games with a rockets-and-space theme — [rocketgame.app](https://rocketgame.app).

Built with Next.js (App Router), TypeScript, Tailwind CSS, Neon Postgres (leaderboards), Phaser 3 (action and platform games), three.js (the 3D runner Star Courier) and plain React (puzzle games).

## Games

| Game                  | Engine   | What it is                                                                                                   |
| --------------------- | -------- | ------------------------------------------------------------------------------------------------------------ |
| 🔦 Hide & Seek: Mazes | Phaser   | Top-down stealth: hide from Peeka the robot in moonbase houses for 1:45, round after round.                  |
| 🦊 Astro Hop          | Phaser   | Pixel-art platformer: run and jump Kit the space fox through three worlds to the beacon.                     |
| 📦 Star Courier       | three.js | 3D three-lane runner: dodge crates, laser gates and freighters while Gloop the space-jelly chases you.       |
| 🚀 Rocket Run         | Phaser   | Boost through an asteroid field. Gets harder over six sectors: wobbly rocks, rock gates, comets, rock walls. |
| ⚽ Nova Shootout      | Phaser   | Pixel-art penalty kicks against Bolt the robot goalie (Easy, Medium, Hard).                                  |
| ⚾ Cosmic Slam        | Phaser   | Pixel-art batting against the Moon Pitcher. Time your swing for hits and home runs.                          |
| 🐍 Snake              | Phaser   | Eat stars, grow longer, don't bite your tail.                                                                |
| 💣 Minesweeper        | React    | 9×9 field, 10 mines, first click always safe.                                                                |
| ⭕ Tic-Tac-Toe        | React    | Easy or Hard (unbeatable) computer.                                                                          |
| 🪐 Memory Match       | React    | Pair up 8 planets in as few moves as you can.                                                                |
| 🔢 2048               | React    | Slide and merge tiles.                                                                                       |

Every game has fullscreen, on-screen touch controls on phones, sound, pause, and a best score saved in the browser. All but Tic-Tac-Toe also have a shared **Top 10** leaderboard, with space names built from word lists (no typing).

## Status

_Last updated 2026-11-14._

- **Live:** 11 games at [rocketgame.app](https://rocketgame.app), deployed from `main` by Vercel. Hide & Seek: Mazes' three houses and smoother seeker are in review on branch `feat/hide-and-seek-houses`.
- **Latest release:** **Leaderboards**, a shared Top 10 for every game except Tic-Tac-Toe, on Neon Postgres. Space names are built from word lists, so there's no typing ([#21](https://github.com/hperaltachile/rocketgame/pull/21)).
- **Before that:** **Astro Hop**, a retro platformer with three worlds: Clover Plains, Crystal Caves and Sky Bridges ([#19](https://github.com/hperaltachile/rocketgame/pull/19)).
- **Also:** **Star Courier**, the first 3D game (three.js, [#15](https://github.com/hperaltachile/rocketgame/pull/15)), with missions, the Hangar shop and records ([#17](https://github.com/hperaltachile/rocketgame/pull/17)).
- **Earlier** ([#13](https://github.com/hperaltachile/rocketgame/pull/13)):
  - Rocket Run got progressive difficulty in sectors.
  - Comet Kick became **Nova Shootout** and Star Slugger became **Cosmic Slam**, both redrawn as retro pixel art.
  - Old links redirect, and saved scores carry over.
- **Open follow-ups:**
  - Play Hide & Seek: Mazes with a kid and on a real phone: is round 1 winnable but not trivial, are the thumb stick and the Hide button comfortable, are the "?"/"!" cues and the ✓ marks understood? Tune `lib/games/hide-and-seek/config.ts` (the balance tests guard the curve).
  - Hide & Seek: separate music and sound-effect volume sliders (the brief asked for them; every game uses the site-wide sound switch for now).
  - Try Star Courier on a real phone (swipes, fullscreen, sound).
  - Try Astro Hop on a real phone and with a kid: the touch pad plus Jump and Run buttons, and whether the worlds feel fair. More worlds can be added as rows of text in `lib/games/astro-hop/levels.ts`.
  - Play a few games on a real phone and save a score to the Top 10 (all testing so far used emulated phones).
  - Test Nova Shootout and Cosmic Slam on a real iPhone. They pass the Safari-engine suite (`webkit.mjs`, iPhone portrait and landscape), but only a real device can check touch feel and sound.
  - Open rocketgame.app in a normal browser (not headless, no ad blocker) and confirm the visit shows up in Vercel Web Analytics. The setup is verified: analytics is on, its script loads and queues a page view. The script deliberately ignores headless browsers, so automated tests can't finish the check.
  - Remove the `minimatch` override in `package.json` once `typescript-eslint` depends on minimatch 11 itself.
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
