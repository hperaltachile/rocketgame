import Phaser from "phaser";
import {
  clampAim,
  goals,
  isRoundOver,
  keeperDive,
  KICKS,
  kicksTaken,
  newRound,
  powerAt,
  recordKick,
  resolveShot,
  KEEPER,
  type Difficulty,
  type GoalPoint,
  type Outcome,
  type Round,
} from "@/lib/games/nova-shootout/logic";
import type { Direction } from "@/lib/input";
import type { BaseCommand, GameBridge } from "../shared/bridge";
import { fitCamera } from "../shared/phaserConfig";
import { art, ART, popBanner } from "../shared/pixel";
import { sfx } from "../shared/sfx";
import {
  BOLT_FRAME,
  CROWD,
  CROWD_ROWS,
  JUMBO,
  LAMP,
  makeArt,
  METER,
  SCREEN,
  STRIKER_FRAME,
} from "./art";

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
/** Power meter (world units): the frame's top-left corner. */
const BAR = { x: 646, y: 134 };
/** Where the goal art and Bolt stand. */
const GOAL_ART = { x: 192.5, y: 142.5 };
const KEEPER_HOME = { x: 360, y: 301 };
const STRIKER_HOME = { x: 330, y: 450 };

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

/** Screen y of a power level on the meter. */
const powerY = (power: number) =>
  BAR.y + (METER.innerY + (1 - power) * METER.innerH) * ART;

const CONFETTI = [0xff7a45, 0xffd166, 0x4cc9f0, 0xa78bfa, 0x7ee8c9, 0xffffff];

const RESULT_BANNER: Record<Outcome, string> = {
  goal: "nova-b-goal",
  saved: "nova-b-saved",
  post: "nova-b-post",
  over: "nova-b-over",
  wide: "nova-b-wide",
};

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
  private cheering = false;

  private reticle!: Phaser.GameObjects.Image;
  private meter!: Phaser.GameObjects.Image;
  private pointer!: Phaser.GameObjects.Image;
  private ball!: Phaser.GameObjects.Image;
  private keeper!: Phaser.GameObjects.Image;
  private striker!: Phaser.GameObjects.Image;
  private net!: Phaser.GameObjects.Image;
  private posts!: Phaser.GameObjects.Image;
  private lamps: Phaser.GameObjects.Image[] = [];
  private screen!: Phaser.GameObjects.Image;
  private crowd: Phaser.GameObjects.Image[] = [];
  private trail!: Phaser.GameObjects.Particles.ParticleEmitter;
  private confetti!: Phaser.GameObjects.Particles.ParticleEmitter;
  private dust!: Phaser.GameObjects.Particles.ParticleEmitter;
  private sway: Phaser.Tweens.Tween | null = null;

  constructor(private bridge: GameBridge<KickCommand, KickState>) {
    super("kick");
  }

  create() {
    fitCamera(this, W, H);
    makeArt(this);
    const reduced = this.bridge.reducedMotion;

    art(this, 0, 0, "nova-sky").setOrigin(0);
    this.twinkles(reduced);
    art(this, JUMBO.x * ART, JUMBO.y * ART, "nova-jumbo").setOrigin(0);
    this.screen = art(
      this,
      (JUMBO.x + JUMBO.w / 2) * ART,
      (JUMBO.y + JUMBO.textY) * ART,
      "nova-screen-title",
    ).setOrigin(0.5, 0);
    for (let i = 0; i < KICKS; i++) {
      this.lamps.push(
        art(
          this,
          (JUMBO.x + JUMBO.lampX + i * JUMBO.lampGap + 3.5) * ART,
          (JUMBO.y + JUMBO.lampY + 3.5) * ART,
          "nova-lamp",
          LAMP.off,
        ),
      );
    }
    this.crowd = CROWD_ROWS.map((row, i) =>
      art(this, 0, row.y * ART, `nova-crowd-${i}`, CROWD.calmA).setOrigin(0),
    );
    art(this, 0, 0, "nova-pitch").setOrigin(0);

    this.net = art(this, GOAL_ART.x, GOAL_ART.y, "nova-net", 0).setOrigin(0);
    this.posts = art(this, GOAL_ART.x, GOAL_ART.y, "nova-posts").setOrigin(0);
    this.keeper = art(
      this,
      KEEPER_HOME.x,
      KEEPER_HOME.y,
      "nova-bolt",
      BOLT_FRAME.idle,
    ).setOrigin(0.5, 1);

    this.dust = this.add.particles(0, 0, "nova-px", {
      speed: { min: 20, max: 70 },
      angle: { min: 200, max: 340 },
      lifespan: 420,
      scale: ART,
      alpha: { start: 0.9, end: 0 },
      tint: [0xc7d2fe, 0x9aa6d8, 0xffffff],
      emitting: false,
    });
    this.trail = this.add.particles(0, 0, "nova-px", {
      speed: { min: 5, max: 25 },
      lifespan: 320,
      scale: { start: ART, end: ART / 3 },
      alpha: { start: 1, end: 0 },
      tint: [0x4cc9f0, 0xa78bfa, 0xffffff, 0x3a86ff],
      frequency: reduced ? 60 : 14,
      emitting: false,
    });
    this.striker = art(
      this,
      STRIKER_HOME.x,
      STRIKER_HOME.y,
      "nova-striker",
      STRIKER_FRAME.stand,
    ).setOrigin(0.5, 1);
    this.ball = art(this, SPOT.x, SPOT.y, "nova-ball", 0);
    this.trail.startFollow(this.ball);

    this.confetti = this.add.particles(0, 0, "nova-confetti", {
      speed: { min: 120, max: 360 },
      angle: { min: 200, max: 340 },
      gravityY: 420,
      lifespan: 1600,
      scale: ART,
      tint: CONFETTI,
      emitting: false,
    });
    this.confetti.setDepth(40);

    this.reticle = art(this, 0, 0, "nova-reticle", 0).setVisible(false);
    this.meter = art(this, BAR.x, BAR.y, "nova-meter", 0)
      .setOrigin(0)
      .setVisible(false);
    this.pointer = art(this, BAR.x - 2, powerY(0), "nova-pointer")
      .setOrigin(1, 0.5)
      .setVisible(false);

    // Calm crowd flicker, Bolt's idle bob and the reticle pulse.
    this.time.addEvent({
      delay: 480,
      loop: true,
      callback: () => {
        if (!this.cheering) {
          const frame =
            String(this.crowd[0].frame.name) === String(CROWD.calmA)
              ? CROWD.calmB
              : CROWD.calmA;
          this.crowd.forEach((row) => row.setFrame(frame));
        }
        if (this.phase === "aim") {
          const bob = Number(this.keeper.frame.name) === BOLT_FRAME.idle;
          this.keeper.setFrame(bob ? BOLT_FRAME.bob : BOLT_FRAME.idle);
        }
      },
    });
    if (!reduced) {
      this.time.addEvent({
        delay: 170,
        loop: true,
        callback: () =>
          this.reticle.setFrame(
            String(this.reticle.frame.name) === "0" ? 1 : 0,
          ),
      });
      this.time.addEvent({
        delay: 6500,
        loop: true,
        callback: () => this.shootingComet(),
      });
    }

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
  }

  private twinkles(reduced: boolean) {
    const rng = new Phaser.Math.RandomDataGenerator(["nova-twinkle"]);
    for (let i = 0; i < 9; i++) {
      const star = art(
        this,
        rng.between(40, 680),
        rng.between(6, 60),
        "nova-twinkle",
      );
      if (reduced) continue;
      star.setAlpha(0.2);
      this.tweens.add({
        targets: star,
        alpha: 1,
        duration: rng.between(500, 900),
        delay: rng.between(0, 2000),
        yoyo: true,
        repeat: -1,
        repeatDelay: rng.between(400, 2400),
      });
    }
  }

  private shootingComet() {
    const y = Phaser.Math.Between(10, 50);
    const comet = art(this, -40, y, "nova-comet");
    this.tweens.add({
      targets: comet,
      x: W + 40,
      y: y + 30,
      duration: 1600,
      onComplete: () => comet.destroy(),
    });
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
    this.lamps.forEach((lamp) => lamp.setFrame(LAMP.off));
    this.bridge.onScore(0);
    this.nextKick();
  }

  private nextKick() {
    this.tweens.killTweensOf([
      this.ball,
      this.keeper,
      this.net,
      this.striker,
      ...this.lamps,
    ]);
    this.phase = "aim";
    this.last = null;
    this.aim = { x: 0, y: 0.45 };
    this.ball
      .setPosition(SPOT.x, SPOT.y)
      .setScale(ART)
      .setFrame(0)
      .setAlpha(1)
      .setVisible(true);
    this.keeper
      .setPosition(KEEPER_HOME.x, KEEPER_HOME.y)
      .setFrame(BOLT_FRAME.idle)
      .setFlipX(false);
    this.striker
      .setPosition(STRIKER_HOME.x, STRIKER_HOME.y)
      .setFrame(STRIKER_FRAME.stand);
    this.net.setFrame(0);
    this.trail.stop();

    // The lamp for this kick blinks on the jumbotron.
    const kick = kicksTaken(this.round);
    const lamp = this.lamps[kick];
    lamp.setFrame(LAMP.next).setAlpha(1);
    if (!this.bridge.reducedMotion) {
      this.tweens.add({
        targets: lamp,
        alpha: 0.35,
        duration: 300,
        yoyo: true,
        repeat: -1,
      });
      this.sway = this.tweens.add({
        targets: this.keeper,
        x: { from: KEEPER_HOME.x - 14, to: KEEPER_HOME.x + 14 },
        duration: 1300,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }
    popBanner(
      this,
      kick === KICKS - 1 ? "nova-b-last" : `nova-b-kick-${kick + 1}`,
      360,
      372,
      {
        hold: 420,
        reduced: this.bridge.reducedMotion,
      },
    );
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
    this.keeper.setFrame(BOLT_FRAME.ready);
    if (this.bridge.sound) sfx.blip();
    this.report();
  }

  private shoot() {
    this.phase = "flying";
    const power = this.power;
    const kick = kicksTaken(this.round);
    const dive = keeperDive(this.aim, this.difficulty, kick);
    const { outcome, landing } = resolveShot(
      { aim: this.aim, power },
      dive,
      this.difficulty,
    );
    this.sway?.stop();
    this.sway = null;
    this.report();

    // Two quick steps of run-up, then the kick.
    this.striker.setFrame(STRIKER_FRAME.runA);
    this.tweens.add({
      targets: this.striker,
      x: STRIKER_HOME.x + 16,
      y: STRIKER_HOME.y - 6,
      duration: 150,
    });
    this.time.delayedCall(75, () => this.striker.setFrame(STRIKER_FRAME.runB));
    this.time.delayedCall(150, () => {
      this.striker.setFrame(STRIKER_FRAME.kick);
      this.launch(outcome, landing, dive, power);
    });
  }

  private launch(
    outcome: Outcome,
    landing: GoalPoint,
    dive: GoalPoint,
    power: number,
  ) {
    if (this.bridge.sound) sfx.kick();
    // Ball flight: slower for a weak kick, with a little arc.
    const flight = Phaser.Math.Linear(650, 330, Math.min(power, 1));
    const target = toScreen(landing);
    const end =
      outcome === "over"
        ? { x: target.x, y: GOAL.top - 70 }
        : outcome === "wide"
          ? { x: target.x + Math.sign(landing.x) * 40, y: target.y }
          : target;
    const stopAt =
      outcome === "saved"
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
          .setScale(Phaser.Math.Linear(1, 0.6, t) * ART)
          .setFrame(Math.floor(t * 14) % 4);
      },
      onComplete: () => this.land(outcome, end, dive),
    });

    // Bolt reacts a moment after the kick: a dive to the side, a jump for a
    // high middle shot, or a crouch for a low one.
    const diveTo = toScreen(dive);
    const skill = KEEPER[this.difficulty];
    const duration = Math.round(flight * (0.75 - skill.reach));
    this.tweens.killTweensOf(this.keeper);
    this.time.delayedCall(90, () => {
      if (dive.x === 0) {
        const high = dive.y > 0.5;
        this.keeper.setFrame(high ? BOLT_FRAME.cheer : BOLT_FRAME.ready);
        if (high) {
          this.tweens.add({
            targets: this.keeper,
            x: diveTo.x,
            y: KEEPER_HOME.y - 36,
            duration,
            ease: "Quad.easeOut",
          });
        }
        return;
      }
      const side = Math.sign(dive.x);
      this.keeper.setFrame(BOLT_FRAME.dive).setFlipX(side > 0);
      this.tweens.add({
        targets: this.keeper,
        x: diveTo.x + side * 12,
        y: Math.min(diveTo.y + 57, KEEPER_HOME.y),
        duration,
        ease: "Quad.easeOut",
      });
    });
  }

  private land(
    outcome: Outcome,
    end: { x: number; y: number },
    dive: GoalPoint,
  ) {
    this.trail.stop();
    const reduced = this.bridge.reducedMotion;
    const sound = this.bridge.sound;
    const kick = kicksTaken(this.round);
    this.tweens.killTweensOf(this.lamps[kick]);
    this.lamps[kick]
      .setAlpha(1)
      .setFrame(outcome === "goal" ? LAMP.goal : LAMP.miss);

    if (outcome === "goal") {
      this.ball.setVisible(false);
      this.burst(end.x, end.y);
      this.wobbleNet();
      if (!reduced) {
        this.cameras.main.flash(140, 255, 244, 214);
        this.confetti.explode(70, 360, 200);
      }
      this.cheer(1600);
      this.striker.setFrame(STRIKER_FRAME.cheer);
      this.time.delayedCall(260, () => this.keeper.setFrame(BOLT_FRAME.sad));
      if (sound) {
        sfx.cheer();
        sfx.fanfare();
      }
    } else {
      // Bounce the ball away: off Bolt's gloves, the post or out of play.
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
      if (outcome === "saved") {
        this.dust.explode(reduced ? 4 : 14, end.x, end.y);
      } else if (outcome === "post") {
        this.posts.setTintFill(0xffffff);
        this.time.delayedCall(90, () => this.posts.clearTint());
        if (sound) sfx.clang();
      }
      // Bolt gets up and celebrates his luck (or his save).
      this.time.delayedCall(320, () => {
        this.keeper.setFrame(BOLT_FRAME.cheer).setFlipX(false);
        const home = toScreen(dive);
        this.tweens.add({
          targets: this.keeper,
          x: Phaser.Math.Clamp(home.x, GOAL.left + 40, GOAL.right - 40),
          y: KEEPER_HOME.y,
          duration: 220,
          ease: "Quad.easeOut",
        });
      });
      this.time.delayedCall(380, () =>
        popBanner(this, "nova-b-close", 360, 252, {
          hold: 700,
          reduced,
          depth: 51,
        }),
      );
      if (sound) sfx.aww();
    }
    popBanner(this, RESULT_BANNER[outcome], 360, 212, { hold: 800, reduced });

    this.round = recordKick(this.round, outcome);
    this.last = outcome;
    this.phase = "result";
    const score = goals(this.round);
    this.bridge.onScore(score);
    this.report();

    this.time.delayedCall(1500, () => {
      if (isRoundOver(this.round)) {
        this.playing = false;
        popBanner(this, "nova-b-full", 360, 212, { hold: 500, reduced });
        if (score >= 3) this.cheer(900);
        this.time.delayedCall(800, () => this.bridge.onOver(score));
      } else {
        this.nextKick();
      }
    });
  }

  private burst(x: number, y: number) {
    const burst = art(this, x, y, "nova-burst", 0).setDepth(30);
    [1, 2, 3].forEach((frame, i) =>
      this.time.delayedCall((i + 1) * 80, () => burst.setFrame(frame)),
    );
    this.time.delayedCall(340, () => burst.destroy());
  }

  private wobbleNet() {
    for (let i = 0; i < 6; i++) {
      this.time.delayedCall(i * 80, () =>
        this.net.setFrame(i % 2 === 0 ? 1 : 0),
      );
    }
  }

  /** The crowd jumps up and down for `ms`. */
  private cheer(ms: number) {
    this.cheering = true;
    const flips = Math.floor(ms / 130);
    for (let i = 0; i <= flips; i++) {
      this.time.delayedCall(i * 130, () => {
        const frame =
          i === flips ? CROWD.calmA : i % 2 === 0 ? CROWD.cheerA : CROWD.cheerB;
        this.crowd.forEach((row) => row.setFrame(frame));
        if (i === flips) this.cheering = false;
      });
    }
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

  /** Puts a line on the jumbotron. */
  private show(line: keyof typeof SCREEN) {
    const key = `nova-screen-${line}`;
    if (this.screen.texture.key !== key) this.screen.setTexture(key);
  }

  private draw() {
    const screen =
      !this.playing && this.phase !== "result"
        ? "title"
        : this.phase === "aim"
          ? "aim"
          : this.phase === "power"
            ? "shoot"
            : this.phase === "result"
              ? this.last === "goal"
                ? "goal"
                : "miss"
              : "title";
    this.show(screen);
    const aiming =
      this.playing && (this.phase === "aim" || this.phase === "power");
    const { x, y } = toScreen(this.aim);
    this.reticle.setVisible(aiming).setPosition(x, y);
    this.meter
      .setVisible(this.playing)
      .setFrame(this.phase === "power" ? 1 : 0);
    this.pointer
      .setVisible(this.playing && this.phase !== "aim")
      .setY(powerY(this.power));
  }
}
