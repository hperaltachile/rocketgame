import Phaser from "phaser";
import {
  GRID_SIZE,
  newSnake,
  step,
  tickMs,
  turn,
  type Direction,
  type Point,
  type Snake,
} from "@/lib/games/snake/logic";
import type { BaseCommand, GameBridge } from "../shared/bridge";
import { bake, fitCamera, HI } from "../shared/phaserConfig";
import { sfx } from "../shared/sfx";

export type SnakeCommand = BaseCommand | { type: "turn"; dir: Direction };

export const CELL = 24;
export const BOARD = GRID_SIZE * CELL;

const HEAD = 0x7ee8c9;
const TAIL = 0x2bb58f;

export class SnakeScene extends Phaser.Scene {
  private snake: Snake = newSnake();
  private prevBody: Point[] = this.snake.body;
  private playing = false;
  private acc = 0;

  private g!: Phaser.GameObjects.Graphics;
  private star!: Phaser.GameObjects.Image;
  private sparkle!: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(private bridge: GameBridge<SnakeCommand>) {
    super("snake");
  }

  create() {
    fitCamera(this, BOARD, BOARD);
    this.makeTextures();
    this.add.image(0, 0, "snake-bg").setOrigin(0).setScale(HI);
    this.g = this.add.graphics();
    this.star = this.add.image(0, 0, "snake-star").setScale(HI);
    if (!this.bridge.reducedMotion) {
      this.tweens.add({
        targets: this.star,
        scale: { from: 0.85 * HI, to: 1.1 * HI },
        angle: { from: -10, to: 10 },
        duration: 600,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }
    this.sparkle = this.add.particles(0, 0, "snake-spark", {
      speed: { min: 40, max: 160 },
      lifespan: 450,
      scale: { start: HI, end: 0 },
      tint: [0xffd166, 0xfff3b0, 0x7ee8c9],
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });
    this.placeStar();
    this.draw(1);

    const unlisten = this.bridge.listen((command) => {
      switch (command.type) {
        case "start":
          this.startGame();
          break;
        case "pause":
          this.scene.pause();
          break;
        case "resume":
          this.scene.resume();
          break;
        case "turn":
          if (this.playing) this.snake = turn(this.snake, command.dir);
          break;
      }
    });
    this.events.once(Phaser.Scenes.Events.DESTROY, unlisten);
  }

  private makeTextures() {
    if (this.textures.exists("snake-bg")) return;
    const g = this.make.graphics({}, false);

    g.fillStyle(0x0b1026);
    g.fillRect(0, 0, BOARD, BOARD);
    g.fillStyle(0x141b3a);
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if ((x + y) % 2 === 0) g.fillRect(x * CELL, y * CELL, CELL, CELL);
      }
    }
    const rng = new Phaser.Math.RandomDataGenerator(["snake"]);
    for (let i = 0; i < 60; i++) {
      g.fillStyle(0xffffff, rng.realInRange(0.15, 0.5));
      g.fillCircle(
        rng.between(0, BOARD),
        rng.between(0, BOARD),
        rng.realInRange(0.5, 1.4),
      );
    }
    bake(g, "snake-bg", BOARD, BOARD);

    // Five-point star.
    const points: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 11 : 5;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      points.push(
        new Phaser.Math.Vector2(12 + Math.cos(a) * r, 12 + Math.sin(a) * r),
      );
    }
    g.fillStyle(0xffd166);
    g.lineStyle(1.5, 0xb7791f);
    g.fillPoints(points, true);
    g.strokePoints(points, true);
    bake(g, "snake-star", 24, 24);

    g.fillStyle(0xffffff);
    g.fillCircle(3, 3, 3);
    bake(g, "snake-spark", 6, 6);
    g.destroy();
  }

  private startGame() {
    if (this.scene.isPaused()) this.scene.resume();
    this.snake = newSnake();
    this.prevBody = this.snake.body;
    this.acc = 0;
    this.playing = true;
    this.placeStar();
    this.bridge.onScore(0);
  }

  private placeStar() {
    const { x, y } = this.snake.star;
    this.star.setPosition(x * CELL + CELL / 2, y * CELL + CELL / 2);
  }

  update(_time: number, deltaMs: number) {
    if (this.playing) {
      this.acc += Math.min(deltaMs, 250);
      let interval = tickMs(this.snake.body.length);
      while (this.playing && this.acc >= interval) {
        this.acc -= interval;
        this.tick();
        interval = tickMs(this.snake.body.length);
      }
    }
    const progress = this.playing
      ? Math.min(this.acc / tickMs(this.snake.body.length), 1)
      : 1;
    this.draw(progress);
  }

  private tick() {
    this.prevBody = this.snake.body;
    const result = step(this.snake);
    this.snake = result.snake;

    if (result.ate) {
      const head = this.snake.body[0];
      this.sparkle.explode(
        this.bridge.reducedMotion ? 6 : 18,
        head.x * CELL + CELL / 2,
        head.y * CELL + CELL / 2,
      );
      if (this.bridge.sound) sfx.eat();
      this.placeStar();
      this.bridge.onScore(this.snake.score);
    }

    if (!this.snake.alive) {
      this.playing = false;
      this.prevBody = this.snake.body;
      if (result.died) {
        if (!this.bridge.reducedMotion) this.cameras.main.shake(250, 0.01);
        this.cameras.main.flash(200, 255, 80, 80);
        if (this.bridge.sound) sfx.crash();
      }
      const score = this.snake.score;
      this.time.delayedCall(600, () => this.bridge.onOver(score));
    }
  }

  /** Draws the snake, easing each segment from its previous cell. */
  private draw(progress: number) {
    const g = this.g;
    g.clear();
    const body = this.snake.body;
    const n = body.length;
    for (let i = n - 1; i >= 0; i--) {
      const to = body[i];
      const from = this.prevBody[i] ?? this.prevBody[this.prevBody.length - 1];
      const x = Phaser.Math.Linear(from.x, to.x, progress) * CELL;
      const y = Phaser.Math.Linear(from.y, to.y, progress) * CELL;
      const color = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(HEAD),
        Phaser.Display.Color.ValueToColor(TAIL),
        Math.max(n - 1, 1),
        i,
      );
      g.fillStyle(Phaser.Display.Color.GetColor(color.r, color.g, color.b));
      const inset = i === 0 ? 1 : 2.5;
      g.fillRoundedRect(
        x + inset,
        y + inset,
        CELL - inset * 2,
        CELL - inset * 2,
        7,
      );
      if (i === 0) this.drawEyes(x, y);
    }
  }

  private drawEyes(x: number, y: number) {
    const dir = this.snake.queue[0] ?? this.snake.dir;
    const cx = x + CELL / 2;
    const cy = y + CELL / 2;
    const [ax, ay, bx, by] =
      dir === "left" || dir === "right" ? [0, -5, 0, 5] : [-5, 0, 5, 0];
    const fx = dir === "right" ? 4 : dir === "left" ? -4 : 0;
    const fy = dir === "down" ? 4 : dir === "up" ? -4 : 0;
    this.g.fillStyle(0x0b1026);
    this.g.fillCircle(cx + ax + fx, cy + ay + fy, 2.6);
    this.g.fillCircle(cx + bx + fx, cy + by + fy, 2.6);
  }
}
