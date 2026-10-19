# Changelog

What changed on RocketGame, newest first. Each entry lists:

- **Features**
- **Fixes**
- **Design decisions** (agreements with the owner, and why)
- **Changes** to existing behaviour

PR numbers link to GitHub. Add an entry in the same PR as the change.

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
