import Phaser from "phaser";
import {
  applyResult,
  isGameOver,
  judgeSwing,
  newCount,
  nextPitch,
  OUTS_PER_GAME,
  STRIKES_PER_OUT,
  type Count,
  type Pitch,
  type SwingResult,
} from "@/lib/games/cosmic-slam/logic";
import type { BaseCommand, GameBridge } from "../shared/bridge";
import { fitCamera } from "../shared/phaserConfig";
import { art, ART, popBanner } from "../shared/pixel";
import { sfx } from "../shared/sfx";
import {
  BALL_SIZES,
  BATTER_ANCHOR,
  BATTER_FRAME,
  BOARD,
  CROWD,
  CROWD_ROWS,
  LAMP,
  makeArt,
  PITCHER_FRAME,
  SCREEN,
  SHADOW_SIZES,
} from "./art";

export type SluggerCommand = BaseCommand | { type: "swing" };

export type Phase = "windup" | "pitch" | "result";

export type SluggerState = {
  phase: Phase;
  count: Count;
  pitch: Pitch | null;
  /** Result of the pitch just thrown, while its message is showing. */
  last: SwingResult | null;
};

export const W = 720;
export const H = 480;

const MOUND = { x: 360, y: 214 };
const PLATE = { x: 372, y: 412 };
const BATTER = { x: 300, y: 452 };
/** Ball scale (perspective) at release and at the plate. */
const NEAR = 1.25;
const FAR = 0.35;

const SPARKS = [0xff7a45, 0xffd166, 0x4cc9f0, 0xa78bfa, 0x7ee8c9, 0xf472b6];

/** Ball frame for a perspective scale (1 = the old 16-unit ball). */
const ballFrame = (scale: number) =>
  Phaser.Math.Clamp(
    Math.round((16 * scale) / ART) - BALL_SIZES[0],
    0,
    BALL_SIZES.length - 1,
  );

const shadowFrame = (scale: number) =>
  Phaser.Math.Clamp(
    Math.round((20 * scale) / ART) - SHADOW_SIZES[0],
    0,
    SHADOW_SIZES.length - 1,
  );

const BANNER: Record<SwingResult, string> = {
  homeRun: "slam-b-homeRun",
  hit: "slam-b-hit",
  foul: "slam-b-foul",
  strike: "slam-b-strike",
};

export class SluggerScene extends Phaser.Scene {
  private count: Count = newCount();
  private phase: Phase = "windup";
  private playing = false;
  private pitch: Pitch | null = null;
  private elapsed = 0;
  private swung = false;
  private last: SwingResult | null = null;
  /** The last strike was strike three. */
  private struckOut = false;
  private cheering = false;
  private batTimers: Phaser.Time.TimerEvent[] = [];

  private ball!: Phaser.GameObjects.Image;
  private shadow!: Phaser.GameObjects.Image;
  private batter!: Phaser.GameObjects.Image;
  private pitcher!: Phaser.GameObjects.Image;
  private ring!: Phaser.GameObjects.Image;
  private screen!: Phaser.GameObjects.Image;
  private strikeLamps: Phaser.GameObjects.Image[] = [];
  private outLamps: Phaser.GameObjects.Image[] = [];
  private digits: Phaser.GameObjects.Image[] = [];
  private crowd: Phaser.GameObjects.Image[] = [];
  private trail!: Phaser.GameObjects.Particles.ParticleEmitter;
  private fireworks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private confetti!: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(private bridge: GameBridge<SluggerCommand, SluggerState>) {
    super("slugger");
  }

  create() {
    fitCamera(this, W, H);
    makeArt(this);
    const reduced = this.bridge.reducedMotion;

    art(this, 0, 0, "slam-sky").setOrigin(0);
    this.twinkles(reduced);
    this.crowd = CROWD_ROWS.map((row, i) =>
      art(this, 0, row.y * ART, `slam-crowd-${i}`, CROWD.calmA).setOrigin(0),
    );
    art(this, 0, 0, "slam-field").setOrigin(0);
    this.scoreboard();

    this.pitcher = art(
      this,
      MOUND.x,
      MOUND.y + 6,
      "slam-pitcher",
      PITCHER_FRAME.idle,
    ).setOrigin(0.5, 1);
    this.ring = art(this, PLATE.x, PLATE.y, "slam-ring", 0);
    this.shadow = art(this, PLATE.x, PLATE.y, "slam-shadow", 0).setVisible(
      false,
    );
    this.trail = this.add.particles(0, 0, "slam-px", {
      speed: { min: 5, max: 20 },
      lifespan: 300,
      scale: { start: ART, end: ART / 3 },
      alpha: { start: 1, end: 0 },
      tint: [0xffd166, 0xffffff, 0xff9f5a],
      frequency: reduced ? 60 : 16,
      emitting: false,
    });
    this.ball = art(this, MOUND.x, MOUND.y, "slam-ball", 0).setVisible(false);
    this.trail.startFollow(this.ball);
    this.batter = art(
      this,
      BATTER.x,
      BATTER.y,
      "slam-batter",
      BATTER_FRAME.stance,
    ).setOrigin(BATTER_ANCHOR.x / BATTER_ANCHOR.w, 1);

    this.fireworks = this.add.particles(0, 0, "slam-px", {
      speed: { min: 60, max: 200 },
      lifespan: 900,
      gravityY: 80,
      scale: ART,
      alpha: { start: 1, end: 0 },
      tint: SPARKS,
      emitting: false,
    });
    this.confetti = this.add.particles(0, 0, "slam-confetti", {
      speed: { min: 120, max: 360 },
      angle: { min: 200, max: 340 },
      gravityY: 420,
      lifespan: 1600,
      scale: ART,
      tint: SPARKS,
      emitting: false,
    });
    this.confetti.setDepth(40);

    // Calm crowd flicker and the pitcher's idle bob.
    this.time.addEvent({
      delay: 520,
      loop: true,
      callback: () => {
        if (!this.cheering) {
          const calmA =
            String(this.crowd[0].frame.name) === String(CROWD.calmA);
          this.crowd.forEach((row) =>
            row.setFrame(calmA ? CROWD.calmB : CROWD.calmA),
          );
        }
        const frame = Number(this.pitcher.frame.name);
        if (frame === PITCHER_FRAME.idle || frame === PITCHER_FRAME.bob) {
          this.pitcher.setFrame(
            frame === PITCHER_FRAME.idle
              ? PITCHER_FRAME.bob
              : PITCHER_FRAME.idle,
          );
        }
      },
    });
    if (!reduced) {
      this.time.addEvent({
        delay: 7000,
        loop: true,
        callback: () => this.shootingComet(),
      });
    }

    this.input.on("pointerdown", () => this.swing());

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
        case "swing":
          this.swing();
          break;
      }
    });
    this.events.once(Phaser.Scenes.Events.DESTROY, unlisten);
  }

  private scoreboard() {
    const x0 = BOARD.x * ART;
    const y0 = BOARD.y * ART;
    art(this, x0, y0, "slam-board").setOrigin(0);
    this.screen = art(
      this,
      x0 + (BOARD.w / 2) * ART,
      y0 + BOARD.lineY * ART,
      "slam-screen-title",
    ).setOrigin(0.5, 0);
    const lampY = y0 + (BOARD.lampsY + 2.5) * ART;
    for (let i = 0; i < STRIKES_PER_OUT; i++) {
      this.strikeLamps.push(
        art(
          this,
          x0 + (BOARD.strikesX + i * BOARD.lampGap + 2.5) * ART,
          lampY,
          "slam-lamp",
          LAMP.off,
        ),
      );
    }
    for (let i = 0; i < OUTS_PER_GAME; i++) {
      this.outLamps.push(
        art(
          this,
          x0 + (BOARD.outsX + i * BOARD.lampGap + 2.5) * ART,
          lampY,
          "slam-lamp",
          LAMP.off,
        ),
      );
    }
    for (let i = 0; i < 3; i++) {
      this.digits.push(
        art(
          this,
          x0 + (BOARD.scoreX + i * 6) * ART,
          y0 + BOARD.lampsY * ART,
          "slam-digit",
          0,
        ).setOrigin(0),
      );
    }
    this.showCount();
  }

  /** Lamps for strikes and outs, and the score in digits. */
  private showCount() {
    this.strikeLamps.forEach((lamp, i) =>
      lamp.setFrame(i < this.count.strikes ? LAMP.strike : LAMP.off),
    );
    this.outLamps.forEach((lamp, i) =>
      lamp.setFrame(i < this.count.outs ? LAMP.out : LAMP.off),
    );
    const text = String(Math.min(999, this.count.score)).padStart(3, " ");
    this.digits.forEach((digit, i) => {
      const ch = text[i];
      digit.setVisible(ch !== " " || i === 2);
      if (ch !== " ") digit.setFrame(Number(ch));
    });
  }

  private twinkles(reduced: boolean) {
    const rng = new Phaser.Math.RandomDataGenerator(["slam-twinkle"]);
    for (let i = 0; i < 9; i++) {
      const x = rng.between(30, 540);
      const star = art(this, x, rng.between(6, 80), "slam-twinkle");
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
    const y = Phaser.Math.Between(10, 60);
    const comet = art(this, -40, y, "slam-comet");
    this.tweens.add({
      targets: comet,
      x: W + 40,
      y: y + 36,
      duration: 1700,
      onComplete: () => comet.destroy(),
    });
  }

  private report() {
    this.bridge.onState({
      phase: this.phase,
      count: this.count,
      pitch: this.pitch,
      last: this.last,
    });
  }

  private startGame() {
    if (this.scene.isPaused()) this.scene.resume();
    this.count = newCount();
    this.playing = true;
    this.showCount();
    this.bridge.onScore(0);
    popBanner(this, "slam-b-up", 360, 300, {
      hold: 600,
      reduced: this.bridge.reducedMotion,
    });
    this.windup();
  }

  private windup() {
    this.tweens.killTweensOf([this.ball, this.pitcher]);
    this.phase = "windup";
    this.last = null;
    this.struckOut = false;
    this.swung = false;
    this.pitch = nextPitch(this.count.score);
    this.ball.setVisible(false).setAlpha(1);
    this.shadow.setVisible(false);
    this.batter.setFrame(BATTER_FRAME.stance);
    this.pitcher.setFrame(PITCHER_FRAME.idle);
    this.report();

    const pause = Phaser.Math.Between(500, 1100);
    this.time.delayedCall(pause, () => {
      if (!this.playing || this.phase !== "windup") return;
      this.pitcher.setFrame(PITCHER_FRAME.windup);
      this.time.delayedCall(520, () => this.release());
    });
  }

  private release() {
    if (!this.playing || this.phase !== "windup") return;
    this.phase = "pitch";
    this.elapsed = 0;
    this.pitcher.setFrame(PITCHER_FRAME.throw);
    this.time.delayedCall(350, () => {
      if (Number(this.pitcher.frame.name) === PITCHER_FRAME.throw)
        this.pitcher.setFrame(PITCHER_FRAME.idle);
    });
    this.ball
      .setPosition(MOUND.x + 6, MOUND.y - 30)
      .setScale(ART)
      .setFrame(ballFrame(FAR))
      .setVisible(true);
    this.shadow.setVisible(true);
    if (this.bridge.sound) sfx.whoosh();
    this.report();
  }

  private swing() {
    if (!this.playing || this.swung) return;
    if (this.phase !== "pitch") {
      // Practice swing between pitches: just the animation.
      if (this.phase === "windup") this.animateBat(true);
      return;
    }
    this.swung = true;
    const offset = this.elapsed - (this.pitch?.travelMs ?? 0);
    const result = judgeSwing(offset);
    this.animateBat(result === "strike" || result === "foul");
    // A miss lets the ball carry on to the catcher.
    if (result === "strike") return;
    this.finish(result, offset);
  }

  /** Load, contact, follow-through, then (unless it was a hit) back to the stance. */
  private animateBat(backToStance: boolean) {
    this.batTimers.forEach((timer) => timer.remove());
    const steps: [number, number][] = [
      [0, BATTER_FRAME.load],
      [45, BATTER_FRAME.contact],
      [110, BATTER_FRAME.follow],
    ];
    if (backToStance) {
      steps.push([520, BATTER_FRAME.load], [600, BATTER_FRAME.stance]);
    }
    this.batTimers = steps.map(([at, frame]) =>
      this.time.delayedCall(at, () => this.batter.setFrame(frame)),
    );
  }

  private finish(result: SwingResult, offset: number) {
    const outsBefore = this.count.outs;
    this.phase = "result";
    this.last = result;
    this.count = applyResult(this.count, result);
    this.struckOut = this.count.outs > outsBefore;
    this.bridge.onScore(this.count.score);
    this.showCount();
    this.report();
    this.shadow.setVisible(false);

    const reduced = this.bridge.reducedMotion;
    const sound = this.bridge.sound;
    if (result === "strike") {
      if (sound) sfx.aww();
      this.pitcher.setFrame(PITCHER_FRAME.cheer);
      popBanner(
        this,
        this.struckOut ? "slam-b-out" : "slam-b-strike",
        360,
        290,
        { hold: 700, reduced },
      );
    } else {
      if (sound) sfx.crack();
      const hitAt = { x: this.ball.x, y: this.ball.y };
      this.burst(hitAt.x, hitAt.y);
      // Early swings pull the ball left, late ones push it right.
      const side = Phaser.Math.Clamp(offset / 160, -1, 1);
      const target =
        result === "homeRun"
          ? { x: 360 + side * 200, y: -30, scale: 0.15 }
          : result === "hit"
            ? {
                x: 360 + side * 220,
                y: Phaser.Math.Between(220, 270),
                scale: 0.45,
              }
            : { x: side < 0 ? -30 : W + 30, y: 300, scale: 0.6 };
      this.trail.start();
      this.tweens.addCounter({
        from: 0,
        to: 1,
        duration: result === "homeRun" ? 1100 : 750,
        ease: "Quad.easeOut",
        onUpdate: (tween) => {
          const t = tween.getValue() ?? 0;
          const arc = result === "foul" ? 60 : 140;
          this.ball
            .setPosition(
              Phaser.Math.Linear(hitAt.x, target.x, t),
              Phaser.Math.Linear(hitAt.y, target.y, t) -
                Math.sin(t * Math.PI) * arc,
            )
            .setFrame(ballFrame(Phaser.Math.Linear(NEAR, target.scale, t)));
        },
        onComplete: () => {
          this.trail.stop();
          if (result === "homeRun") this.ball.setVisible(false);
        },
      });
      popBanner(this, BANNER[result], 360, 290, {
        hold: result === "homeRun" ? 1100 : 700,
        reduced,
      });
      if (result === "homeRun" || result === "hit") {
        this.batTimers.push(
          this.time.delayedCall(700, () =>
            this.batter.setFrame(BATTER_FRAME.cheer),
          ),
        );
        if (sound) this.time.delayedCall(150, () => sfx.cheer());
        this.cheer(result === "homeRun" ? 1800 : 900);
      }
      if (result === "homeRun") {
        if (sound) this.time.delayedCall(300, () => sfx.fanfare());
        if (!reduced) {
          this.cameras.main.flash(160, 255, 244, 214);
          for (let i = 0; i < 4; i++) {
            this.time.delayedCall(500 + i * 280, () =>
              this.fireworks.explode(
                36,
                Phaser.Math.Between(120, 600),
                Phaser.Math.Between(30, 110),
              ),
            );
          }
          this.time.delayedCall(400, () => this.confetti.explode(80, 360, 240));
        }
      }
    }

    this.time.delayedCall(result === "homeRun" ? 2000 : 1500, () => {
      if (isGameOver(this.count)) {
        this.playing = false;
        popBanner(this, "slam-b-over", 360, 290, { hold: 500, reduced });
        this.time.delayedCall(800, () => this.bridge.onOver(this.count.score));
      } else {
        this.windup();
      }
    });
  }

  private burst(x: number, y: number) {
    const burst = art(this, x, y, "slam-burst", 0).setDepth(30);
    [1, 2, 3].forEach((frame, i) =>
      this.time.delayedCall((i + 1) * 70, () => burst.setFrame(frame)),
    );
    this.time.delayedCall(300, () => burst.destroy());
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
    this.drawSweetSpot();
    this.showScreen();
    if (!this.playing || this.phase !== "pitch" || !this.pitch) return;
    this.elapsed += deltaMs;
    const travel = this.pitch.travelMs;
    // Past the plate the ball keeps going into the catcher's mitt.
    const t = this.elapsed / travel;
    const eased = t <= 1 ? t * t * 0.4 + t * 0.6 : t;
    this.ball
      .setPosition(
        Phaser.Math.Linear(MOUND.x + 6, PLATE.x, eased),
        Phaser.Math.Linear(MOUND.y - 30, PLATE.y, eased) -
          Math.sin(Math.min(t, 1) * Math.PI) * 18,
      )
      .setFrame(ballFrame(Phaser.Math.Linear(FAR, NEAR, Math.min(eased, 1.3))));
    this.shadow
      .setPosition(
        this.ball.x,
        Phaser.Math.Linear(MOUND.y, PLATE.y + 24, Math.min(eased, 1)),
      )
      .setFrame(shadowFrame(Phaser.Math.Linear(0.4, 1.2, Math.min(eased, 1))));

    // No swing, or a swing and a miss: the ball is in the mitt. Strike!
    if (this.elapsed > travel + 260) {
      this.ball.setVisible(false);
      this.finish("strike", 0);
    }
  }

  private showScreen() {
    let line: keyof typeof SCREEN = "title";
    if (this.playing || this.phase === "result") {
      if (this.phase === "windup" && this.pitch) line = this.pitch.speed;
      else if (this.phase === "pitch") line = "swing";
      else if (this.phase === "result" && this.last)
        line = this.struckOut ? "out" : this.last;
    }
    const key = `slam-screen-${line}`;
    if (this.screen.texture.key !== key) this.screen.setTexture(key);
  }

  /** The ring over the plate glows as the ball gets close. */
  private drawSweetSpot() {
    if (!this.playing || this.phase === "result") {
      this.ring.setVisible(false);
      return;
    }
    let glow = 0.55;
    if (this.phase === "pitch" && this.pitch) {
      const left = this.pitch.travelMs - this.elapsed;
      glow = Phaser.Math.Clamp(1 - Math.abs(left) / 400, 0.55, 1);
    }
    this.ring
      .setVisible(true)
      .setAlpha(glow)
      .setFrame(glow > 0.75 ? 1 : 0);
  }
}
