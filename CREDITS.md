# Credits

All games in RocketGame are original implementations. The RocketGame rocket logo and in-game art are original unless listed below.

Game sprites (rockets, asteroids, comets, stars, the goalie, the stadiums, particles and confetti) are drawn in code at load time, including the pixel art of Nova Shootout, Cosmic Slam and Astro Hop (`games/shared/pixel.ts`, `games/astro-hop/art.ts`). Star Courier's 3D models (the couriers, Gloop, pods, worlds) are built in code from simple shapes (`games/star-courier/models.ts`), and its music, like Astro Hop's, is generated in code (`games/shared/music.ts`). Their 5×7 pixel font (`lib/pixelFont.ts`) was drawn for RocketGame too. Sound effects (boosts, kicks, crowd cheers, chiptune jingles and so on) are synthesized in code with the Web Audio API (`games/shared/sfx.ts`), so the games ship no third-party art, font or audio files.

Game names, characters, teams and places (Nova Shootout, Bolt the robot goalie, Crater Field, Cosmic Slam, the Moon Pitcher, Star Courier, Pip, Zuri, Bix, Gloop, the Ring Rail, Astro Hop, Kit the space fox, Grumbles, Shellbots, Boing frogs, Star Seeds, Comet Berries...) are made up for RocketGame. No real brands, leagues, teams, players or logos are used.

Only original, CC0 or otherwise properly licensed assets may be added. List every third-party asset here **and** on the `/about` page.

| Asset        | Source                                    | License                   |
| ------------ | ----------------------------------------- | ------------------------- |
| Fredoka font | https://fonts.google.com/specimen/Fredoka | SIL Open Font License 1.1 |
| Geist font   | https://fonts.google.com/specimen/Geist   | SIL Open Font License 1.1 |
| Phaser       | https://phaser.io                         | MIT                       |
| three.js     | https://threejs.org                       | MIT                       |
