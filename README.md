# RocketGame

Quick, free browser mini-games with a rockets-and-space theme — [rocketgame.me](https://rocketgame.me).

Built with Next.js (App Router), TypeScript, Tailwind CSS, Phaser 3 (action games) and plain React (puzzle games).

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

Game rules live in `lib/games/<slug>/` as plain TypeScript so they can be tested without React or Phaser.
