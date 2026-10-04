import Phaser from "phaser";
import {
  applyResult,
  isGameOver,
  judgeSwing,
  newCount,
  nextPitch,
  type Count,
  type Pitch,
  type SwingResult,
} from "@/lib/games/star-slugger/logic";
import type { BaseCommand, GameBridge } from "../shared/bridge";
import { bake, fitCamera, HI } from "../shared/phaserConfig";
import { sfx } from "../shared/sfx";

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
/** Ball scale (perspective) at release and at the plate. */
const NEAR = 1.25;
const FAR = 0.35;

const SPARKS = [0xff7a45, 0xffd166, 0x4cc9f0, 0xa78bfa, 0x7ee8c9, 0xf472b6];

export class SluggerScene extends Phaser.Scene {
  private count: Count = newCount();
  private phase: Phase = "windup";
  private playing = false;
  private pitch: Pitch | null = null;
  private elapsed = 0;
  private swung = false;
  private last: SwingResult | null = null;

  private ball!: Phaser.GameObjects.Image;
  private shadow!: Phaser.GameObjects.Image;
  private bat!: Phaser.GameObjects.Image;
  private pitcher!: Phaser.GameObjects.Image;
  private sweetSpot!: Phaser.GameObjects.Graphics;
  private fireworks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private confetti!: Phaser.GameObjects.Particles.ParticleEmitter;
  private crowd: Phaser.GameObjects.Image[] = [];

  constructor(private bridge: GameBridge<SluggerCommand, SluggerState>) {
    super("slugger");
  }

  create() {
    fitCamera(this, W, H);
    this.makeTextures();

    this.add.image(0, 0, "bat-sky").setOrigin(0).setScale(HI);
    for (let i = 0; i < 2; i++) {
      this.crowd.push(
        this.add
          .image(0, 112 + i * 14, `bat-crowd-${i}`)
          .setOrigin(0)
          .setScale(HI),
      );
    }
    this.add.image(0, 0, "bat-field").setOrigin(0).setScale(HI);
    this.pitcher = this.add
      .image(MOUND.x, MOUND.y + 6, "bat-pitcher")
      .setOrigin(0.5, 1)
      .setScale(HI);

    this.sweetSpot = this.add.graphics();
    this.shadow = this.add
      .image(PLATE.x, PLATE.y, "bat-shadow")
      .setScale(HI)
      .setVisible(false);
    this.ball = this.add.image(MOUND.x, MOUND.y, "bat-ball").setVisible(false);

    this.add.image(300, 452, "bat-batter").setOrigin(0.5, 1).setScale(HI);
    // The bat turns around the batter's hands.
    this.bat = this.add
      .image(318, 404, "bat-bat")
      .setOrigin(0.08, 0.5)
      .setScale(HI)
      .setAngle(-125);

    this.fireworks = this.add.particles(0, 0, "bat-spark", {
      speed: { min: 60, max: 220 },
      lifespan: 900,
      gravityY: 80,
      scale: { start: HI, end: 0 },
      tint: SPARKS,
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });
    this.confetti = this.add.particles(0, 0, "bat-confetti", {
      speed: { min: 120, max: 360 },
      angle: { min: 200, max: 340 },
      gravityY: 420,
      lifespan: 1600,
      rotate: { start: 0, end: 540 },
      scale: HI,
      tint: SPARKS,
      emitting: false,
    });

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

  private makeTextures() {
    if (this.textures.exists("bat-sky")) return;
    const g = this.make.graphics({}, false);
    const rng = new Phaser.Math.RandomDataGenerator(["star-slugger"]);

    // Night sky, stars, a big moon and light towers.
    g.fillGradientStyle(0x0b1026, 0x0b1026, 0x2b3668, 0x2b3668);
    g.fillRect(0, 0, W, 170);
    for (let i = 0; i < 90; i++) {
      g.fillStyle(0xffffff, rng.realInRange(0.25, 0.8));
      g.fillCircle(
        rng.between(0, W),
        rng.between(0, 110),
        rng.realInRange(0.5, 1.4),
      );
    }
    g.fillStyle(0xe8ecff);
    g.fillCircle(600, 52, 30);
    g.fillStyle(0xc7d2fe);
    g.fillCircle(590, 44, 6);
    g.fillCircle(612, 62, 4);
    for (const x of [60, 660]) {
      g.fillStyle(0x6d7bb8);
      g.fillRect(x - 3, 40, 6, 80);
      g.fillStyle(0xfff3b0);
      g.fillRoundedRect(x - 18, 30, 36, 14, 4);
    }
    // Outfield wall.
    g.fillStyle(0x1d2650);
    g.fillRect(0, 140, W, 30);
    g.fillStyle(0xffd166);
    g.fillRect(0, 140, W, 3);
    bake(g, "bat-sky", W, 170);

    const heads = [0x7ee8c9, 0xffd166, 0xff9f5a, 0xa78bfa, 0x4cc9f0, 0xf472b6];
    for (let row = 0; row < 2; row++) {
      for (let x = 6 + row * 7; x < W; x += 14) {
        g.fillStyle(heads[rng.between(0, heads.length - 1)]);
        g.fillCircle(x, 7, 5.5);
      }
      bake(g, `bat-crowd-${row}`, W, 14);
    }

    // Grass with mowing stripes, a dusty infield diamond and the mound.
    for (let i = 0; i < 7; i++) {
      g.fillStyle(i % 2 === 0 ? 0x2f9e6e : 0x38b07c);
      g.fillRect(0, 170 + i * 45, W, 45);
    }
    g.fillStyle(0xc89b6d);
    g.fillPoints(
      [
        new Phaser.Math.Vector2(360, 196),
        new Phaser.Math.Vector2(600, 330),
        new Phaser.Math.Vector2(372, 470),
        new Phaser.Math.Vector2(120, 330),
      ],
      true,
    );
    g.fillStyle(0x38b07c);
    g.fillPoints(
      [
        new Phaser.Math.Vector2(360, 238),
        new Phaser.Math.Vector2(520, 330),
        new Phaser.Math.Vector2(370, 410),
        new Phaser.Math.Vector2(200, 330),
      ],
      true,
    );
    g.fillStyle(0xb5895c);
    g.fillEllipse(MOUND.x, MOUND.y + 4, 70, 22);
    g.fillEllipse(PLATE.x, PLATE.y + 20, 150, 50);
    g.lineStyle(2, 0xffffff, 0.8);
    g.strokeRect(PLATE.x - 62, PLATE.y + 2, 40, 40);
    g.strokeRect(PLATE.x + 22, PLATE.y + 2, 40, 40);
    g.fillStyle(0xffffff);
    g.fillPoints(
      [
        new Phaser.Math.Vector2(PLATE.x - 14, PLATE.y + 14),
        new Phaser.Math.Vector2(PLATE.x + 14, PLATE.y + 14),
        new Phaser.Math.Vector2(PLATE.x + 14, PLATE.y + 22),
        new Phaser.Math.Vector2(PLATE.x, PLATE.y + 30),
        new Phaser.Math.Vector2(PLATE.x - 14, PLATE.y + 22),
      ],
      true,
    );
    bake(g, "bat-field", W, H);

    // The Moon Pitcher: a round purple alien with three eyes (48×64).
    g.fillStyle(0xa78bfa);
    g.fillEllipse(24, 40, 36, 40);
    g.fillStyle(0x8b5cf6);
    g.fillEllipse(24, 50, 26, 16);
    g.fillStyle(0xffffff);
    for (const x of [14, 24, 34]) g.fillCircle(x, 30, 4.5);
    g.fillStyle(0x0b1026);
    for (const x of [14, 24, 34]) g.fillCircle(x, 31, 2);
    g.fillStyle(0xa78bfa);
    g.fillEllipse(6, 44, 10, 18);
    g.fillEllipse(42, 44, 10, 18);
    g.fillStyle(0xffd166);
    g.fillCircle(24, 10, 5);
    g.lineStyle(2, 0xa78bfa);
    g.lineBetween(24, 14, 24, 22);
    g.fillStyle(0x6d28d9);
    g.fillRoundedRect(12, 56, 9, 8, 3);
    g.fillRoundedRect(27, 56, 9, 8, 3);
    bake(g, "bat-pitcher", 48, 64);

    // The batter: a kid astronaut seen from behind-left (60×96).
    g.fillStyle(0xff7a45);
    g.fillRoundedRect(14, 38, 32, 40, 10); // suit
    g.fillStyle(0xffffff);
    g.fillRect(14, 54, 32, 6); // stripe
    g.fillStyle(0x6d7bb8);
    g.fillRoundedRect(16, 76, 11, 20, 4); // legs
    g.fillRoundedRect(33, 76, 11, 20, 4);
    g.fillStyle(0xe8ecff);
    g.fillCircle(30, 22, 18); // helmet
    g.fillStyle(0x4cc9f0);
    g.fillRoundedRect(30, 14, 16, 14, 6); // visor
    g.fillStyle(0xff7a45);
    g.fillRoundedRect(36, 44, 18, 9, 4); // arm toward the hands
    bake(g, "bat-batter", 60, 96);

    // Bat (84×14), handle on the left.
    g.fillStyle(0x1b2350);
    g.fillRoundedRect(0, 4, 22, 6, 3);
    g.fillStyle(0xe2b07a);
    g.fillPoints(
      [
        new Phaser.Math.Vector2(18, 4),
        new Phaser.Math.Vector2(80, 1),
        new Phaser.Math.Vector2(84, 7),
        new Phaser.Math.Vector2(80, 13),
        new Phaser.Math.Vector2(18, 10),
      ],
      true,
    );
    bake(g, "bat-bat", 84, 14);

    // Ball (16×16) and its shadow.
    g.fillStyle(0xffffff);
    g.fillCircle(8, 8, 7.5);
    g.lineStyle(1.2, 0xef4444);
    g.beginPath();
    g.arc(2, 8, 6, -1, 1);
    g.strokePath();
    g.beginPath();
    g.arc(14, 8, 6, Math.PI - 1, Math.PI + 1);
    g.strokePath();
    bake(g, "bat-ball", 16, 16);
    g.fillStyle(0x0b1026, 0.35);
    g.fillEllipse(10, 4, 20, 8);
    bake(g, "bat-shadow", 20, 8);

    g.fillStyle(0xffffff);
    g.fillCircle(4, 4, 4);
    bake(g, "bat-spark", 8, 8);
    g.fillRect(0, 0, 8, 5);
    bake(g, "bat-confetti", 8, 5);
    g.destroy();
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
    this.bridge.onScore(0);
    this.windup();
  }

  private windup() {
    this.tweens.killTweensOf([this.ball, this.bat, this.pitcher]);
    this.phase = "windup";
    this.last = null;
    this.swung = false;
    this.pitch = nextPitch(this.count.score);
    this.ball.setVisible(false).setAlpha(1);
    this.shadow.setVisible(false);
    this.bat.setAngle(-125);
    this.report();

    const pause = Phaser.Math.Between(500, 1100);
    this.tweens.add({
      targets: this.pitcher,
      scaleY: 0.82 * HI,
      scaleX: 1.08 * HI,
      duration: 260,
      delay: pause,
      yoyo: true,
      ease: "Sine.easeInOut",
      onComplete: () => this.release(),
    });
  }

  private release() {
    if (!this.playing) return;
    this.phase = "pitch";
    this.elapsed = 0;
    this.ball
      .setPosition(MOUND.x, MOUND.y - 30)
      .setScale(FAR * HI * 2)
      .setVisible(true);
    this.shadow.setVisible(true);
    if (this.bridge.sound) sfx.whoosh();
    this.report();
  }

  private swing() {
    if (!this.playing || this.swung) return;
    if (this.phase !== "pitch") {
      // Practice swing between pitches: just the animation.
      if (this.phase === "windup") this.animateBat();
      return;
    }
    this.swung = true;
    this.animateBat();
    const offset = this.elapsed - (this.pitch?.travelMs ?? 0);
    const result = judgeSwing(offset);
    // A miss lets the ball carry on to the catcher.
    if (result === "strike") return;
    this.finish(result, offset);
  }

  private animateBat() {
    this.tweens.killTweensOf(this.bat);
    this.bat.setAngle(-125);
    this.tweens.add({
      targets: this.bat,
      angle: 55,
      duration: 110,
      ease: "Quad.easeIn",
      onComplete: () =>
        this.tweens.add({
          targets: this.bat,
          angle: -125,
          duration: 380,
          delay: 250,
          ease: "Sine.easeInOut",
        }),
    });
  }

  private finish(result: SwingResult, offset: number) {
    this.phase = "result";
    this.last = result;
    this.count = applyResult(this.count, result);
    this.bridge.onScore(this.count.score);
    this.report();
    this.shadow.setVisible(false);

    const reduced = this.bridge.reducedMotion;
    const sound = this.bridge.sound;
    if (result === "strike") {
      if (sound) sfx.aww();
    } else {
      if (sound) sfx.crack();
      // Early swings pull the ball left, late ones push it right.
      const side = Phaser.Math.Clamp(offset / 160, -1, 1);
      const target =
        result === "homeRun"
          ? { x: 360 + side * 200, y: -30, scale: 0.25 }
          : result === "hit"
            ? {
                x: 360 + side * 220,
                y: Phaser.Math.Between(220, 270),
                scale: 0.5,
              }
            : { x: side < 0 ? -30 : W + 30, y: 300, scale: 0.6 };
      const startX = this.ball.x;
      const startY = this.ball.y;
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
              Phaser.Math.Linear(startX, target.x, t),
              Phaser.Math.Linear(startY, target.y, t) -
                Math.sin(t * Math.PI) * arc,
            )
            .setScale(Phaser.Math.Linear(NEAR, target.scale, t) * HI * 2);
        },
      });
      if (result === "homeRun" || result === "hit") {
        if (sound) this.time.delayedCall(150, () => sfx.cheer());
        this.crowd.forEach((row, i) =>
          this.tweens.add({
            targets: row,
            y: row.y - 5,
            duration: 150,
            delay: i * 60,
            yoyo: true,
            repeat: reduced ? 0 : result === "homeRun" ? 5 : 2,
          }),
        );
      }
      if (result === "homeRun" && !reduced) {
        for (let i = 0; i < 4; i++) {
          this.time.delayedCall(500 + i * 280, () =>
            this.fireworks.explode(
              40,
              Phaser.Math.Between(120, 600),
              Phaser.Math.Between(40, 120),
            ),
          );
        }
        this.time.delayedCall(400, () => this.confetti.explode(80, 360, 240));
      }
    }

    this.time.delayedCall(result === "homeRun" ? 2000 : 1500, () => {
      if (isGameOver(this.count)) {
        this.playing = false;
        this.bridge.onOver(this.count.score);
      } else {
        this.windup();
      }
    });
  }

  update(_time: number, deltaMs: number) {
    this.drawSweetSpot();
    if (!this.playing || this.phase !== "pitch" || !this.pitch) return;
    this.elapsed += deltaMs;
    const travel = this.pitch.travelMs;
    // Past the plate the ball keeps going into the catcher's mitt.
    const t = this.elapsed / travel;
    const eased = t <= 1 ? t * t * 0.4 + t * 0.6 : t;
    this.ball
      .setPosition(
        Phaser.Math.Linear(MOUND.x, PLATE.x, eased),
        Phaser.Math.Linear(MOUND.y - 30, PLATE.y, eased) -
          Math.sin(Math.min(t, 1) * Math.PI) * 18,
      )
      .setScale(Phaser.Math.Linear(FAR, NEAR, Math.min(eased, 1.3)) * HI * 2);
    this.shadow
      .setPosition(
        this.ball.x,
        Phaser.Math.Linear(MOUND.y, PLATE.y + 24, Math.min(eased, 1)),
      )
      .setScale(Phaser.Math.Linear(0.4, 1.2, Math.min(eased, 1)) * HI);

    // No swing, or a swing and a miss: the ball is in the mitt. Strike!
    if (this.elapsed > travel + 260) {
      this.ball.setVisible(false);
      this.finish("strike", 0);
    }
  }

  /** A soft ring over the plate that glows as the ball gets close. */
  private drawSweetSpot() {
    const g = this.sweetSpot;
    g.clear();
    if (!this.playing || this.phase === "result") return;
    let glow = 0.25;
    if (this.phase === "pitch" && this.pitch) {
      const left = this.pitch.travelMs - this.elapsed;
      glow = Phaser.Math.Clamp(1 - Math.abs(left) / 400, 0.25, 1);
    }
    g.lineStyle(3, 0xffd166, glow);
    g.strokeEllipse(PLATE.x, PLATE.y, 64, 30);
  }
}
