@AGENTS.md

# RocketGame: working notes

Free, safe browser mini-games for kids (about 8–13) with a space theme, live at https://rocketgame.app.

This file is the source of truth for how to work on the project: architecture, agreed design rules, and the lessons behind them. History (what changed, when, and why) lives in `CHANGELOG.md`.

**Keep both up to date in the same PR as the change.**
- New feature, fix or design decision → add a `CHANGELOG.md` entry.
- New rule, pattern or gotcha → update this file.

## Commands

```bash
npm run dev            # http://localhost:3000
npm run lint           # ESLint
npm run typecheck      # next typegen && tsc --noEmit
npm run format:check   # Prettier (npm run format to fix)
npm test               # Vitest: pure game rules in lib/**
npm run build          # production build
```

CI (`.github/workflows/ci.yml`) runs lint, typecheck, format:check and test on every PR.

**Browser tests** (`scripts/e2e/`) drive headless Edge over the DevTools protocol against a running site.

```bash
npm run build && npx next start -p 3123          # in one terminal
node scripts/e2e/cdp.mjs scripts/e2e/fullscreen.mjs
BASE=https://rocketgame.app node scripts/e2e/cdp.mjs scripts/e2e/kick.mjs
```

- **Suites:**
  - `fullscreen` covers every game; `GAMES=snake,2048` limits it.
  - Per game: `rocket`, `snake`, `2048`, `puzzles`, `kick`, `slugger`.
  - Also `home` (layout, JS size, PWA) and `copy` (site text).
- **Run `fullscreen` one game at a time** (a loop over `GAMES=<slug>`). Headless Chrome refuses a second native-fullscreen request in the same tab.
- **Screenshots** go to `scripts/e2e/out/` (git-ignored).
- **Safari engine:** `webkit.mjs` uses Playwright WebKit (not a dependency; see its header).

## Deploying

- **Flow:** branch → PR (CI plus a Vercel preview URL) → squash-merge to `main`. Vercel then deploys production automatically.
- **Vercel project:** `hperaltachiles-projects/rocketgame`.
- **Domains:** `rocketgame.app`, plus `www`, which 308-redirects to the bare domain.
- **Logins:** never put tokens, passwords or keys in the repo. If a CLI needs a login (`gh auth login`, `vercel login`), stop and ask the owner to do it.
- **On Windows:** `gh` is at `C:\Program Files\GitHub CLI\gh.exe` and is not on the Git Bash PATH.

## Architecture

| Where | What |
|---|---|
| `lib/games/registry.ts` | Every game: slug, name, tagline, description, icon, engine, best-score rule. Drives the home grid, the routes, the sitemap and the OG images. |
| `lib/games/<slug>/logic.ts` (+ `.test.ts`) | Pure rules. No React, Phaser or DOM, and `rng` is injectable. Every game has unit tests. |
| `components/GameShell.tsx` | The frame every game uses (details below). |
| `components/fullscreen/` | `useFullscreen` (native Fullscreen API, falling back to a "pseudo" fixed overlay on iPhone, where Back exits) and `FullscreenButton`. |
| `components/TouchControls.tsx` | `DPad` (arrow pad that is also a thumb stick), `ActionButton`, and the `TouchControls` layer. Multi-touch, fires on pointerdown, vibrates. |
| `components/GameLoader.tsx` | One `next/dynamic` chunk per game. Phaser games use `ssr: false`. |
| `components/PhaserGame.tsx` | Creates and destroys a `Phaser.Game`, and re-fits it on resize. |
| `games/shared/` | Phaser glue: `bridge.ts` (React ↔ scene commands, plus score/over/state callbacks), `usePhaserShell.ts`, `phaserConfig.ts`, `Stage.tsx` (the poster shown until Phaser loads), `sfx.ts` (Web Audio sounds). |
| `games/<slug>/` | The page component, plus `scenes.ts` and `createGame.ts` for Phaser games. |
| `lib/storage.ts` | localStorage that never throws: best scores (`rocketgame:best:<slug>`) and settings (`rocketgame:settings`: sound, touchControls, vibration). |

**GameShell** handles, for every game:
- the start, paused and game-over screens
- the score, stats and best score
- P and Esc to pause, plus auto-pause when the tab is hidden, when fullscreen is left, or when the rotate prompt appears
- blocking page scroll while playing (`html.is-playing`)
- the fullscreen stage and button, the fullscreen HUD and the touch controls
- the "turn your phone sideways" prompt
- callouts over the board, and how-to-play

**Engines:**
- **Phaser 3.90**, pinned and aliased to the arcade-physics build in `next.config.ts`:
  - Used for Rocket Run, Snake, Comet Kick and Star Slugger.
  - Phaser is downloaded only after the first Start.
- **Plain React** for 2048, Minesweeper, Tic-Tac-Toe and Memory Match.

### Adding a game (checklist)

1. Add pure rules and tests in `lib/games/<slug>/`.
2. Add a registry entry: original name, a kid-friendly tagline and description, and an emoji icon.
3. Add a `GameLoader` entry (`ssr: false` for Phaser).
4. Build the component on `GameShell` (or `usePhaserShell` + `Stage` + `PhaserGame`) and set:
   - `aspect`, plus `maxWidth` for wide games
   - `landscape` if it plays best sideways
   - `touch` (pad and/or actions: only what the game needs), with `onDirection`/`onAction`
   - `howToPlay`
   - `hasSound` if it has sound
5. Keyboard: arrows/WASD via `KEY_DIRECTIONS` (`lib/input.ts`). Space and Enter must not fire while a button has focus.
6. Phaser scenes:
   - call `fitCamera(this, W, H)`
   - draw textures with `bake()` and show them with `.setScale(HI)`
   - listen through `bridge.listen` and report through `onScore`/`onOver`/`onState`
7. Sounds go in `games/shared/sfx.ts` (synthesized only).
8. Update `CREDITS.md` and the About credits if anything new is used, add a `CHANGELOG.md` entry, and run the `fullscreen` e2e suite for the game.

## Design rules (agreed with the owner)

- **Audience is kids.** Use simple, friendly words ("So close!", not "Miss"), big tap targets (44 px or more; touch controls 64–80 px) and generous timing.
- **No creator references.** Never mention or describe the site's creator, or where they live, anywhere in the site copy.
- **Original content only:**
  - No real brands, logos, leagues, teams, players, celebrities or recognisable characters. No copied art, sounds, music or fonts.
  - Made-up names are fine (Comet Kick, Bolt the robot goalie, Crater Field, Star Slugger, the Moon Pitcher).
  - Art is drawn in code and sounds are synthesized; fonts are OFL (Geist, Fredoka).
  - Any third-party asset must be CC0 or properly licensed, and listed in `CREDITS.md` and on `/about`.
- **Google mentions.** The site copy says it is "inspired by" Google's little games, with a not-affiliated notice on `/about`. This is owner-approved; no Google logos or art.
- **Space theme:**
  - dark navy `#0b1026` stages
  - orange accent (`--accent`), purple second accent
  - stars, planets and friendly aliens and robots
- **Accessibility:**
  - visible focus
  - `prefers-reduced-motion` respected (no shake, confetti or fireworks)
  - screen-reader announcements (`role=status`)
  - roving focus on grid games
- **Phones:**
  - no horizontal scroll at 360 px
  - the board fits the screen without scrolling
  - no pull-to-refresh, zoom, text selection or long-press menus in the game area
  - pinch zoom stays enabled on normal pages
- **Budgets:**
  - home page JS under 150 KB gzipped
  - Lighthouse 90+ (80+ on Phaser pages)
  - games load only when opened
- **Fullscreen corners on short landscape phones only fit two buttons** (Pause and 🎮 controls). Other settings (sound, vibration) belong on the Paused screen.

## Gotchas (learned the hard way)

- **Next 16:**
  - `params` is a Promise.
  - `PageProps`/`LayoutProps`/`RouteContext` are generated by `next typegen`.
  - `ssr: false` is only allowed in client components.
  - Read `node_modules/next/dist/docs/` before using an API.
- **`window.history.pushState` without a URL is safe in the App Router.** Next copies its state in, and Back to that entry is a no-op re-render. Pseudo-fullscreen relies on this.
- **Phaser `scale.refresh()` reuses the old parent size.** Call `scale.getParentBounds()` first. Pseudo-fullscreen fires no window resize, so without this the canvas stays small for about a second.
- **Phaser stores the canvas position on the page.** `PhaserGame` re-measures (`scale.updateBounds()`) on pointerdown, in case the layout shifted.
- **Graphics/`generateTexture` ignore camera zoom but apply the Graphics object's own scale.** That's how `bake()` makes 2× textures.
- **Safari ignores `backface-visibility` inside `<button>`.** Memory Match swaps the faces' visibility halfway through the flip instead of relying on 3D.
- **iPhone Safari has no element fullscreen and no Vibration API.** Screen-orientation lock only works in real fullscreen on Android.
- **Headless test quirks (not game bugs):**
  - Headless Edge sometimes throttles a visible, focused tab to about 3 frames/s; `Page.bringToFront` plus a screenshot restores it.
  - A headless tab may report `hidden`, which auto-pauses games; the scripts press Resume.
  - Run e2e suites one game per browser.
- **Windows editing:** Python's `open()` defaults to cp1252 and CRLF, which corrupts `×`, `—` and emoji. Use `encoding="utf-8", newline=""`, or the Edit tool. `.gitattributes` forces LF.
- **`gh` in Git Bash:** use the full path (see Deploying).
