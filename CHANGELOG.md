# Changelog

What changed on RocketGame, newest first. Each entry lists:

- **Features**
- **Fixes**
- **Design decisions** (agreements with the owner, and why)
- **Changes** to existing behaviour

PR numbers link to GitHub. Add an entry in the same PR as the change.

## 2026-11-14: Leaderboards

- **Feature: a Top 10 for every game** except Tic-Tac-Toe, shared by everyone who plays.
  - **The board** shows under each game: rank (🥇🥈🥉 for the top three), space name and score, with the player's own row marked "← you".
  - **Saving:** when a finished game makes the Top 10, the game-over screen says "You made the Top 10! 🏆" with a **Save score** button. Play again stays the main button.
  - **Names:** players build a space name from three lists (word, creature, number 1–99, e.g. "Cosmic Fox 42"), or tap 🎲 Surprise me. There are about 160,000 possible names. The browser remembers the name.
  - **One row per player per game:** the server keeps each player's best, and a lower score only updates the name.
- **Backend:** the site's first. Neon Postgres (through the Vercel Marketplace) and one route handler, `app/api/leaderboard/[slug]`:
  - `GET` returns the Top 10, cached at the CDN for 30 s.
  - `POST` saves a score. It checks that the request comes from the site itself, that the name is built from the lists, that the score fits the game, and that the IP has made no more than 10 saves a minute (stored as a salted hash, kept for a day).
  - Without `DATABASE_URL` the API answers 503 and the boards stay hidden, so local dev and the rest of the site work as before.
  - New scripts: `scripts/db/schema.sql`, `migrate.mjs` (creates the tables) and `admin.mjs` (list a board, delete a fake score).
  - **`npm run build` creates the tables first** (`migrate.mjs --if-configured`). Vercel's Neon variables are "sensitive" and can't be pulled to a laptop, but builds can read them, so every deployment sets up its own database. Without a database it skips; if the database can't be reached it warns and the deploy goes on.
- **Fix:** the start, pause and game-over card is now centred with `m-auto` instead of `items-center`. A card taller than the board (the save prompt on a short landscape phone) used to lose its top, with no way to scroll to it.
- **Tests:**
  - Unit tests for the name lists and parsing, the submission checks, Top-10 qualification and rank, and repairing the saved player.
  - New browser suite `scripts/e2e/leaderboard.mjs`: plays 2048 to the end, saves with a built name, checks the board and a reload, and checks that the API refuses bad saves. Tested against a throwaway local Postgres.
- **Design decisions:**
  - **No typed names.** The players are kids (about 8–13): typed nicknames invite real names, schools and rude words, and collecting personal information from under-13s raises COPPA concerns. Word lists make every name safe without moderation.
  - **All-time boards only**, for now. Weekly boards are an easy addition later (the table has `updated_at`).
  - **Tic-Tac-Toe has no board.** Its "Wins" is a running total that only grows with time played.
  - **Cheating:** the games run in the browser, so a determined player can always send a fake score. Score caps per game, the origin check and the rate limit stop casual abuse, and `admin.mjs` removes the rest.
  - **The About page** says what a saved score keeps: the space name and the score, nothing else.

## 2026-11-14: Astro Hop is live

- **Docs:** the README Status lists Astro Hop as the latest release (#19), now live with all 10 games.

## 2026-11-14: Astro Hop, a retro platformer

- **Feature: Astro Hop 🦊**, a side-scrolling pixel-art platformer (Phaser).
  - **Hero:** Kit, a little space fox with a red scarf and a backpack. Run, jump (hold Jump to go higher) and hold Run to go faster.
  - **Three worlds:**
    - 1-1 Clover Plains teaches the basics.
    - 1-2 Crystal Caves has low ceilings, more enemies and Boing frogs.
    - 1-3 Sky Bridges has floating islands, bridges and moving platforms.
  - **Enemies:**
    - Grumbles: stomp them.
    - Shellbots: stomp one into a shell, then kick the shell into other enemies.
    - Boing frogs: they hop around their platform.
  - **Blocks and power-ups:**
    - ⭐ blocks give star coins, a Star Seed (Kit grows big and can break bricks) or a Comet Berry (Kit throws bouncing sparks with Run).
    - Hidden blocks hold extra lives.
    - 100 star coins give an extra life.
  - **Each world ends at a beacon pole:** touching it higher scores more, then Kit boards a rocket that blasts off while the leftover time turns into points.
  - **Also:** a level clock, three lives, a checkpoint in every world, an intro card, floating points, parallax skies, an original chiptune per world and synthesized sounds.
- **Tests:**
  - Unit tests cover the physics (walls, jump height, bridges, moving platforms), blocks, power-ups, enemies, the level flow and the save.
  - Every level is checked to be well formed and reachable without Run.
  - A test autopilot that walks (never runs) plays every world and must reach the beacon with at most one lost life.
  - New browser test `scripts/e2e/hop.mjs`; the game is also in the `fullscreen` suite.
- **Design decisions:**
  - The game was asked for as a copy of a famous plumber platformer. We kept the genre and its classic feel (stomping, bumping blocks, a power-up that makes you big, a goal pole, a level clock) but made everything original and space-themed: no copied characters, names, art, sounds, music or level layouts.
  - Kind to kids:
    - A hit with a Comet Berry only takes the berry away.
    - Coyote time and jump buffering make jumps forgiving.
    - Corner bumps slide past blocks.
    - Every world has a checkpoint.
    - Worlds you reach stay unlocked, so a game over never sends you back to 1-1.
    - Every gap can be cleared without running.
  - Levels are plain text (`lib/games/astro-hop/levels.ts`) so new worlds are easy to add.
- **Changes:**
  - New Astro Hop sounds in `games/shared/sfx.ts`.
  - `TouchLayout` has a new `row` option that puts action buttons side by side. Astro Hop uses it for Jump and Run, so two buttons stay clear of the fullscreen corner buttons on short landscape phones.
  - Astro Hop draws its own retro HUD in the canvas (score, stars, world, time, lives). The page frame only shows the score and best, so the fullscreen HUD doesn't run under the arrow pad.
- **Fixes:** the `fullscreen` e2e suite gave every action button the same finger ID, so games with two buttons failed the multi-touch check.

## 2026-11-14: Security updates

- **Fixes:**
  - Next.js 16.3.6 → 16.4.3 (and `eslint-config-next` to match). This fixes the critical advisory and nine others; most affect features the site doesn't use (image optimisation, `use cache`, server actions), since every page is static.
  - Vitest 5.0.2 → 5.0.5 (two moderate advisories in its mock server, test-only).
  - The lockfile was regenerated, which picks up fixed `vite`, `zod` and `source-map-js`.
  - `npm audit`: from 15 warnings (1 critical, 3 high) to 8 moderate.
- **Changes:** removed `@vitest/coverage-v8`, which nothing used.
- **Design decisions:**
  - We picked the oldest releases that contain the fixes (16.4.3 from 23 October, Vitest 5.0.5 from 15 October), not the newest (16.4.6, 5.1.0), which were under two weeks old.
  - The 8 moderate warnings left are `minimatch` under `typescript-eslint`, used only by the linter on our own glob patterns. No fixed `typescript-eslint` exists yet, and forcing `minimatch` up a major version could break linting.
- **Docs:** the README Status now points at #17 for missions and the Hangar.

## 2026-11-14: Star Courier missions, Hangar and records

- **Features:**
  - **Missions and Courier Rank:** sets of three missions (for example "Slide 20 times" or "Run 1,500 m in one run"). Finishing a set ranks you up: your score multiplier goes up by 1 for good, plus a stardust reward. Sets are the same for everyone and get bigger as you go. Freighter missions wait until freighters are common.
  - **Daily Delivery 📦:** one bonus mission a day, picked from the date, worth ✦500.
  - **The Hangar,** under the board, has four tabs:
    - **Couriers:** unlock Zuri (✦1,500) and Bix (✦3,000), pick a suit (three colour suits each, ✦600), and choose a world or "Daily".
    - **Upgrades:** five levels for each power-up, so it lasts longer; each level costs double the last.
    - **Missions:** the current set and the Daily Delivery, with progress bars.
    - **Records:** best distance and your top 5 runs.
  - **Best-distance beacon:** a golden arch with a waving flag stands on the track at your best distance. Passing it says "New best distance! Keep going!".
  - **Game over** lists missions done, rank ups, the Daily Delivery and new best distances.
- **Changes:**
  - Everything is saved in one key, `rocketgame:star-courier:save`. The save is checked and repaired on load (`parseSave`), so bad or edited values can't break the game. It replaces the separate courier and world keys from the first version, which was never released.
  - Stardust from each run goes into the bank once, when the run ends.
- **Tests:** `progress.test.ts` covers missions, rank ups, the daily mission, the shop and save repair. The browser test unlocks a courier, buys an upgrade and checks that the run is saved.
- **Design decisions:**
  - Everything is bought with stardust earned in the game. There's no real money, no ads and no continues.
  - The Hangar sits under the board, not above it, so the whole board still fits on screen without scrolling.

## 2026-11-14: Star Courier, the first 3D game

- **Feature: Star Courier 📦**, a 3D three-lane runner built with three.js.
  - **Premise:** you're a courier racing parcels along the Ring Rail, a hover-rail around a moon base. Gloop, a giant friendly space-jelly, chases you because it wants a hug. Being caught is a comic jelly hug.
  - **Couriers:** Pip (round helmet, parcel backpack), Zuri (tall, with a streaming scarf) and Bix (a robot on one wheel). Each is a low-poly model built in code.
  - **Moves:** swipe or press arrows/WASD to change lanes, jump (also Space) and slide. Down in mid-air drops you fast. A move pressed up to 0.2 s early still happens (input buffer).
  - **Obstacles:** cargo crates and craters (jump), laser gates (slide), parked cargo pods (go around) and oncoming freighters with a blinking ⚠️ (go around).
  - **Bumps:** small things and side bumps make you stumble, and Gloop catches up; a second stumble within 4 s ends the run. Running head-on into a pod or freighter ends it straight away.
  - **Power-ups,** each with a round timer in the HUD: Warp Dash (fast and unstoppable), Star Magnet (pulls in stardust from every lane), Moon Boots (floaty jumps that clear pods, with a bounce off their roofs), Twin Stars (double points) and Bubble Shield (takes one crash).
  - **Worlds:** Moon Base, Mars Canyon, Ice Moon and Ring Station, each with its own colours, skyline, planet and music. The world changes every day, or pick one on the page.
  - **Feel:** smooth lane changes, squash and stretch, dust and spark particles, camera shake, a field of view that opens up with speed. Stardust pickups ring higher with each one in a row. There's an original looping chiptune per world. Shake, the speed effect and bursts are off with reduced motion.
- **Track:** built from 24 hand-designed chunks across six sectors (Launch Lane, Crater Row, Laser Loop, Pod Park, Freighter Way, Deep Orbit). Each new sector starts with a calm breather and a pixel-font banner. Speed and chunk spacing ease toward a cap.
- **Tests:**
  - Every chunk is checked to be passable from every lane.
  - Moves, bumps and each power-up have unit tests.
  - An autopilot that reacts like a person plays 60 runs: 98% clear the first sector, the median run is about 100 s, and crashes per kilometre rise from the early sectors to Deep Orbit.
  - New browser test `scripts/e2e/courier.mjs`; the game is also in the `fullscreen` suite.
- **Changes:**
  - New `components/ThreeGame.tsx` hosts three.js games the way `PhaserGame` hosts Phaser ones. three.js (about 145 KB gzipped) downloads only after the first Start.
  - New `games/shared/music.ts`: a tiny looping chiptune player.
  - New sounds in `games/shared/sfx.ts`.
  - The About page and `CREDITS.md` now list the game engines (Phaser and three.js, MIT).
  - The README games table and Status list Star Courier.
- **Design decisions:**
  - The game was asked for as a copy-style "train surfer" runner. We kept the genre and the engineering asks, but made the premise, chaser, power-ups and worlds original and space-themed. There's no roof running, hoverboard, jetpack, keys to continue or letter hunt.
  - There are no paid or currency continues: a run ends when it ends, which suits kids.
  - Bumping a crate, gate or crater is a stumble, not the end of the run, to keep it forgiving for kids. Only pods and freighters end a run head-on.

## 2026-10-18: Arcade refresh: Rocket Run sectors, Nova Shootout, Cosmic Slam

- **Feature: Rocket Run gets harder the longer you fly, in sectors.**
  - Speed and time between waves now ease toward a cap (520 px/s, a wave every 0.62 s). Before, they rose in a straight line to a harsher cap (560 px/s, 0.42 s), so there are no sudden jumps now.
  - Six sectors, each adding something new: Launch Pad (rocks), Rock Belt (wobbly rocks), Twin Rocks (rock gates), Comet Alley (fast comets with a blinking ⚠️ warning), Rock Walls (a wall with a gap that slowly narrows to 150 px) and Deep Space (everything).
  - Each new sector shows a pixel-font banner, plays a chime, tints the sky and gives a 1.6 s breather. The HUD shows the sector, and the game-over message says how far you got.
  - Every wave leaves an open gap of at least 140 px.
- **Tests:** the flight rules now live in `stepRun`, shared by the game and a test autopilot. Over 60 autopilot runs, 90%+ clear sector 1, crashes per minute rise every sector (about 0.1 → 2.9), and the median run is about a minute.
- **Feature: Comet Kick is now Nova Shootout ⚽**, redrawn as 16/32-bit style pixel art:
  - Crater Field stadium with a ringed planet, floodlights, an animated alien crowd, and a jumbotron with hints and a lamp per kick.
  - Bolt the robot goalie has idle, ready, dive, jump, cheer and sad frames. A new striker runs up and kicks.
  - Spinning comet ball with a pixel trail, net ripple, star burst, screen flash, confetti and banners (GOAL!, SAVED!, POST!, KICK 3, LAST KICK!, FULL TIME!).
- **Feature: Star Slugger is now Cosmic Slam ⚾**, redrawn the same way:
  - Moonlit ballpark with a giant moon, and a scoreboard with strike and out lamps, score digits and the pitch speed.
  - The Moon Pitcher has a cap and windup, throw and cheer frames. The batter swings through load, contact and follow-through frames.
  - The ball is drawn at seven sizes for perspective. Hits get a star burst; home runs get fireworks, a flash and confetti.
- **Changes:**
  - Old `/games/comet-kick` and `/games/star-slugger` links redirect (308). Saved best scores and the goalie level move to the new names automatically.
  - New shared pixel-art kit (`games/shared/pixel.ts`) and an original 5×7 pixel font (`lib/pixelFont.ts`). The font also draws the logos on the Ready screen (new GameShell `logo` prop).
  - New synthesized sounds: blip, post clang, 8-bit fanfare and a sector chime.
  - In the two sports games, hints and results moved from the floating callout into the canvas. They're still announced to screen readers.
- **Design decisions:**
  - Retro pixel art for the two sports games. Rocket Run keeps its smooth style but shares the pixel banners, so the collection feels consistent.
  - The new names are original: Nova Shootout and Cosmic Slam.
  - Rules, controls and scoring of both sports games are unchanged.

## 2026-10-04: Project docs

- **Docs:**
  - `CLAUDE.md` now holds the architecture, the checklist for adding a game, the agreed design rules and known gotchas.
  - This changelog was started and backfilled from PRs #1–#11.
- **Tests:** the browser test scripts moved into the repo (`scripts/e2e/`), so anyone can run them against local or production.

## 2026-10-03: Star Slugger, plus Safari fixes ([#11](https://github.com/hperaltachile/rocketgame/pull/11))

- **Feature: Star Slugger ⚾ (batting)** against the Moon Pitcher.
  - **Swing:** click or tap, Space or Enter, or the Swing button.
  - **Timing:** perfect = home run (4 points), good = hit (1), a bit off = foul (never strike 3), way off or no swing = strike.
  - **Pitches:** slow, medium and fast. As the score rises, fast pitches get more common and all pitches get up to 25% quicker.
  - **Count:** 3 strikes = an out; 3 outs = game over.
  - **Feedback:** bat crack, crowd cheer, and fireworks plus confetti for home runs.
- **Fix:** Memory Match showed every card face up in Safari, which ignores `backface-visibility` inside buttons. The faces now swap visibility halfway through the flip.
- **Fix:** Phaser canvases took about 1 s to fill the iPhone fullscreen mode, because `refresh()` kept the old size. They now re-measure the parent first, and re-measure before each tap.
- **Fix:** on short landscape phones (750×342) the fullscreen corner buttons overlapped the Kick and Swing buttons.
- **Design decision:** the timing windows are ±35 / 90 / 160 ms, more generous than first planned (±25 / 70 / 130), so kids can actually hit home runs.
- **Change:** in fullscreen, the corners keep only Pause and 🎮 (controls on/off). Sound and Vibration moved to the Paused screen.

## 2026-10-03: Comet Kick ([#10](https://github.com/hperaltachile/rocketgame/pull/10))

- **Feature: Comet Kick ⚽ (penalty kicks)** at Crater Field, against Bolt the robot goalie.
  - **Aim:** tap the goal, or use the arrows or the pad.
  - **Shoot:** stop the power bar. Green is good, weak shots are easy saves, red goes over the bar.
  - **Rounds:** 5 kicks per round; the best is saved as N/5.
  - **Goalie:** Easy, Medium and Hard set how often Bolt reads the shot and how far he reaches. He also gets sharper every kick.
  - **Feedback:** goals get confetti, a net ripple, a jumping crowd and a cheer; misses get "So close!".
- **Feature:** new synthesized sounds: kick, bat crack, whoosh, crowd cheer, "aww".
- **Change:** the Phaser bridge gained an optional `onState` channel, so games can show extra HUD state (counters, messages).
- **Design decision:** sports games stay in the space theme, with made-up names, teams and characters. No real brands, leagues or players.

## 2026-10-03: Fullscreen, touch controls, phones, app install ([#9](https://github.com/hperaltachile/rocketgame/pull/9))

- **Feature: a fullscreen button on every game,** 48×48 at the bottom-right of the game area.
  - It uses the Fullscreen API on the game stage only.
  - iPhone Safari has no element fullscreen, so there the game is pinned over the whole screen and Back exits.
  - Esc, Back and the button all update the icon. Leaving fullscreen pauses.
- **Feature: on-screen touch controls in fullscreen** on touch screens: a pad or thumb stick on the left and action buttons on the right.
  - Multi-touch, no delay, optional vibration, and a show/hide toggle.
  - Hidden with a mouse and keyboard.
- **Feature: boards scale to fit any screen** without stretching or scrolling. DOM game text scales with the board, and Phaser renders at 2× so it stays sharp.
- **Feature:** landscape games ask phones held upright to turn sideways, and lock to landscape where the browser allows it.
- **Feature: installable as an app** (PWA):
  - PNG and maskable icons
  - manifest `id`, `scope` and `orientation`
  - iOS web-app meta
  - safe-area padding for notches
- **Change:**
  - the home page shows big stacked game cards (2 per row on phones, 3 on tablets, 4 on desktop)
  - game pages are tighter on phones (no breadcrumb under 640 px)
  - Start scrolls the game into view
  - Snake's and 2048's arrow pads are now the shared `DPad`, which is also a thumb stick
- **Change:** no page scroll, pull-to-refresh, double-tap or pinch zoom, text selection or long-press menus in the game area while playing.
- **Design decision:** pinch zoom stays enabled on normal pages, for accessibility. There's no service worker or offline mode for now, to avoid stale versions after deploys.

## 2026-09-27: Minesweeper, Tic-Tac-Toe, Memory Match ([#8](https://github.com/hperaltachile/rocketgame/pull/8))

- **Feature: Minesweeper 💣:**
  - 9×9 with 10 mines, and the first click is always safe
  - flag by right-click, the F key or Flag mode
  - timer and best time
- **Feature: Tic-Tac-Toe ⭕:** Easy (random moves) and Hard (minimax, never loses), with a wins/draws/losses tally.
- **Feature: Memory Match 🪐:** 16 cards with flip animations; the best score is the fewest moves.
- **Design decision:** Tic-Tac-Toe defaults to Easy, so kids can win.

## 2026-09-27: Snake ([#7](https://github.com/hperaltachile/rocketgame/pull/7))

- **Feature: Snake 🐍:**
  - eat stars to grow and speed up
  - controls: arrows/WASD, swipes, or an on-screen pad on touch screens
  - smooth movement, sparkles

## 2026-09-27: Rocket Run ([#6](https://github.com/hperaltachile/rocketgame/pull/6))

- **Feature: Rocket Run 🚀,** the first Phaser game:
  - boost through an endless asteroid field, which speeds up over time
  - exhaust trail, moving starfield, crash shake
- **Design decision:**
  - Phaser loads only after the first Start (about 276 KB gzipped, in one shared chunk)
  - art is drawn in code and sounds are synthesized with Web Audio, so there are no files to download or license

## 2026-09-27: Kid-friendly site copy ([#5](https://github.com/hperaltachile/rocketgame/pull/5))

- **Change:** the home, About and search-result text was rewritten for kids aged 8–13. It says the site is "inspired by" Google's little games, and is free, safe and plays in Chrome at school. A not-affiliated notice is on `/about`.
- **Design decision:** the site never mentions or describes its creator; an origin-story line was removed at the owner's request.

## 2026-09-27: 2048 ([#4](https://github.com/hperaltachile/rocketgame/pull/4))

- **Feature: 2048 🔢:**
  - arrows/WASD, swipes and arrow buttons
  - slide and merge animations
  - a screen-reader table of the board

## 2026-09-27: Domain ([#3](https://github.com/hperaltachile/rocketgame/pull/3))

- **Change:** the site moved to `rocketgame.app` (the planned `rocketgame.me` was not available). `www` redirects to the bare domain.

## 2026-09-27: Foundation ([#1](https://github.com/hperaltachile/rocketgame/pull/1), [#2](https://github.com/hperaltachile/rocketgame/pull/2))

- **Feature:**
  - Next.js App Router site: layout, home grid, About page
  - `GameShell` (start, pause and over screens, P/Esc pause, auto-pause)
  - `PhaserGame` wrapper
  - safe localStorage helpers
- **Feature: SEO:**
  - titles, descriptions and an OG image per page
  - sitemap, robots, icon and manifest
  - Vercel Analytics
- **Tooling:** TypeScript strict, Tailwind, ESLint, Prettier, Vitest, and GitHub Actions CI.
