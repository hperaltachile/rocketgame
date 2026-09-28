import Phaser from "phaser";
import {
  collides,
  difficulty,
  ROCKET,
  scoreFor,
  spawnAsteroid,
  stepRocket,
  WORLD,
  type Flight,
} from "@/lib/games/rocket-run/logic";
import type { BaseCommand, GameBridge } from "../shared/bridge";
import { sfx } from "../shared/sfx";

export type RocketCommand = BaseCommand | { type: "boost" };

const { width: W, height: H } = WORLD;

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
    g.generateTexture("rocket", 56, 32);
    g.clear();

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
    g.generateTexture("asteroid", 64, 64);
    g.clear();

    // Particle spark (8×8).
    g.fillStyle(0xffffff);
    g.fillCircle(4, 4, 4);
    g.generateTexture("spark", 8, 8);
    g.clear();

    // Three star layers for parallax (256×256 tiles).
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
    this.scene.start("play");
  }
}

type Mode = "idle" | "playing" | "crashed";

export class PlayScene extends Phaser.Scene {
  private mode: Mode = "idle";
  private flight: Flight = { y: H / 2, vy: 0 };
  private elapsed = 0;
  private distance = 0;
  private score = 0;
  private spawnTimer = 0;
  private boostQueued = false;

  private layers: [Phaser.GameObjects.TileSprite, number][] = [];
  private rocket!: Phaser.Physics.Arcade.Image;
  private asteroids!: Phaser.Physics.Arcade.Group;
  private exhaust!: Phaser.GameObjects.Particles.ParticleEmitter;
  private boom!: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(private bridge: GameBridge<RocketCommand>) {
    super("play");
  }

  create() {
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
      scale: { start: 1, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [0xffb020, 0xff5a1f, 0xffe08a],
      blendMode: Phaser.BlendModes.ADD,
      frequency: reduced ? 90 : 25,
    });

    this.rocket = this.physics.add.image(ROCKET.x, H / 2, "rocket");
    const rocketBody = this.rocket.body as Phaser.Physics.Arcade.Body;
    rocketBody.moves = false;
    rocketBody.setCircle(
      ROCKET.radius + 4,
      28 - ROCKET.radius - 4,
      16 - ROCKET.radius - 4,
    );
    this.exhaust.startFollow(this.rocket, -26, 0);

    this.boom = this.add.particles(0, 0, "spark", {
      speed: { min: 60, max: 320 },
      lifespan: 700,
      scale: { start: 1.6, end: 0 },
      tint: [0xffb020, 0xff5a1f, 0xe8ecff],
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });

    this.asteroids = this.physics.add.group();
    this.physics.add.overlap(
      this.rocket,
      this.asteroids,
      () => this.crash(),
      (_rocket, asteroid) => {
        const a = asteroid as Phaser.Physics.Arcade.Image;
        return collides(
          { x: this.rocket.x, y: this.rocket.y, radius: ROCKET.radius },
          { x: a.x, y: a.y, radius: a.getData("radius") as number },
        );
      },
    );

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
    this.asteroids.clear(true, true);
    this.mode = "playing";
    this.flight = { y: H / 2, vy: 0 };
    this.elapsed = 0;
    this.distance = 0;
    this.score = 0;
    this.spawnTimer = 0.8;
    this.boostQueued = false;
    this.rocket
      .setVisible(true)
      .setAngle(0)
      .setPosition(ROCKET.x, this.flight.y);
    this.exhaust.start();
    this.bridge.onScore(0);
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

  update(_time: number, deltaMs: number) {
    const dt = Math.min(deltaMs / 1000, 1 / 20);
    const speed =
      this.mode === "playing" ? difficulty(this.elapsed).speed : 120;

    for (const [layer, factor] of this.layers) {
      layer.tilePositionX += speed * factor * dt;
    }

    if (this.mode === "playing") {
      this.elapsed += dt;
      const boosting = this.boostQueued;
      this.boostQueued = false;
      this.flight = stepRocket(this.flight, dt, boosting);
      if (boosting) {
        this.exhaust.emitParticle(this.bridge.reducedMotion ? 3 : 10);
        if (this.bridge.sound) sfx.boost();
      }
      this.rocket.y = this.flight.y;
      this.rocket.angle = Phaser.Math.Clamp(this.flight.vy * 0.06, -25, 35);

      this.distance += speed * dt;
      const score = scoreFor(this.distance);
      if (score !== this.score) {
        this.score = score;
        this.bridge.onScore(score);
      }

      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawn(speed);
        this.spawnTimer = difficulty(this.elapsed).spawnEvery;
      }
    } else if (this.mode === "idle") {
      this.rocket.y = H / 2 + Math.sin(this.time.now / 400) * 12;
    }

    for (const child of this.asteroids.getChildren()) {
      const a = child as Phaser.Physics.Arcade.Image;
      a.setVelocityX(-speed * (a.getData("speedFactor") as number));
      if (a.x < -80) a.destroy();
    }
  }

  private spawn(speed: number) {
    const spec = spawnAsteroid();
    const a = this.asteroids.create(
      W + 60,
      spec.y,
      "asteroid",
    ) as Phaser.Physics.Arcade.Image;
    // The rock in the texture is ~28 px radius inside a 64 px frame.
    a.setScale(spec.radius / 28);
    a.setData({ radius: spec.radius, speedFactor: spec.speedFactor });
    (a.body as Phaser.Physics.Arcade.Body).setCircle(28, 4, 4);
    a.setAngularVelocity(spec.spin);
    a.setVelocityX(-speed * spec.speedFactor);
    a.setTint(
      Phaser.Display.Color.GetColor(
        200 + Math.floor(Math.random() * 55),
        190 + Math.floor(Math.random() * 50),
        180 + Math.floor(Math.random() * 60),
      ),
    );
  }
}
