import Phaser from "phaser";
import {
  difficulty,
  newRun,
  obstacleY,
  ROCKET,
  scoreFor,
  SECTORS,
  stepRun,
  WORLD,
  type Live,
  type Run,
} from "@/lib/games/rocket-run/logic";
import type { BaseCommand, GameBridge } from "../shared/bridge";
import { bake, fitCamera, HI } from "../shared/phaserConfig";
import { addBanner, BANNER, popBanner } from "../shared/pixel";
import { sfx } from "../shared/sfx";

export type RocketCommand = BaseCommand | { type: "boost" };

export type RocketState = {
  /** Index into SECTORS. */
  sector: number;
};

const { width: W, height: H } = WORLD;

/** Space gets a different tint in each sector. */
const SECTOR_SKY = [0x0b1026, 0x0e1638, 0x170f3a, 0x0a1d36, 0x1f0f34, 0x2a0c2c];

/** Draws all textures in code: original art, nothing to download. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  create() {
    const g = this.make.graphics({}, false);

    // Rocket, facing right (56×32).
    g.fillStyle(0xff5a1f);
    g.fillTriangle(10, 10, 22, 10, 4, 0);
    g.fillTriangle(10, 22, 22, 22, 4, 32);
    g.fillStyle(0xe8ecff);
    g.lineStyle(2, 0x1b2350);
    const body = [
      new Phaser.Math.Vector2(6, 10),
      new Phaser.Math.Vector2(36, 6),
      new Phaser.Math.Vector2(54, 16),
      new Phaser.Math.Vector2(36, 26),
      new Phaser.Math.Vector2(6, 22),
    ];
    g.fillPoints(body, true);
    g.strokePoints(body, true);
    g.fillStyle(0x4cc9f0);
    g.fillCircle(34, 16, 5);
    g.strokeCircle(34, 16, 5);
    bake(g, "rocket", 56, 32);

    // Asteroid (64×64): lumpy rock with craters.
    const rng = new Phaser.Math.RandomDataGenerator(["rocket-run"]);
    const rock: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const r = rng.between(25, 30);
      rock.push(
        new Phaser.Math.Vector2(
          32 + Math.cos(angle) * r,
          32 + Math.sin(angle) * r,
        ),
      );
    }
    g.fillStyle(0x9a8f86);
    g.lineStyle(2, 0x4a4038);
    g.fillPoints(rock, true);
    g.strokePoints(rock, true);
    g.fillStyle(0x7a6f66);
    g.fillCircle(24, 26, 6);
    g.fillCircle(40, 40, 8);
    g.fillCircle(40, 20, 4);
    bake(g, "asteroid", 64, 64);

    // Comet (64×28): an icy head with a glowing tail trailing to the right.
    for (let i = 0; i < 8; i++) {
      g.fillStyle(0x4cc9f0, 0.12 + i * 0.05);
      g.fillEllipse(40 - i * 3, 14, 48 - i * 5, 16 - i * 1.2);
    }
    g.fillStyle(0xc8f4ff);
    g.fillCircle(14, 14, 11);
    g.lineStyle(2, 0x1b2350);
    g.strokeCircle(14, 14, 11);
    g.fillStyle(0xffffff);
    g.fillCircle(11, 11, 4);
    bake(g, "comet", 64, 28);

    // Warning sign for incoming comets (32×30).
    g.fillStyle(0xff5a1f);
    g.lineStyle(3, 0xffffff);
    g.fillTriangle(16, 2, 30, 28, 2, 28);
    g.strokeTriangle(16, 2, 30, 28, 2, 28);
    g.fillStyle(0xffffff);
    g.fillRect(14.5, 10, 3, 10);
    g.fillRect(14.5, 22, 3, 3);
    bake(g, "warning", 32, 30);

    // Particle spark (8×8).
    g.fillStyle(0xffffff);
    g.fillCircle(4, 4, 4);
    bake(g, "spark", 8, 8);

    // Three star layers for parallax (256×256 tiles). Soft dots, so these
    // stay at 1× (tiled sprites with a scaled texture are fiddly).
    g.setScale(1);
    const layers: [string, number, number, number][] = [
      ["stars-far", 70, 1, 0.35],
      ["stars-mid", 35, 1.5, 0.6],
      ["stars-near", 14, 2.2, 0.9],
    ];
    for (const [key, count, size, alpha] of layers) {
      for (let i = 0; i < count; i++) {
        g.fillStyle(0xffffff, alpha * rng.realInRange(0.5, 1));
        g.fillCircle(
          rng.between(0, 255),
          rng.between(0, 255),
          size * rng.realInRange(0.6, 1),
        );
      }
      g.generateTexture(key, 256, 256);
      g.clear();
    }
    g.destroy();

    // Sector banners in the pixel font shared by the arcade games.
    SECTORS.forEach((sector, i) => {
      addBanner(this, `sector-${i}`, `SECTOR ${i + 1}`, {
        ...BANNER.gold,
        scale: 2,
      });
      addBanner(this, `sector-name-${i}`, sector.name, {
        ...BANNER.sky,
        scale: 1,
      });
    });

    this.scene.start("play");
  }
}

type Mode = "idle" | "playing" | "crashed";

/** Rocks from different patterns get slightly different colours. */
const TINT: Record<Live["pattern"], [number, number]> = {
  rock: [0xc8beb4, 0xfff0e0],
  drifter: [0xc4b5fd, 0xe9e2ff],
  pair: [0xd8c8a8, 0xfff2d0],
  wall: [0xa8b0c8, 0xd0d8f0],
  comet: [0xffffff, 0xffffff],
};

export class PlayScene extends Phaser.Scene {
  private mode: Mode = "idle";
  private run: Run = newRun();
  private score = 0;
  private boostQueued = false;

  private sky!: Phaser.GameObjects.Rectangle;
  private layers: [Phaser.GameObjects.TileSprite, number][] = [];
  private rocket!: Phaser.GameObjects.Image;
  private sprites = new Map<number, Phaser.GameObjects.Image>();
  private warnings = new Map<number, Phaser.GameObjects.Image>();
  private exhaust!: Phaser.GameObjects.Particles.ParticleEmitter;
  private boom!: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(private bridge: GameBridge<RocketCommand, RocketState>) {
    super("play");
  }

  create() {
    fitCamera(this, W, H);
    this.sky = this.add.rectangle(0, 0, W, H, SECTOR_SKY[0]).setOrigin(0);
    this.layers = [
      [this.add.tileSprite(0, 0, W, H, "stars-far").setOrigin(0), 0.08],
      [this.add.tileSprite(0, 0, W, H, "stars-mid").setOrigin(0), 0.25],
      [this.add.tileSprite(0, 0, W, H, "stars-near").setOrigin(0), 0.55],
    ];

    const reduced = this.bridge.reducedMotion;
    this.exhaust = this.add.particles(0, 0, "spark", {
      speedX: { min: -260, max: -140 },
      speedY: { min: -35, max: 35 },
      lifespan: reduced ? 220 : 380,
      scale: { start: HI, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [0xffb020, 0xff5a1f, 0xffe08a],
      blendMode: Phaser.BlendModes.ADD,
      frequency: reduced ? 90 : 25,
    });

    this.rocket = this.add
      .image(ROCKET.x, H / 2, "rocket")
      .setScale(HI)
      .setDepth(5);
    this.exhaust.startFollow(this.rocket, -26, 0);

    this.boom = this.add.particles(0, 0, "spark", {
      speed: { min: 60, max: 320 },
      lifespan: 700,
      scale: { start: 1.6 * HI, end: 0 },
      tint: [0xffb020, 0xff5a1f, 0xe8ecff],
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });
    this.boom.setDepth(6);

    this.input.on("pointerdown", () => this.boost());

    const unlisten = this.bridge.listen((command) => {
      switch (command.type) {
        case "start":
          this.startRun();
          break;
        case "pause":
          this.scene.pause();
          break;
        case "resume":
          this.scene.resume();
          break;
        case "boost":
          this.boost();
          break;
      }
    });
    this.events.once(Phaser.Scenes.Events.DESTROY, unlisten);
  }

  private startRun() {
    if (this.scene.isPaused()) this.scene.resume();
    for (const sprite of [...this.sprites.values(), ...this.warnings.values()])
      sprite.destroy();
    this.sprites.clear();
    this.warnings.clear();
    this.mode = "playing";
    this.run = newRun();
    this.score = 0;
    this.boostQueued = false;
    this.tweens.killTweensOf(this.sky);
    this.sky.setFillStyle(SECTOR_SKY[0]);
    this.rocket
      .setVisible(true)
      .setAngle(0)
      .setPosition(ROCKET.x, this.run.flight.y);
    this.exhaust.start();
    this.bridge.onScore(0);
    this.bridge.onState({ sector: 0 });
  }

  private boost() {
    if (this.mode === "playing") this.boostQueued = true;
  }

  private crash() {
    if (this.mode !== "playing") return;
    this.mode = "crashed";
    const reduced = this.bridge.reducedMotion;
    this.exhaust.stop();
    this.boom.explode(reduced ? 12 : 40, this.rocket.x, this.rocket.y);
    this.rocket.setVisible(false);
    if (!reduced) this.cameras.main.shake(300, 0.012);
    if (this.bridge.sound) sfx.crash();
    const finalScore = this.score;
    this.time.delayedCall(700, () => this.bridge.onOver(finalScore));
  }

  /** New sector: banner, chime and a new sky colour. */
  private enterSector(index: number) {
    const reduced = this.bridge.reducedMotion;
    popBanner(this, `sector-${index}`, W / 2, H / 2 - 20, {
      hold: 1000,
      reduced,
    });
    popBanner(this, `sector-name-${index}`, W / 2, H / 2 + 26, {
      hold: 1000,
      reduced,
    });
    if (this.bridge.sound) sfx.levelUp();
    const from = Phaser.Display.Color.ValueToColor(this.sky.fillColor);
    const to = Phaser.Display.Color.ValueToColor(
      SECTOR_SKY[index % SECTOR_SKY.length],
    );
    this.tweens.addCounter({
      from: 0,
      to: 100,
      duration: 1500,
      onUpdate: (tween) => {
        const c = Phaser.Display.Color.Interpolate.ColorWithColor(
          from,
          to,
          100,
          tween.getValue() ?? 0,
        );
        this.sky.setFillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
      },
    });
    this.bridge.onState({ sector: index });
  }

  private addSprite(o: Live) {
    const [lo, hi] = TINT[o.pattern];
    const tint = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(lo),
      Phaser.Display.Color.ValueToColor(hi),
      100,
      Phaser.Math.Between(0, 100),
    );
    const sprite =
      o.kind === "comet"
        ? this.add
            .image(o.x, o.y, "comet")
            .setScale(HI)
            .setOrigin(14 / 64, 0.5)
        : this.add
            .image(o.x, o.y, "asteroid")
            // The rock in the texture is ~28 px radius inside a 64 px frame (at 2×).
            .setScale((o.radius / 28) * HI)
            .setTint(Phaser.Display.Color.GetColor(tint.r, tint.g, tint.b));
    this.sprites.set(o.id, sprite);
    if (o.kind === "comet") {
      const warning = this.add
        .image(W - 24, o.y, "warning")
        .setScale(HI)
        .setDepth(8);
      if (!this.bridge.reducedMotion) {
        this.tweens.add({
          targets: warning,
          alpha: 0.25,
          duration: 160,
          yoyo: true,
          repeat: -1,
        });
      }
      this.warnings.set(o.id, warning);
      if (this.bridge.sound) sfx.blip();
    }
  }

  update(_time: number, deltaMs: number) {
    const dt = Math.min(deltaMs / 1000, 1 / 20);
    const speed =
      this.mode === "playing" ? difficulty(this.run.elapsed).speed : 120;
    for (const [layer, factor] of this.layers) {
      layer.tilePositionX += speed * factor * dt;
    }

    if (this.mode === "playing") {
      const boosting = this.boostQueued;
      this.boostQueued = false;
      const { newSector, spawned, crashed } = stepRun(this.run, dt, boosting);
      if (boosting) {
        this.exhaust.emitParticle(this.bridge.reducedMotion ? 3 : 10);
        if (this.bridge.sound) sfx.boost();
      }
      this.rocket.y = this.run.flight.y;
      this.rocket.angle = Phaser.Math.Clamp(this.run.flight.vy * 0.06, -25, 35);

      const score = scoreFor(this.run.distance);
      if (score !== this.score) {
        this.score = score;
        this.bridge.onScore(score);
      }
      spawned.forEach((o) => this.addSprite(o));
      if (newSector) this.enterSector(this.run.sector);
      this.syncSprites(dt);
      if (crashed) this.crash();
    } else {
      // Idle or crashed: the rocks drift on by.
      for (const sprite of this.sprites.values()) sprite.x -= 120 * dt;
      if (this.mode === "idle")
        this.rocket.y = H / 2 + Math.sin(this.time.now / 400) * 12;
    }
  }

  /** Moves sprites to their obstacles and drops the ones that left the screen. */
  private syncSprites(dt: number) {
    const alive = new Set<number>();
    for (const o of this.run.obstacles) {
      alive.add(o.id);
      const sprite = this.sprites.get(o.id);
      if (!sprite) continue;
      sprite.setPosition(o.x, obstacleY(o, o.age));
      sprite.angle += o.spin * dt;
      const warning = this.warnings.get(o.id);
      if (warning && o.x < W + 20) {
        warning.destroy();
        this.warnings.delete(o.id);
      }
    }
    for (const [id, sprite] of this.sprites) {
      if (!alive.has(id)) {
        sprite.destroy();
        this.sprites.delete(id);
        this.warnings.get(id)?.destroy();
        this.warnings.delete(id);
      }
    }
  }
}
