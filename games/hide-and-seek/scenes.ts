import Phaser from "phaser";
import { STEP, TILE, VIEW_H, VIEW_W } from "@/lib/games/hide-and-seek/config";
import {
  caughtHint,
  exitRisk,
  nearSpot,
  newGame,
  NO_INPUT,
  remembered,
  spotById,
  spotStatus,
  statusText,
  step,
  type Game,
  type GameEvent,
  type Input,
  type Phase,
  type SeekerMode,
} from "@/lib/games/hide-and-seek/logic";
import { visionPolygon } from "@/lib/games/hide-and-seek/nav";
import { textWidth } from "@/lib/pixelFont";
import type { BaseCommand, GameBridge } from "../shared/bridge";
import { Music, type Tune } from "../shared/music";
import { RENDER_SCALE } from "../shared/phaserConfig";
import {
  addTexture,
  bannerArt,
  BANNER,
  Pixels,
  type BannerStyle,
} from "../shared/pixel";
import { sfx } from "../shared/sfx";
import {
  ASTRO_FRAME,
  hudArt,
  labelArt,
  houseKeys,
  makeArt,
  makeHouseArt,
  PEEKA_FRAME,
  statusArt,
} from "./art";

export type HideCommand =
  | BaseCommand
  | { type: "setup"; house: number }
  | { type: "input"; input: Input }
  | { type: "act" };

export type HideState = {
  phase: Phase;
  round: number;
  roundsWon: number;
  /** Id of the house this round is in. */
  house: string;
  /** Whole seconds left on the round timer. */
  time: number;
  hidden: boolean;
  /** What the Hide/Exit button would do right now. */
  prompt: "hide" | "exit" | null;
  risky: boolean;
  seeker: SeekerMode;
  closeCalls: number;
  /** Read out to screen readers. */
  message: string;
  /** How Peeka found you (game over). */
  hint: string;
};

/** World size handed to Phaser; the camera zooms in to show 360×240 art pixels. */
export const W = 720;
export const H = 480;
const ZOOM = RENDER_SCALE * (W / VIEW_W);
const TOP = 15;
const BOTTOM = 13;

/** Original chiptunes: a sneaky house loop and a faster one when Peeka is near. */
const CALM: Tune = {
  bpm: 112,
  root: 196,
  scale: [0, 2, 3, 5, 7, 9, 10],
  lead: "triangle",
  bass: "square",
  melody: [
    0, -1, 2, -1, 4, -1, 2, -1, 3, -1, -1, 2, 0, -1, -1, -1, 4, -1, 5, -1, 7,
    -1, 5, -1, 4, -1, 2, -1, 0, -1, -1, -1,
  ],
  bassline: [0, -1, 0, -1, 3, -1, 3, -1, 4, -1, 4, -1, 0, -1, 4, -1],
};

const TENSE: Tune = {
  bpm: 150,
  root: 196,
  scale: [0, 1, 3, 5, 7, 8, 10],
  lead: "square",
  bass: "triangle",
  melody: [
    0, 0, -1, 1, 0, -1, 3, -1, 0, 0, -1, 1, 0, -1, 5, -1, 0, 0, -1, 1, 0, -1, 3,
    4, 5, -1, 4, -1, 3, -1, 1, -1,
  ],
  bassline: [0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 5, 5, 4, 4],
};

type Ring = { x: number; y: number; r: number; t: number; color: number };

const formatTime = (s: number) =>
  `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** The pixel font has capitals and a few marks only. */
const pixelText = (s: string) =>
  s
    .toUpperCase()
    .replace(/…/g, "...")
    .replace(/✓/g, "")
    .replace(/[^A-Z0-9 !?.:/\-+',&]/g, "");

export class HideScene extends Phaser.Scene {
  private hs!: Game;
  private playing = false;
  private paused = false;
  private acc = 0;
  private keys: Input = NO_INPUT;
  private acts = 0;
  private music = new Music();
  private tune: Tune | null = null;
  private lastScore = -1;
  private lastState = "";
  private coarse = false;
  private tickSound = 0;

  private player!: Phaser.GameObjects.Image;
  private peeka!: Phaser.GameObjects.Image;
  private bubble!: Phaser.GameObjects.Image;
  private spots = new Map<string, Phaser.GameObjects.Image>();
  private checks = new Map<string, Phaser.GameObjects.Image>();
  private cone!: Phaser.GameObjects.Graphics;
  private fx!: Phaser.GameObjects.Graphics;
  private prompt!: Phaser.GameObjects.Image;
  private promptKey = "";
  private shade!: Phaser.GameObjects.Rectangle;
  private hud!: Phaser.Textures.CanvasTexture;
  private hudKey = "";
  private status!: Phaser.Textures.CanvasTexture;
  private statusKey = "";
  private houseImage!: Phaser.GameObjects.Image;
  private houseId = "";
  private firstHouse = 0;
  private minimap!: Phaser.GameObjects.Image;
  private miniDot!: Phaser.GameObjects.Image;
  private miniPing!: Phaser.GameObjects.Image;
  private pingT = 0;
  private rings: Ring[] = [];
  private bangT = 0;
  private banners: Phaser.GameObjects.Image[] = [];

  constructor(private bridge: GameBridge<HideCommand, HideState>) {
    super("hide");
  }

  create() {
    const cam = this.cameras.main;
    cam.setOrigin(0, 0).setZoom(ZOOM).setRoundPixels(true);
    cam.setBackgroundColor("#0b1026");
    this.coarse =
      typeof window !== "undefined" &&
      window.matchMedia?.("(pointer: coarse)").matches === true;

    const probe = newGame();
    makeArt(this);
    makeHouseArt(this, probe.grid);
    this.houseImage = this.add
      .image(0, 0, houseKeys(probe.grid).house)
      .setOrigin(0)
      .setDepth(0);
    this.cone = this.add.graphics().setDepth(4);
    this.fx = this.add.graphics().setDepth(25);
    this.player = this.add.image(0, 0, "hs-astro", 0).setDepth(10);
    this.peeka = this.add.image(0, 0, "hs-peeka", 0).setDepth(11);
    this.bubble = this.add.image(0, 0, "hs-q").setDepth(40).setVisible(false);
    this.prompt = this.add
      .image(0, 0, "hs-check")
      .setDepth(41)
      .setVisible(false);

    this.shade = this.add
      .rectangle(0, 0, VIEW_W, VIEW_H, 0x0b1026, 0.38)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(90)
      .setVisible(false);
    for (const key of ["hs-hud", "hs-status"])
      if (this.textures.exists(key)) this.textures.remove(key);
    this.hud = this.textures.createCanvas("hs-hud", VIEW_W, TOP)!;
    this.hud.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.add
      .image(0, 0, "hs-hud")
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(110);
    this.status = this.textures.createCanvas("hs-status", VIEW_W, BOTTOM)!;
    this.status.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.add
      .image(0, VIEW_H - BOTTOM, "hs-status")
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(110);
    this.minimap = this.add
      .image(4, TOP + 3, houseKeys(probe.grid).minimap)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(105)
      .setAlpha(0.9);
    this.miniDot = this.add
      .image(0, 0, "hs-dot")
      .setScrollFactor(0)
      .setDepth(106);
    this.miniPing = this.add
      .image(0, 0, "hs-ping")
      .setScrollFactor(0)
      .setDepth(106)
      .setVisible(false);

    this.hs = probe;
    this.showHouse();
    this.render(0);

    const unlisten = this.bridge.listen((command) => {
      switch (command.type) {
        case "setup":
          this.firstHouse = command.house;
          break;
        case "start":
          this.hs = newGame(Math.random, this.firstHouse);
          this.playing = true;
          this.paused = false;
          this.acc = 0;
          this.acts = 0;
          this.keys = NO_INPUT;
          this.lastScore = -1;
          this.lastState = "";
          this.rings = [];
          this.pingT = 0;
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
        case "act":
          if (this.playing && !this.paused) this.acts += 1;
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
    if (!this.hs) return;
    const dt = Math.min(delta, 100) / 1000;
    if (this.playing && !this.paused) {
      this.acc += dt;
      while (this.acc >= STEP) {
        const act = this.acts > 0;
        if (act) this.acts -= 1;
        step(this.hs, this.keys, act);
        this.handleEvents(this.hs.events);
        this.hs.events.length = 0;
        this.acc -= STEP;
        if (!this.playing) break;
      }
    }
    this.updateMusic();
    this.render(this.paused ? 0 : dt);
    if (this.playing || this.hs.phase === "over") this.report();
  }

  // ------------------------------------------------------------ audio and events

  private play(sound: () => void) {
    if (this.bridge.sound) sound();
  }

  private updateMusic() {
    const g = this.hs;
    const s = g.seeker;
    const active =
      this.bridge.sound &&
      this.playing &&
      !this.paused &&
      (g.phase === "play" || g.phase === "countdown");
    const near =
      Math.hypot(s.x - g.player.x, s.y - g.player.y) < TILE * 5 ||
      s.mode === "chase" ||
      s.mode === "suspicious";
    const want = active ? (g.phase === "play" && near ? TENSE : CALM) : null;
    if (want === this.tune) return;
    this.music.stop();
    this.tune = want;
    if (want) this.music.play(want, want === TENSE ? 0.32 : 0.26);
  }

  private stopMusic() {
    this.music.stop();
    this.tune = null;
  }

  private handleEvents(events: GameEvent[]) {
    const g = this.hs;
    const reduced = this.bridge.reducedMotion;
    for (const e of events) {
      switch (e.type) {
        case "countdown":
          if (e.n === 10) {
            this.banner(`ROUND ${g.round}`, BANNER.violet, 1300, 70);
            this.banner(g.grid.house.name.toUpperCase(), BANNER.sky, 1300, 150);
          }
          if (e.n === 9) this.banner("HIDE!", BANNER.gold, 900);
          if (e.n <= 3) {
            this.banner(String(e.n), BANNER.sky, 500);
            this.play(sfx.blip);
          }
          break;
        case "go":
          this.banner("READY OR NOT!", BANNER.pink, 1100);
          this.play(sfx.readyOrNot);
          break;
        case "step":
          this.play(e.running ? sfx.footRun : sfx.footstep);
          break;
        case "bump":
          this.play(sfx.bump);
          if (!reduced) {
            const p = g.player;
            this.tweens.add({
              targets: this.player,
              x: p.x + 1,
              duration: 40,
              yoyo: true,
              repeat: 1,
            });
          }
          break;
        case "hide":
          this.play(sfx.hideIn);
          break;
        case "exit":
          this.play(sfx.peekOut);
          break;
        case "noise":
          this.rings.push({
            x: e.x,
            y: e.y,
            r: e.radius * TILE,
            t: 0,
            color: e.kind === "creak" ? 0xc4b5fd : 0xffffff,
          });
          break;
        case "heard":
          this.play(sfx.heard);
          this.ping();
          break;
        case "suspicious":
          break;
        case "chase":
          this.play(sfx.spotted);
          this.bangT = 0.6;
          this.ping();
          break;
        case "seekerStep": {
          const d =
            Math.hypot(g.seeker.x - g.player.x, g.seeker.y - g.player.y) / TILE;
          if (d < 9) this.play(() => sfx.peekaStep(Math.max(0.15, 1 - d / 9)));
          break;
        }
        case "inspect":
          this.play(sfx.creakOpen);
          break;
        case "checked":
          this.play(sfx.empty);
          break;
        case "closeCall":
          this.play(sfx.phew);
          this.floatText(
            g.player.x,
            g.player.y - 14,
            "+50 CLOSE CALL!",
            "#7ee8c9",
          );
          break;
        case "tick":
          if (++this.tickSound % 1 === 0) this.play(sfx.tick);
          break;
        case "won":
          this.banner("YOU STAYED HIDDEN!", BANNER.gold, 2200);
          this.banner("PEEKA GETS SMARTER...", BANNER.violet, 1800, 150, 900);
          this.play(sfx.clearTune);
          break;
        case "caught":
          this.banner("FOUND YOU!", BANNER.pink, 1400);
          this.play(sfx.found);
          break;
        case "over":
          this.finish();
          break;
      }
    }
  }

  private finish() {
    this.playing = false;
    this.stopMusic();
    this.report();
    this.bridge.onOver(this.hs.score);
  }

  private report() {
    const g = this.hs;
    if (g.score !== this.lastScore) {
      this.lastScore = g.score;
      this.bridge.onScore(g.score);
    }
    const near = nearSpot(g);
    const state: HideState = {
      phase: g.phase,
      round: g.round,
      roundsWon: g.roundsWon,
      house: g.grid.house.id,
      time: Math.ceil(g.time - 1e-9),
      hidden: g.player.hidden !== null,
      prompt: g.player.hidden
        ? "exit"
        : near && spotStatus(g, near) !== "busy"
          ? "hide"
          : null,
      risky: exitRisk(g),
      seeker: g.seeker.mode,
      closeCalls: g.closeCalls,
      message: statusText(g),
      hint: caughtHint(g, g.caught),
    };
    const json = JSON.stringify(state);
    if (json !== this.lastState) {
      this.lastState = json;
      this.bridge.onState(state);
    }
  }

  // ------------------------------------------------------------ effects

  private ping() {
    this.pingT = 2.5;
    const s = this.hs.seeker;
    this.miniPing.setPosition(
      4 + 1 + (s.x / TILE) * 2,
      TOP + 3 + 1 + (s.y / TILE) * 2,
    );
  }

  private banner(
    text: string,
    style: BannerStyle,
    hold: number,
    y = 100,
    delay = 0,
  ) {
    const key = `hs-banner-${text}`;
    if (!this.textures.exists(key))
      addTexture(this, key, bannerArt(text, style));
    const reduced = this.bridge.reducedMotion;
    // A new big message replaces the one on screen (at the same height).
    this.banners = this.banners.filter((b) => {
      if (!b.active) return false;
      if (Math.abs(b.getData("y") - y) > 20) return true;
      this.tweens.killTweensOf(b);
      b.destroy();
      return false;
    });
    const image = this.add
      .image(VIEW_W / 2, y, key)
      .setScrollFactor(0)
      .setDepth(120)
      .setAlpha(0)
      .setData("y", y);
    this.banners.push(image);
    this.tweens.add({
      targets: image,
      alpha: 1,
      y: reduced ? y : y - 4,
      delay,
      duration: 160,
      yoyo: true,
      hold,
      onComplete: () => image.destroy(),
    });
  }

  private floatText(x: number, y: number, text: string, color: string) {
    const key = `hs-float-${text}`;
    if (!this.textures.exists(key)) {
      const p = new Pixels(textWidth(text) + 2, 9);
      p.text(text, 1, 1, color).outline("#140c2c");
      addTexture(this, key, p);
    }
    const image = this.add.image(x, y, key).setDepth(60);
    this.tweens.add({
      targets: image,
      y: y - (this.bridge.reducedMotion ? 0 : 12),
      alpha: 0,
      delay: 500,
      duration: 900,
      onComplete: () => image.destroy(),
    });
  }

  private setPrompt(text: string, fill: string, x: number, y: number) {
    const key = `hs-prompt-${text}-${fill}`;
    if (!this.textures.exists(key)) addTexture(this, key, labelArt(text, fill));
    if (key !== this.promptKey) {
      this.promptKey = key;
      this.prompt.setTexture(key);
    }
    // Keep the whole label on screen, even for spots at the edge of the house.
    const cam = this.cameras.main;
    const half = this.prompt.width / 2 + 2;
    const cx = Phaser.Math.Clamp(
      x,
      cam.scrollX + half,
      cam.scrollX + VIEW_W - half,
    );
    const cy = Math.max(y, cam.scrollY + TOP + 8);
    this.prompt.setPosition(Math.round(cx), Math.round(cy)).setVisible(true);
  }

  // ------------------------------------------------------------ drawing

  /** Swap in the textures, hiding spots and minimap of the current house. */
  private showHouse() {
    const grid = this.hs.grid;
    if (grid.house.id === this.houseId) return;
    this.houseId = grid.house.id;
    makeHouseArt(this, grid);
    const keys = houseKeys(grid);
    this.houseImage.setTexture(keys.house);
    this.minimap.setTexture(keys.minimap);
    for (const image of [...this.spots.values(), ...this.checks.values()])
      image.destroy();
    this.spots.clear();
    this.checks.clear();
    for (const spot of grid.spots) {
      const f = spot.furniture;
      this.spots.set(
        spot.id,
        this.add
          .image(f.col * TILE, f.row * TILE, keys.spot(spot.id), 0)
          .setOrigin(0)
          .setDepth(2),
      );
      this.checks.set(
        spot.id,
        this.add
          .image(spot.x, f.row * TILE - 2, "hs-check")
          .setDepth(30)
          .setVisible(false),
      );
    }
  }

  private render(dt: number) {
    this.showHouse();
    const g = this.hs;
    const p = g.player;
    const s = g.seeker;
    const clock = g.clock;

    // Hiding spots: open while being checked or entered, eyes when you're inside.
    for (const [id, image] of this.spots) {
      let frame = 0;
      if (
        p.hidden === id ||
        (p.trans?.spot === id && p.trans.kind === "enter" && p.trans.t > 0.5)
      )
        frame = 2;
      if (s.inspecting?.spot === id && s.inspecting.t > 0.25) frame = 1;
      if (p.trans?.spot === id && p.trans.t <= 0.5) frame = 1;
      if (
        g.phase === "caught" &&
        g.caught?.kind === "checked" &&
        g.caught.spot === id
      )
        frame = 1;
      image.setFrame(frame);
      const check = this.checks.get(id)!;
      const fresh = remembered(g, id) && s.mode !== "count";
      check.setVisible(fresh);
      if (fresh)
        check.setAlpha(1 - ((clock - s.checked[id]) / g.tuning.memory) * 0.6);
    }

    // The player.
    const visible = !p.hidden || g.phase === "caught";
    let alpha = 1;
    let px = p.x;
    let py = p.y;
    if (p.trans) {
      const spot = spotById(g, p.trans.spot);
      const t = p.trans.kind === "enter" ? p.trans.t : 1 - p.trans.t;
      px = p.x + (spot.x - p.x) * t;
      py = p.y + (spot.y - p.y) * t;
      alpha = 1 - t;
    }
    if (g.phase === "caught" && g.caught?.kind === "checked") {
      const spot = spotById(g, g.caught.spot);
      const a = spotById(g, g.caught.spot).approach;
      px = spot.x + ((a[0] + 0.5) * TILE - spot.x) * Math.min(1, g.phaseT * 3);
      py = spot.y + ((a[1] + 0.5) * TILE - spot.y) * Math.min(1, g.phaseT * 3);
      alpha = 1;
    }
    const walk = p.moving ? Math.floor(p.walkT * (p.running ? 12 : 8)) % 2 : 0;
    const face =
      p.facing === "left" || p.facing === "right" ? "side" : p.facing;
    this.player
      .setFrame(ASTRO_FRAME[face] + walk)
      .setFlipX(p.facing === "left")
      .setPosition(Math.round(px), Math.round(py) - 2)
      .setAlpha(alpha)
      .setVisible(visible || p.trans !== null)
      .setDepth(10 + py / 1000);

    // Peeka.
    const moving = s.path.length > 0 || s.mode === "chase";
    const bob = moving
      ? Math.floor(clock * 5) % 2
      : Math.floor(clock * 1.5) % 2;
    let frame: number = PEEKA_FRAME.down + bob;
    let flip = false;
    if (s.mode === "count") frame = PEEKA_FRAME.count;
    else if (g.phase === "caught" || g.phase === "over")
      frame = PEEKA_FRAME.happy;
    else {
      const cos = Math.cos(s.angle);
      const sin = Math.sin(s.angle);
      if (Math.abs(cos) > Math.abs(sin)) {
        frame = PEEKA_FRAME.side + bob;
        flip = cos < 0;
      } else frame = (sin > 0 ? PEEKA_FRAME.down : PEEKA_FRAME.up) + bob;
    }
    this.peeka
      .setFrame(frame)
      .setFlipX(flip)
      .setPosition(Math.round(s.x), Math.round(s.y) - 3)
      .setDepth(10 + s.y / 1000);

    // Peeka's mood bubble: "?" when unsure, "!" when it spots you.
    this.bangT = Math.max(0, this.bangT - dt);
    const mood =
      s.mode === "chase" || this.bangT > 0
        ? "hs-bang"
        : s.mode === "suspicious" || s.mode === "investigate" || s.inspecting
          ? "hs-q"
          : null;
    this.bubble
      .setVisible(mood !== null && g.phase !== "over")
      .setTexture(mood ?? "hs-q")
      .setPosition(Math.round(s.x) + 8, Math.round(s.y) - 17);

    // Flashlight cone.
    this.cone.clear();
    if (s.mode !== "count" && g.phase !== "over") {
      const color =
        s.mode === "chase"
          ? 0xff5d5d
          : s.mode === "suspicious"
            ? 0xffb347
            : 0xffe08a;
      const points = visionPolygon(
        g.grid,
        s.x,
        s.y,
        s.angle,
        (g.tuning.fov * Math.PI) / 180,
        g.tuning.range * TILE,
      );
      this.cone.fillStyle(color, s.mode === "chase" ? 0.3 : 0.22);
      this.cone.fillPoints(
        points.map(([x, y]) => new Phaser.Math.Vector2(x, y)),
        true,
      );
    }

    // Noise rings and the spot highlight.
    this.fx.clear();
    this.rings = this.rings.filter((r) => {
      r.t += dt;
      const life = 0.7;
      if (r.t >= life) return false;
      this.fx.lineStyle(1, r.color, 0.8 * (1 - r.t / life));
      this.fx.strokeCircle(r.x, r.y, r.r * Math.min(1, r.t / life + 0.15));
      return true;
    });

    const near =
      g.phase === "play" || g.phase === "countdown" ? nearSpot(g) : null;
    this.prompt.setVisible(false);
    if (near) {
      const spot = spotById(g, near);
      const f = spot.furniture;
      const busy = spotStatus(g, near) === "busy";
      const pulse = 0.55 + 0.45 * Math.sin(clock * 6);
      this.fx.lineStyle(1, busy ? 0xff5d5d : 0xffe08a, busy ? 0.9 : pulse);
      this.fx.strokeRect(
        f.col * TILE - 1.5,
        f.row * TILE - 1.5,
        f.w * TILE + 3,
        f.h * TILE + 3,
      );
      const label = busy ? "PEEKA IS HERE" : this.coarse ? "HIDE" : "E  HIDE";
      this.setPrompt(
        label,
        busy ? "#b23a48" : "#2a9d8f",
        spot.x,
        f.row * TILE - 9,
      );
    } else if (p.hidden && (g.phase === "play" || g.phase === "countdown")) {
      const spot = spotById(g, p.hidden);
      const risky = exitRisk(g);
      const label = risky
        ? "! RISKY TO EXIT"
        : this.coarse
          ? "EXIT"
          : "E  EXIT";
      this.setPrompt(
        label,
        risky ? "#b23a48" : "#5b3fa8",
        spot.x,
        spot.furniture.row * TILE - 9,
      );
    }

    // Camera follows the player (or their spot) smoothly.
    const cam = this.cameras.main;
    const target = p.hidden ? spotById(g, p.hidden) : { x: px, y: py };
    const mapW = g.grid.cols * TILE;
    const mapH = g.grid.rows * TILE;
    const tx = Phaser.Math.Clamp(target.x - VIEW_W / 2, 0, mapW - VIEW_W);
    const ty = Phaser.Math.Clamp(
      target.y - VIEW_H / 2,
      -TOP,
      mapH - VIEW_H + BOTTOM,
    );
    const k = dt === 0 ? 1 : Math.min(1, dt * 7);
    cam.setScroll(
      cam.scrollX + (tx - cam.scrollX) * k,
      cam.scrollY + (ty - cam.scrollY) * k,
    );

    // "You are hidden" shade.
    this.shade.setVisible(
      p.hidden !== null && (g.phase === "play" || g.phase === "countdown"),
    );

    // Minimap: you, and a fading ping where Peeka was last heard or seen.
    this.miniDot.setPosition(
      4 + 1 + (px / TILE) * 2,
      TOP + 3 + 1 + (py / TILE) * 2,
    );
    this.pingT = Math.max(0, this.pingT - dt);
    this.miniPing.setVisible(this.pingT > 0).setAlpha(Math.min(1, this.pingT));

    this.drawHud();
  }

  private drawHud() {
    const g = this.hs;
    const counting = g.phase === "countdown";
    const secs = Math.ceil(g.time - 1e-9);
    const values = {
      round: g.round,
      time: formatTime(secs),
      score: g.score,
      urgent: g.phase === "play" && secs <= 10,
      label: counting ? "GET READY" : "",
    };
    const key = JSON.stringify(values);
    if (key !== this.hudKey) {
      this.hudKey = key;
      const ctx = this.hud.getContext();
      ctx.clearRect(0, 0, VIEW_W, TOP);
      ctx.drawImage(hudArt(values).canvas, 0, 0);
      this.hud.refresh();
    }
    const s = g.seeker;
    const danger = s.mode === "chase" || exitRisk(g);
    const text =
      this.playing || g.phase === "over"
        ? pixelText(statusText(g))
        : "STAY HIDDEN UNTIL TIME RUNS OUT!";
    const color = danger
      ? "#ff8a8a"
      : s.mode === "suspicious"
        ? "#ffd166"
        : "#e8ecff";
    const skey = text + color;
    if (skey !== this.statusKey) {
      this.statusKey = skey;
      const ctx = this.status.getContext();
      ctx.clearRect(0, 0, VIEW_W, BOTTOM);
      ctx.drawImage(statusArt(text, color).canvas, 0, 0);
      this.status.refresh();
    }
  }
}
