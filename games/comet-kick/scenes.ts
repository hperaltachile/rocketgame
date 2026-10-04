import Phaser from "phaser";
import {
  clampAim,
  goals,
  isRoundOver,
  keeperDive,
  kicksTaken,
  newRound,
  POWER,
  powerAt,
  recordKick,
  resolveShot,
  KEEPER,
  type Difficulty,
  type GoalPoint,
  type Outcome,
  type Round,
} from "@/lib/games/comet-kick/logic";
import type { Direction } from "@/lib/input";
import type { BaseCommand, GameBridge } from "../shared/bridge";
import { bake, fitCamera, HI } from "../shared/phaserConfig";
import { sfx } from "../shared/sfx";

export type KickCommand =
  | BaseCommand
  | { type: "setup"; difficulty: Difficulty }
  | { type: "steer"; dir: Direction | null }
  | { type: "kick" };

export type Phase = "aim" | "power" | "flying" | "result";

export type KickState = {
  phase: Phase;
  kicks: number;
  goals: number;
  results: Outcome[];
  /** Outcome of the kick just taken, while its message is showing. */
  last: Outcome | null;
};

export const W = 720;
export const H = 480;

/** Goal mouth on screen. */
const GOAL = { left: 200, right: 520, top: 150, bottom: 300 };
const SPOT = { x: 360, y: 420 };
const BAR = { x: 652, top: 140, bottom: 390, width: 26 };

/** Aim speed with the pad or arrow keys, in goal units per second. */
const STEER_SPEED = 1.1;

const toScreen = (p: GoalPoint) => ({
  x: (GOAL.left + GOAL.right) / 2 + p.x * ((GOAL.right - GOAL.left) / 2),
  y: GOAL.bottom - p.y * (GOAL.bottom - GOAL.top),
});

const toGoal = (x: number, y: number): GoalPoint => ({
  x: (x - (GOAL.left + GOAL.right) / 2) / ((GOAL.right - GOAL.left) / 2),
  y: (GOAL.bottom - y) / (GOAL.bottom - GOAL.top),
});

const inGoal = (x: number, y: number) =>
  x >= GOAL.left - 10 &&
  x <= GOAL.right + 10 &&
  y >= GOAL.top - 10 &&
  y <= GOAL.bottom + 10;

const CONFETTI = [0xff7a45, 0xffd166, 0x4cc9f0, 0xa78bfa, 0x7ee8c9, 0xffffff];

export class KickScene extends Phaser.Scene {
  private difficulty: Difficulty = "easy";
  private round: Round = newRound();
  private phase: Phase = "aim";
  private playing = false;
  private aim: GoalPoint = { x: 0, y: 0.45 };
  private steerDir: Direction | null = null;
  private powerTime = 0;
  private power = 0;
  private last: Outcome | null = null;

  private reticle!: Phaser.GameObjects.Graphics;
  private bar!: Phaser.GameObjects.Graphics;
  private ball!: Phaser.GameObjects.Image;
  private keeper!: Phaser.GameObjects.Image;
  private net!: Phaser.GameObjects.Image;
  private trail!: Phaser.GameObjects.Particles.ParticleEmitter;
  private confetti!: Phaser.GameObjects.Particles.ParticleEmitter;
  private crowd: Phaser.GameObjects.Image[] = [];

  constructor(private bridge: GameBridge<KickCommand, KickState>) {
    super("kick");
  }

  create() {
    fitCamera(this, W, H);
    this.makeTextures();

    this.add.image(0, 0, "kick-sky").setOrigin(0).setScale(HI);
    for (let i = 0; i < 3; i++) {
      this.crowd.push(
        this.add
          .image(0, 70 + i * 16, `kick-crowd-${i}`)
          .setOrigin(0)
          .setScale(HI),
      );
    }
    this.add.image(0, 0, "kick-field").setOrigin(0).setScale(HI);
    this.net = this.add
      .image(GOAL.left - 6, GOAL.top - 6, "kick-net")
      .setOrigin(0)
      .setScale(HI);
    this.add
      .image(GOAL.left - 6, GOAL.top - 6, "kick-posts")
      .setOrigin(0)
      .setScale(HI);

    this.keeper = this.add
      .image(360, GOAL.bottom, "kick-bolt")
      .setOrigin(0.5, 1)
      .setScale(HI);

    this.trail = this.add.particles(0, 0, "kick-spark", {
      speed: { min: 5, max: 30 },
      lifespan: 300,
      scale: { start: 0.9 * HI, end: 0 },
      alpha: { start: 0.9, end: 0 },
      tint: [0x4cc9f0, 0xa78bfa, 0xffffff],
      blendMode: Phaser.BlendModes.ADD,
      frequency: 16,
      emitting: false,
    });
    this.ball = this.add.image(SPOT.x, SPOT.y, "kick-ball").setScale(HI);
    this.trail.startFollow(this.ball);

    this.confetti = this.add.particles(0, 0, "kick-confetti", {
      speed: { min: 120, max: 380 },
      angle: { min: 200, max: 340 },
      gravityY: 420,
      lifespan: 1600,
      rotate: { start: 0, end: 540 },
      scale: HI,
      tint: CONFETTI,
      emitting: false,
    });

    this.reticle = this.add.graphics();
    this.bar = this.add.graphics();

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) =>
      this.tap(pointer.worldX, pointer.worldY),
    );

    const unlisten = this.bridge.listen((command) => {
      switch (command.type) {
        case "setup":
          this.difficulty = command.difficulty;
          break;
        case "start":
          this.startRound();
          break;
        case "pause":
          this.scene.pause();
          break;
        case "resume":
          this.scene.resume();
          break;
        case "steer":
          this.steerDir = command.dir;
          break;
        case "kick":
          this.press();
          break;
      }
    });
    this.events.once(Phaser.Scenes.Events.DESTROY, unlisten);
    this.draw();
  }

  private makeTextures() {
    if (this.textures.exists("kick-sky")) return;
    const g = this.make.graphics({}, false);
    const rng = new Phaser.Math.RandomDataGenerator(["comet-kick"]);

    // Night sky over Crater Field, with a ringed planet and a small moon.
    g.fillGradientStyle(0x0b1026, 0x0b1026, 0x2b3668, 0x2b3668);
    g.fillRect(0, 0, W, 260);
    for (let i = 0; i < 90; i++) {
      g.fillStyle(0xffffff, rng.realInRange(0.25, 0.8));
      g.fillCircle(
        rng.between(0, W),
        rng.between(0, 150),
        rng.realInRange(0.5, 1.4),
      );
    }
    g.fillStyle(0xa78bfa);
    g.fillCircle(90, 50, 26);
    g.lineStyle(4, 0xffd166, 0.8);
    g.strokeEllipse(90, 50, 86, 20);
    g.fillStyle(0xe8ecff);
    g.fillCircle(630, 40, 14);
    g.fillStyle(0xc7d2fe);
    g.fillCircle(634, 36, 4);
    // Stadium wall under the stands.
    g.fillStyle(0x1d2650);
    g.fillRect(0, 118, W, 24);
    g.fillStyle(0xff7a45);
    g.fillRect(0, 138, W, 4);
    bake(g, "kick-sky", W, 260);

    // Three rows of a cheering alien crowd (little round heads).
    const heads = [0x7ee8c9, 0xffd166, 0xff9f5a, 0xa78bfa, 0x4cc9f0, 0xf472b6];
    for (let row = 0; row < 3; row++) {
      for (let x = 6 + row * 7; x < W; x += 14) {
        g.fillStyle(heads[rng.between(0, heads.length - 1)]);
        g.fillCircle(x, 8, 6);
        g.fillStyle(0x0b1026);
        g.fillCircle(x - 2, 7, 1.2);
        g.fillCircle(x + 2, 7, 1.2);
      }
      bake(g, `kick-crowd-${row}`, W, 16);
    }

    // The pitch: striped moon turf.
    for (let i = 0; i < 6; i++) {
      g.fillStyle(i % 2 === 0 ? 0x2f9e6e : 0x38b07c);
      g.fillRect(0, 142 + i * 56, W, 56);
    }
    g.lineStyle(3, 0xffffff, 0.85);
    g.lineBetween(0, 300, W, 300);
    g.strokeRect(130, 300, 460, 70);
    g.fillStyle(0xffffff);
    g.fillEllipse(SPOT.x, SPOT.y + 14, 18, 7);
    g.fillStyle(0x0b1026, 0.25);
    g.fillEllipse(360, 302, 380, 14);
    bake(g, "kick-field", W, H);

    // Net (drawn behind the posts).
    const gw = GOAL.right - GOAL.left + 12;
    const gh = GOAL.bottom - GOAL.top + 12;
    g.fillStyle(0xffffff, 0.08);
    g.fillRect(6, 6, gw - 12, gh - 12);
    g.lineStyle(1, 0xffffff, 0.35);
    for (let x = 6; x <= gw - 6; x += 16) g.lineBetween(x, 6, x, gh - 6);
    for (let y = 6; y <= gh - 6; y += 16) g.lineBetween(6, y, gw - 6, y);
    bake(g, "kick-net", gw, gh);

    g.lineStyle(8, 0xffffff);
    g.lineBetween(6, gh, 6, 6);
    g.lineBetween(6, 6, gw - 6, 6);
    g.lineBetween(gw - 6, 6, gw - 6, gh);
    bake(g, "kick-posts", gw, gh);

    // Bolt the robot goalie (64×96).
    g.fillStyle(0x9aa6d8);
    g.fillRoundedRect(20, 40, 24, 44, 6); // body
    g.fillStyle(0xe8ecff);
    g.fillRoundedRect(22, 42, 20, 16, 4); // chest plate
    g.fillStyle(0x4cc9f0);
    g.fillCircle(32, 50, 4); // chest light
    g.fillStyle(0x9aa6d8);
    g.fillRoundedRect(4, 44, 16, 8, 4); // arms
    g.fillRoundedRect(44, 44, 16, 8, 4);
    g.fillStyle(0xff7a45);
    g.fillCircle(6, 48, 7); // gloves
    g.fillCircle(58, 48, 7);
    g.fillStyle(0x6d7bb8);
    g.fillRect(23, 84, 7, 12); // legs
    g.fillRect(34, 84, 7, 12);
    g.fillStyle(0xc7d2fe);
    g.fillRoundedRect(17, 14, 30, 26, 8); // head
    g.fillStyle(0x0b1026);
    g.fillRoundedRect(21, 20, 22, 11, 5); // visor
    g.fillStyle(0x7ee8c9);
    g.fillCircle(27, 25, 2.5);
    g.fillCircle(37, 25, 2.5);
    g.lineStyle(2, 0xc7d2fe);
    g.lineBetween(32, 14, 32, 5);
    g.fillStyle(0xffd166);
    g.fillCircle(32, 4, 3.5); // antenna
    bake(g, "kick-bolt", 64, 96);

    // Comet ball: white with blue star patches (28×28).
    g.fillStyle(0xffffff);
    g.fillCircle(14, 14, 13);
    g.lineStyle(1.5, 0x1b2350);
    g.strokeCircle(14, 14, 13);
    g.fillStyle(0x4cc9f0);
    g.fillCircle(14, 14, 4);
    g.fillCircle(6, 8, 3);
    g.fillCircle(22, 9, 3);
    g.fillCircle(7, 21, 3);
    g.fillCircle(21, 21, 3);
    bake(g, "kick-ball", 28, 28);

    g.fillStyle(0xffffff);
    g.fillCircle(4, 4, 4);
    bake(g, "kick-spark", 8, 8);

    g.fillStyle(0xffffff);
    g.fillRect(0, 0, 8, 5);
    bake(g, "kick-confetti", 8, 5);
    g.destroy();
  }

  private report() {
    this.bridge.onState({
      phase: this.phase,
      kicks: kicksTaken(this.round),
      goals: goals(this.round),
      results: this.round.results,
      last: this.last,
    });
  }

  private startRound() {
    if (this.scene.isPaused()) this.scene.resume();
    this.round = newRound();
    this.playing = true;
    this.bridge.onScore(0);
    this.nextKick();
  }

  private nextKick() {
    this.tweens.killTweensOf([this.ball, this.keeper, this.net]);
    this.phase = "aim";
    this.last = null;
    this.aim = { x: 0, y: 0.45 };
    this.ball.setPosition(SPOT.x, SPOT.y).setScale(HI).setAngle(0).setAlpha(1);
    this.keeper.setPosition(360, GOAL.bottom).setAngle(0);
    this.net.setPosition(GOAL.left - 6, GOAL.top - 6);
    this.trail.stop();
    this.report();
  }

  /** Pointer: tap in the goal to aim and start the power bar; tap again to shoot. */
  private tap(x: number, y: number) {
    if (!this.playing) return;
    if (this.phase === "aim" && inGoal(x, y)) {
      this.aim = clampAim(toGoal(x, y));
      this.startPower();
    } else if (this.phase === "power") {
      this.shoot();
    }
  }

  /** Kick button, Space or Enter: start the power bar, then shoot. */
  private press() {
    if (!this.playing) return;
    if (this.phase === "aim") this.startPower();
    else if (this.phase === "power") this.shoot();
  }

  private startPower() {
    this.phase = "power";
    this.powerTime = 0;
    this.power = 0;
    this.report();
  }

  private shoot() {
    this.phase = "flying";
    const kick = kicksTaken(this.round);
    const dive = keeperDive(this.aim, this.difficulty, kick);
    const { outcome, landing } = resolveShot(
      { aim: this.aim, power: this.power },
      dive,
      this.difficulty,
    );
    if (this.bridge.sound) sfx.kick();
    this.report();

    // Ball flight: slower for a weak kick, with a little arc.
    const flight = Phaser.Math.Linear(650, 330, Math.min(this.power, 1));
    const target = toScreen(landing);
    const end =
      outcome === "over"
        ? { x: target.x, y: GOAL.top - 70 }
        : outcome === "wide"
          ? { x: target.x + Math.sign(landing.x) * 40, y: target.y }
          : target;
    const saved = outcome === "saved";
    const stopAt = saved
      ? {
          x: Phaser.Math.Linear(SPOT.x, end.x, 0.9),
          y: Phaser.Math.Linear(SPOT.y, end.y, 0.9),
        }
      : end;
    this.trail.start();
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: flight,
      ease: "Quad.easeOut",
      onUpdate: (tween) => {
        const t = tween.getValue() ?? 0;
        this.ball
          .setPosition(
            Phaser.Math.Linear(SPOT.x, stopAt.x, t),
            Phaser.Math.Linear(SPOT.y, stopAt.y, t) -
              Math.sin(t * Math.PI) * 30,
          )
          .setScale(Phaser.Math.Linear(1, 0.6, t) * HI)
          .setAngle(t * 540);
      },
      onComplete: () => this.land(outcome, end),
    });

    // The goalie reacts a moment after the kick and dives.
    const diveTo = toScreen(dive);
    const skill = KEEPER[this.difficulty];
    this.tweens.add({
      targets: this.keeper,
      x: diveTo.x,
      y: Math.max(diveTo.y + 48, GOAL.top + 96),
      angle: dive.x === 0 ? 0 : Math.sign(dive.x) * (dive.y > 0.5 ? 55 : 75),
      delay: 90,
      duration: Math.round(flight * (0.75 - skill.reach)),
      ease: "Quad.easeOut",
    });
  }

  private land(outcome: Outcome, end: { x: number; y: number }) {
    this.trail.stop();
    const reduced = this.bridge.reducedMotion;
    if (outcome === "goal") {
      // Net ripple, confetti and the crowd jumps.
      this.tweens.add({
        targets: this.net,
        y: this.net.y - 5,
        duration: 90,
        yoyo: true,
        repeat: 2,
      });
      if (!reduced) {
        this.confetti.explode(70, 360, 200);
        this.crowd.forEach((row, i) =>
          this.tweens.add({
            targets: row,
            y: row.y - 6,
            duration: 160,
            delay: i * 60,
            yoyo: true,
            repeat: 3,
          }),
        );
      }
      if (this.bridge.sound) sfx.cheer();
    } else {
      // Bounce the ball away: off the goalie's gloves, the post or the stands.
      const away =
        outcome === "saved"
          ? { x: end.x + (end.x < 360 ? -90 : 90), y: SPOT.y - 40 }
          : outcome === "post"
            ? { x: end.x + (end.x < 360 ? -60 : 60), y: end.y + 120 }
            : { x: end.x, y: end.y - 30 };
      this.tweens.add({
        targets: this.ball,
        x: away.x,
        y: away.y,
        alpha: outcome === "over" || outcome === "wide" ? 0 : 1,
        duration: 420,
        ease: "Quad.easeOut",
      });
      if (this.bridge.sound) sfx.aww();
    }

    this.round = recordKick(this.round, outcome);
    this.last = outcome;
    this.phase = "result";
    const score = goals(this.round);
    this.bridge.onScore(score);
    this.report();

    this.time.delayedCall(1500, () => {
      if (isRoundOver(this.round)) {
        this.playing = false;
        this.bridge.onOver(score);
      } else {
        this.nextKick();
      }
    });
  }

  update(_time: number, deltaMs: number) {
    const dt = Math.min(deltaMs / 1000, 0.05);
    if (this.playing && this.phase === "aim" && this.steerDir) {
      const step = STEER_SPEED * dt;
      const dx =
        this.steerDir === "left" ? -step : this.steerDir === "right" ? step : 0;
      const dy =
        this.steerDir === "up" ? step : this.steerDir === "down" ? -step : 0;
      this.aim = clampAim({ x: this.aim.x + dx, y: this.aim.y + dy });
    }
    if (this.playing && this.phase === "power") {
      this.powerTime += dt;
      this.power = powerAt(this.powerTime, KEEPER[this.difficulty].sweep);
    }
    this.draw();
  }

  private draw() {
    const r = this.reticle;
    r.clear();
    if (this.playing && (this.phase === "aim" || this.phase === "power")) {
      const { x, y } = toScreen(this.aim);
      const pulse = this.bridge.reducedMotion
        ? 0
        : Math.sin(this.time.now / 160) * 2;
      r.lineStyle(3, 0xff7a45);
      r.strokeCircle(x, y, 13 + pulse);
      r.lineBetween(x - 20, y, x - 8, y);
      r.lineBetween(x + 8, y, x + 20, y);
      r.lineBetween(x, y - 20, x, y - 8);
      r.lineBetween(x, y + 8, x, y + 20);
    }

    const b = this.bar;
    b.clear();
    if (!this.playing) return;
    const height = BAR.bottom - BAR.top;
    const yAt = (p: number) => BAR.bottom - p * height;
    b.fillStyle(0x0b1026, 0.7);
    b.fillRoundedRect(BAR.x - 6, BAR.top - 6, BAR.width + 12, height + 12, 10);
    const zones: [number, number, number][] = [
      [0, POWER.good, 0xffd166],
      [POWER.good, POWER.strong, 0x34d399],
      [POWER.strong, POWER.wild, 0xff9f5a],
      [POWER.wild, 1, 0xef4444],
    ];
    for (const [from, to, color] of zones) {
      b.fillStyle(color, this.phase === "power" ? 1 : 0.45);
      b.fillRect(BAR.x, yAt(to), BAR.width, yAt(from) - yAt(to));
    }
    if (this.phase !== "aim") {
      const y = yAt(this.power);
      b.fillStyle(0xffffff);
      b.fillTriangle(BAR.x - 12, y - 8, BAR.x - 12, y + 8, BAR.x - 2, y);
      b.fillRect(BAR.x - 2, y - 2, BAR.width + 4, 4);
    }
  }
}
