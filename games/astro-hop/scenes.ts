import Phaser from "phaser";
import { STEP, TILE, VIEW_W } from "@/lib/games/astro-hop/config";
import type { Theme } from "@/lib/games/astro-hop/levels";
import {
  newGame,
  NO_INPUT,
  step,
  type Enemy,
  type Game,
  type GameEvent,
  type Input,
  type Phase,
} from "@/lib/games/astro-hop/logic";
import type { BaseCommand, GameBridge } from "../shared/bridge";
import { Music, type Tune } from "../shared/music";
import { RENDER_SCALE } from "../shared/phaserConfig";
import { addTexture, Pixels } from "../shared/pixel";
import { sfx } from "../shared/sfx";
import { textWidth } from "@/lib/pixelFont";
import {
  BLOCK_FRAME,
  BOING_FRAME,
  hudArt,
  ENEMY_FRAME,
  KIT_FRAME,
  levelChunks,
  makeArt,
  makeIntroArt,
  makeThemeArt,
  SHELLBOT_FRAME,
} from "./art";

export type HopCommand =
  | BaseCommand
  | { type: "setup"; level: number }
  | { type: "input"; input: Input };

export type HopState = {
  world: string;
  name: string;
  levelIndex: number;
  time: number;
  coins: number;
  lives: number;
  phase: Phase;
  /** Read out to screen readers. */
  message: string;
};

/** World size handed to Phaser; the camera zooms in to show 360×240 art pixels. */
export const W = 720;
export const H = 480;
const ZOOM = RENDER_SCALE * (W / VIEW_W);

/** Original chiptunes, one per world. */
const TUNES: Record<Theme, Tune> = {
  plains: {
    bpm: 150,
    root: 261.63,
    scale: [0, 2, 4, 5, 7, 9, 11],
    lead: "square",
    bass: "triangle",
    melody: [
      4, -1, 4, 5, 7, -1, 5, 4, 2, -1, 0, 2, 4, -1, -1, -1, 5, -1, 5, 7, 9, -1,
      7, 5, 4, 2, 4, 5, 4, -1, -1, -1,
    ],
    bassline: [0, 0, 4, 4, 3, 3, 4, 4, 0, 0, 4, 4, 3, 3, 4, 0],
  },
  caves: {
    bpm: 120,
    root: 220,
    scale: [0, 2, 3, 5, 7, 8, 10],
    lead: "triangle",
    bass: "square",
    melody: [
      0, -1, 2, -1, 4, -1, 2, -1, 3, -1, 2, -1, 0, -1, -1, -1, 0, -1, 2, -1, 4,
      -1, 6, -1, 5, -1, 4, -1, 2, -1, -1, -1,
    ],
    bassline: [0, 0, 0, 0, 5, 5, 4, 4, 0, 0, 0, 0, 3, 3, 4, 4],
  },
  sky: {
    bpm: 160,
    root: 293.66,
    scale: [0, 2, 4, 7, 9],
    lead: "square",
    bass: "triangle",
    melody: [
      0, 2, 4, 5, 4, 2, 4, -1, 5, 6, 7, 5, 4, -1, -1, -1, 2, 4, 5, 7, 6, 5, 4,
      2, 3, 4, 2, 1, 0, -1, -1, -1,
    ],
    bassline: [0, 0, 3, 3, 2, 2, 4, 4, 0, 0, 3, 3, 1, 1, 4, 4],
  },
};

const WALK_CYCLE = [
  KIT_FRAME.walkA,
  KIT_FRAME.walkB,
  KIT_FRAME.walkC,
  KIT_FRAME.walkB,
];

type Particle = {
  image: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  life: number;
};

function textArt(text: string): Pixels {
  const p = new Pixels(textWidth(text) + 2, 9);
  p.text(text, 1, 1, "#ffffff");
  return p.outline("#140c2c");
}

export class HopScene extends Phaser.Scene {
  private hop!: Game;
  private startLevel = 0;
  private keys: Input = NO_INPUT;
  private playing = false;
  private paused = false;
  private acc = 0;
  private serial = -1;
  private theme: Theme | null = null;
  private lastPhase: Phase | null = null;
  private lastState = "";
  private lastScore = -1;
  private message = "";
  private music = new Music();
  private musicOn = false;
  private tickSound = 0;

  private levelObjects: Phaser.GameObjects.GameObject[] = [];
  private far!: Phaser.GameObjects.TileSprite;
  private near!: Phaser.GameObjects.TileSprite;
  private blocks = new Map<string, Phaser.GameObjects.Image>();
  private coins = new Map<string, Phaser.GameObjects.Image>();
  private sprites = new Map<number, Phaser.GameObjects.Image>();
  private movers = new Map<number, Phaser.GameObjects.Image>();
  private particles: Particle[] = [];
  private kit!: Phaser.GameObjects.Image;
  private flag!: Phaser.GameObjects.Image;
  private rocket!: Phaser.GameObjects.Image;
  private flame!: Phaser.GameObjects.Image;
  private beacon: Phaser.GameObjects.Image | null = null;
  private intro: Phaser.GameObjects.GameObject[] = [];
  private hud!: Phaser.Textures.CanvasTexture;
  private hudImage!: Phaser.GameObjects.Image;
  private hudKey = "";

  constructor(private bridge: GameBridge<HopCommand, HopState>) {
    super("hop");
  }

  create() {
    this.cameras.main.setOrigin(0, 0).setZoom(ZOOM).setRoundPixels(true);
    this.cameras.main.setBackgroundColor("#0b1026");
    makeArt(this);
    this.kit = this.add
      .image(0, 0, "ah-kit-small", KIT_FRAME.idle)
      .setOrigin(0.5, 1)
      .setDepth(20)
      .setVisible(false);
    if (this.textures.exists("ah-hud")) this.textures.remove("ah-hud");
    this.hud = this.textures.createCanvas("ah-hud", VIEW_W, 13)!;
    this.hud.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.hudImage = this.add
      .image(0, 0, "ah-hud")
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(110)
      .setVisible(false);

    const unlisten = this.bridge.listen((command) => {
      switch (command.type) {
        case "setup":
          this.startLevel = command.level;
          break;
        case "start":
          this.hop = newGame(this.startLevel);
          this.playing = true;
          this.paused = false;
          this.acc = 0;
          this.serial = -1;
          this.lastPhase = null;
          this.lastScore = -1;
          this.keys = NO_INPUT;
          this.message = "";
          this.stopMusic();
          break;
        case "pause":
          this.paused = true;
          this.keys = NO_INPUT;
          this.stopMusic();
          break;
        case "resume":
          this.paused = false;
          break;
        case "input":
          this.keys = command.input;
          break;
      }
    });
    this.events.once("shutdown", () => {
      unlisten();
      this.music.stop();
    });
    this.events.once("destroy", () => this.music.stop());
  }

  update(_time: number, delta: number) {
    if (!this.hop) return;
    if (this.playing && !this.paused) {
      this.acc += Math.min(delta, 100) / 1000;
      while (this.acc >= STEP) {
        step(this.hop, this.keys);
        this.handleEvents(this.hop.events);
        this.hop.events.length = 0;
        this.acc -= STEP;
        if (!this.playing) break;
      }
    }
    if (this.hop.serial !== this.serial) this.buildLevel();
    this.updateMusic();
    this.render(delta / 1000);
    this.report();
  }

  // ------------------------------------------------------------ audio and events

  private playSfx(play: () => void) {
    if (this.bridge.sound) play();
  }

  private updateMusic() {
    const want =
      this.bridge.sound &&
      this.playing &&
      !this.paused &&
      this.hop.phase === "play";
    if (want && !this.musicOn && this.theme) {
      this.music.play(TUNES[this.theme], 0.45);
      this.musicOn = true;
    } else if (!want && this.musicOn) {
      this.stopMusic();
    }
  }

  private stopMusic() {
    this.music.stop();
    this.musicOn = false;
  }

  private handleEvents(events: GameEvent[]) {
    const reduced = this.bridge.reducedMotion;
    for (const e of events) {
      switch (e.type) {
        case "intro":
          this.message = `World ${this.hop.level.id}: ${titleCase(this.hop.level.name)}. Lives: ${this.hop.lives}.`;
          break;
        case "jump":
          this.playSfx(sfx.jump);
          break;
        case "coin":
          this.playSfx(sfx.coin);
          if (e.fromBlock) this.coinPop(e.x, e.y);
          break;
        case "stomp":
          this.playSfx(sfx.stomp);
          if (!reduced) this.burst(e.x, e.y + 8, [0xffffff, 0xc7d2fe], 5);
          break;
        case "bump": {
          this.playSfx(sfx.bump);
          const key = `${e.col},${e.row}`;
          if (!this.blocks.has(key)) this.addBlock(e.col, e.row, "U");
          break;
        }
        case "thud":
          this.playSfx(sfx.thud);
          break;
        case "break": {
          this.playSfx(sfx.smash);
          const key = `${e.col},${e.row}`;
          this.blocks.get(key)?.destroy();
          this.blocks.delete(key);
          const x = e.col * TILE + TILE / 2;
          const y = e.row * TILE + TILE / 2;
          for (const [vx, vy] of [
            [-50, -220],
            [50, -220],
            [-40, -150],
            [40, -150],
          ]) {
            this.particles.push({
              image: this.add.image(x, y, "ah-debris").setDepth(25),
              vx,
              vy,
              life: 1.2,
            });
          }
          break;
        }
        case "sprout":
          this.playSfx(sfx.sprout);
          break;
        case "powerUp":
          this.playSfx(sfx.powerUp);
          this.message =
            e.size === "fire"
              ? "Comet Berry! Press Run to throw sparks."
              : "Star Seed! Kit is big now.";
          break;
        case "hurt":
          this.playSfx(sfx.powerDown);
          break;
        case "life":
          this.playSfx(sfx.oneUp);
          this.message = "Extra life!";
          break;
        case "spark":
          this.playSfx(sfx.spark);
          break;
        case "puff":
          if (!reduced) this.burst(e.x, e.y, [0xff7a45, 0xfff27a], 4);
          break;
        case "flip":
          this.playSfx(sfx.bonk);
          break;
        case "kick":
          this.playSfx(sfx.kickShell);
          break;
        case "points":
          this.popPoints(e.x, e.y, e.value);
          break;
        case "checkpoint":
          this.playSfx(sfx.levelUp);
          this.banner("ah-b-checkpoint", 70, 700);
          this.message = "Checkpoint!";
          break;
        case "hurry":
          this.playSfx(sfx.hurry);
          this.banner("ah-b-hurry", 80, 900);
          this.message = "Hurry up! Time is running out.";
          break;
        case "die":
          this.stopMusic();
          this.playSfx(sfx.oops);
          this.banner("ah-b-oops", 90, 1000);
          this.message = "Oops! Kit lost a life.";
          break;
        case "goal":
          this.stopMusic();
          this.playSfx(sfx.poleSlide);
          this.message = `You reached the beacon! ${e.points} points.`;
          break;
        case "launch":
          this.playSfx(sfx.liftoff);
          break;
        case "tally":
          if (++this.tickSound % 2 === 0) this.playSfx(sfx.tick);
          break;
        case "clear":
          this.playSfx(sfx.clearTune);
          this.banner("ah-b-clear", 90, 900);
          this.message = "Level clear!";
          break;
        case "gameOver":
          this.playSfx(sfx.gameOverTune);
          this.finish();
          break;
        case "win":
          this.playSfx(sfx.fanfare);
          this.finish();
          break;
      }
    }
  }

  private finish() {
    this.playing = false;
    this.stopMusic();
    this.report();
    this.bridge.onOver(this.hop.score);
  }

  private report() {
    const g = this.hop;
    if (g.score !== this.lastScore) {
      this.lastScore = g.score;
      this.bridge.onScore(g.score);
    }
    const state: HopState = {
      world: g.level.id,
      name: g.level.name,
      levelIndex: g.levelIndex,
      time: g.time,
      coins: g.coins,
      lives: g.lives,
      phase: g.phase,
      message: this.message,
    };
    const json = JSON.stringify(state);
    if (json !== this.lastState) {
      this.lastState = json;
      this.bridge.onState(state);
    }
  }

  // ------------------------------------------------------------ effects

  private banner(key: string, y: number, hold: number) {
    const reduced = this.bridge.reducedMotion;
    const image = this.add
      .image(VIEW_W / 2, y, key)
      .setScrollFactor(0)
      .setDepth(60);
    image.setAlpha(0);
    this.tweens.add({
      targets: image,
      alpha: 1,
      y: reduced ? y : y - 4,
      duration: 160,
      yoyo: true,
      hold,
      onComplete: () => image.destroy(),
    });
  }

  private popPoints(x: number, y: number, value: number | "1UP") {
    const key = `ah-pts-${value}`;
    if (!this.textures.exists(key))
      addTexture(this, key, textArt(String(value)));
    const image = this.add.image(x, y - 4, key).setDepth(30);
    this.tweens.add({
      targets: image,
      y: y - 26,
      alpha: { from: 1, to: 0 },
      duration: 800,
      ease: "Quad.easeOut",
      onComplete: () => image.destroy(),
    });
  }

  private coinPop(x: number, y: number) {
    const image = this.add.image(x, y - 8, "ah-coin", 0).setDepth(3);
    this.tweens.add({
      targets: image,
      y: y - 44,
      duration: 260,
      yoyo: true,
      ease: "Quad.easeOut",
      onComplete: () => image.destroy(),
    });
  }

  private burst(x: number, y: number, tints: number[], count: number) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      this.particles.push({
        image: this.add
          .image(x, y, "ah-px")
          .setTint(tints[i % tints.length])
          .setDepth(26),
        vx: Math.cos(a) * 60,
        vy: Math.sin(a) * 60 - 40,
        life: 0.35,
      });
    }
  }

  // ------------------------------------------------------------ level display

  private clearLevel() {
    for (const o of this.levelObjects) o.destroy();
    for (const o of this.intro) o.destroy();
    for (const map of [this.blocks, this.coins, this.sprites, this.movers]) {
      for (const image of map.values()) image.destroy();
      map.clear();
    }
    for (const p of this.particles) p.image.destroy();
    this.levelObjects = [];
    this.intro = [];
    this.particles = [];
    this.beacon = null;
  }

  private addBlock(col: number, row: number, ch: string) {
    const x = col * TILE + TILE / 2;
    const y = row * TILE + TILE / 2;
    const image =
      ch === "B"
        ? this.add.image(x, y, "ah-brick")
        : this.add.image(
            x,
            y,
            "ah-star-block",
            ch === "U" ? BLOCK_FRAME.used : 0,
          );
    image.setDepth(2);
    this.blocks.set(`${col},${row}`, image);
  }

  private buildLevel() {
    const g = this.hop;
    this.serial = g.serial;
    this.clearLevel();
    let chunkIndex = 0;
    while (this.textures.exists(`ah-chunk-${chunkIndex}`)) {
      this.textures.remove(`ah-chunk-${chunkIndex}`);
      chunkIndex++;
    }
    if (this.theme !== g.level.theme) {
      this.theme = g.level.theme;
      makeThemeArt(this, this.theme);
    }
    makeIntroArt(this, g.level.id, g.level.name);
    addTexture(this, "ah-lives", textArt(`X ${g.lives}`));

    const keep = <T extends Phaser.GameObjects.GameObject>(o: T) => {
      this.levelObjects.push(o);
      return o;
    };
    keep(
      this.add
        .image(0, 0, "ah-sky")
        .setOrigin(0)
        .setScrollFactor(0)
        .setDepth(-10),
    );
    this.far = keep(
      this.add
        .tileSprite(0, 0, VIEW_W, 240, "ah-far")
        .setOrigin(0)
        .setScrollFactor(0)
        .setDepth(-9),
    );
    this.near = keep(
      this.add
        .tileSprite(0, 0, VIEW_W, 240, "ah-near")
        .setOrigin(0)
        .setScrollFactor(0)
        .setDepth(-8),
    );

    levelChunks(g.grid, g.level.theme, g.goal.poleTop).forEach((art, i) => {
      addTexture(this, `ah-chunk-${i}`, art);
      keep(
        this.add
          .image(i * 64 * TILE, 0, `ah-chunk-${i}`)
          .setOrigin(0)
          .setDepth(1),
      );
    });

    g.grid.forEach((cells, row) =>
      cells.forEach((ch, col) => {
        if (ch === "B" || ch === "?" || ch === "M" || ch === "U") {
          this.addBlock(col, row, ch);
        } else if (ch === "C") {
          this.coins.set(
            `${col},${row}`,
            this.add
              .image(col * TILE + TILE / 2, row * TILE + TILE / 2, "ah-coin", 0)
              .setDepth(3),
          );
        }
      }),
    );

    for (const m of g.movers) {
      this.movers.set(
        m.id,
        this.add
          .image(m.x, m.y, `ah-mover-${Math.min(5, m.w / TILE)}`)
          .setOrigin(0)
          .setDepth(3),
      );
    }

    this.flag = keep(
      this.add
        .image(g.goal.poleX - 1, g.goal.flagY, "ah-flag")
        .setOrigin(1, 0)
        .setDepth(2),
    );
    this.flame = keep(
      this.add
        .image(g.goal.rocketX, g.goal.rocketY, "ah-flame", 0)
        .setOrigin(0.5, 0)
        .setDepth(4)
        .setVisible(false),
    );
    this.rocket = keep(
      this.add
        .image(g.goal.rocketX, g.goal.rocketY, "ah-rocket")
        .setOrigin(0.5, 1)
        .setDepth(5),
    );
    if (g.checkpoint) {
      this.beacon = keep(
        this.add
          .image(
            g.checkpoint.col * TILE + TILE / 2,
            (g.checkpoint.row + 1) * TILE,
            "ah-beacon",
            g.reachedCheckpoint ? 1 : 0,
          )
          .setOrigin(0.5, 1)
          .setDepth(2),
      );
    }

    // Intro card: world, name and lives.
    const card = (
      o: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle,
    ) => {
      o.setScrollFactor(0).setDepth(100);
      this.intro.push(o);
    };
    card(this.add.rectangle(0, 0, VIEW_W, 240, 0x0b1026).setOrigin(0));
    card(this.add.image(VIEW_W / 2, 92, "ah-b-world"));
    card(this.add.image(VIEW_W / 2, 118, "ah-b-name"));
    card(this.add.image(VIEW_W / 2 - 14, 160, "ah-kit-small", KIT_FRAME.idle));
    card(this.add.image(VIEW_W / 2 + 10, 158, "ah-lives"));
  }

  // ------------------------------------------------------------ drawing

  private render(dt: number) {
    const g = this.hop;
    const cam = this.cameras.main;
    const camX = Math.round(g.camX);
    cam.setScroll(camX, 0);
    this.far.tilePositionX = Math.round(camX * 0.2);
    this.near.tilePositionX = Math.round(camX * 0.45);
    const anim = Math.floor(g.clock * 8);

    for (const [key, image] of this.blocks) {
      const [col, row] = key.split(",").map(Number);
      const ch = g.grid[row][col];
      if (ch === ".") {
        image.destroy();
        this.blocks.delete(key);
        continue;
      }
      if (ch === "U") image.setTexture("ah-star-block", BLOCK_FRAME.used);
      else if (ch === "?" || ch === "M")
        image.setFrame([0, 0, 1, 2, 1, 0][Math.floor(g.clock * 6) % 6]);
      const bump = g.bumps.find((b) => b.col === col && b.row === row);
      const lift = bump ? Math.sin((bump.t / 0.15) * Math.PI) * 4 : 0;
      image.y = row * TILE + TILE / 2 - Math.round(lift);
    }

    for (const [key, image] of this.coins) {
      const [col, row] = key.split(",").map(Number);
      if (g.grid[row][col] !== "C") {
        image.destroy();
        this.coins.delete(key);
      } else {
        image.setFrame(anim % 4);
      }
    }

    for (const m of g.movers) {
      this.movers.get(m.id)?.setPosition(Math.round(m.x), Math.round(m.y));
    }

    this.drawThings(anim);
    this.drawKit();

    const goal = g.goal;
    this.flag.y = Math.round(goal.flagY);
    this.rocket.y = Math.round(goal.rocketY - goal.lift);
    const launching = goal.stage === "launch" || goal.stage === "done";
    this.flame
      .setVisible(launching && g.phase === "goal")
      .setFrame(anim % 2)
      .setY(this.rocket.y - 4);
    this.beacon?.setFrame(g.reachedCheckpoint ? 1 : 0);

    const showIntro = g.phase === "intro";
    for (const o of this.intro)
      (o as Phaser.GameObjects.Image).setVisible(showIntro);

    this.particles = this.particles.filter((p) => {
      p.life -= dt;
      p.vy += 700 * dt;
      p.image.x += p.vx * dt;
      p.image.y += p.vy * dt;
      if (p.life > 0) return true;
      p.image.destroy();
      return false;
    });
    this.lastPhase = g.phase;
    this.drawHud();
  }

  private drawHud() {
    const g = this.hop;
    const values = {
      score: g.score,
      coins: g.coins,
      world: g.level.id,
      time: g.time,
      lives: g.lives,
    };
    const key = JSON.stringify(values);
    this.hudImage.setVisible(true);
    if (key === this.hudKey) return;
    this.hudKey = key;
    const ctx = this.hud.getContext();
    ctx.clearRect(0, 0, VIEW_W, 13);
    ctx.drawImage(hudArt(values).canvas, 0, 0);
    this.hud.refresh();
  }

  private sprite(id: number, key: string) {
    let image = this.sprites.get(id);
    if (!image) {
      image = this.add.image(0, 0, key).setOrigin(0.5, 1).setDepth(10);
      this.sprites.set(id, image);
    }
    return image;
  }

  private drawThings(anim: number) {
    const g = this.hop;
    const seen = new Set<number>();
    for (const e of g.enemies) {
      seen.add(e.id);
      const image = this.sprite(e.id, `ah-${e.kind}`);
      image.setFrame(enemyFrame(e, anim));
      image.setFlipX(e.dir > 0).setFlipY(e.state === "flipped");
      image.setOrigin(0.5, e.state === "flipped" ? 0 : 1);
      image.setPosition(
        Math.round(e.x + e.w / 2),
        Math.round(e.state === "flipped" ? e.y : e.y + e.h),
      );
    }
    for (const it of g.items) {
      seen.add(it.id);
      const key =
        it.kind === "seed"
          ? "ah-seed"
          : it.kind === "berry"
            ? "ah-berry"
            : "ah-life";
      const image = this.sprite(it.id, key);
      if (it.kind !== "life") image.setFrame(Math.floor(g.clock * 4) % 2);
      // Rising items come out from behind their block.
      image.setDepth(it.rising > 0 ? 1.5 : 10);
      image.setPosition(
        Math.round(it.x + it.w / 2),
        Math.round(it.y + it.h + 1),
      );
    }
    for (const s of g.sparks) {
      seen.add(s.id);
      const image = this.sprite(s.id, "ah-spark");
      image.setFrame(anim % 2).setOrigin(0.5);
      image.setPosition(Math.round(s.x + 3), Math.round(s.y + 3));
    }
    for (const [id, image] of this.sprites) {
      if (!seen.has(id)) {
        image.destroy();
        this.sprites.delete(id);
      }
    }
  }

  private drawKit() {
    const g = this.hop;
    const p = g.player;
    let size = p.size;
    if (g.freeze > 0 && p.transformFrom) {
      // Flicker between sizes while growing or shrinking.
      size = Math.floor(g.freeze * 12) % 2 ? p.transformFrom : p.size;
    }
    const key =
      size === "small"
        ? "ah-kit-small"
        : size === "fire"
          ? "ah-kit-fire"
          : "ah-kit-big";
    let frame: number = KIT_FRAME.idle;
    if (g.phase === "dying") frame = KIT_FRAME.dead;
    else if (g.phase === "goal" && g.goal.stage === "slide")
      frame = KIT_FRAME.fall;
    else if (!p.onGround) frame = p.vy < 0 ? KIT_FRAME.jump : KIT_FRAME.fall;
    else if (p.skidding) frame = KIT_FRAME.skid;
    else if (p.throwing < 0.15) frame = KIT_FRAME.throw;
    else if (Math.abs(p.vx) > 5)
      frame = WALK_CYCLE[Math.floor(p.walked / 6) % WALK_CYCLE.length];
    this.kit.setTexture(key, frame);
    this.kit.setFlipX(p.facing < 0);
    this.kit.setPosition(Math.round(p.x + p.w / 2), Math.round(p.y + p.h));
    const flashing = p.invulnerable > 0;
    const blink = flashing && Math.floor(p.invulnerable * 15) % 2 === 0;
    const showKit = p.visible && g.phase !== "intro";
    if (this.bridge.reducedMotion) {
      this.kit.setVisible(showKit).setAlpha(flashing ? 0.5 : 1);
    } else {
      this.kit.setVisible(showKit && !blink).setAlpha(1);
    }
  }
}

function enemyFrame(e: Enemy, anim: number): number {
  if (e.kind === "shellbot") {
    if (e.state === "shell") return SHELLBOT_FRAME.shell;
    if (e.state === "spin") return SHELLBOT_FRAME.shell + (anim % 4);
    if (e.state === "flipped") return SHELLBOT_FRAME.shell;
    return Math.floor(anim / 2) % 2;
  }
  if (e.kind === "boing") {
    if (e.state === "squashed") return BOING_FRAME.squashed;
    return e.onGround ? BOING_FRAME.sit : BOING_FRAME.jump;
  }
  if (e.state === "squashed") return ENEMY_FRAME.squashed;
  return Math.floor(anim / 2) % 2;
}

function titleCase(name: string) {
  return name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
