/**
 * Star Courier's Three.js side: draws a `Run` from lib/games/star-courier
 * every frame, plays its events as sounds and effects, and talks to the
 * React page through the bridge. All the rules live in logic.ts.
 *
 * Screen mapping: the camera looks down +z, so screen-right is -x. `sx()`
 * flips lane positions so lane 0 shows on the left.
 */

import {
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  OctahedronGeometry,
  PerspectiveCamera,
  Quaternion,
  Scene,
  Vector3,
  WebGLRenderer,
  type Object3D,
} from "three";
import type { ThreeHandle } from "@/components/ThreeGame";
import { SECTORS } from "@/lib/games/star-courier/chunks";
import {
  CONFIG,
  POWER_UPS,
  powerUpTime,
  type PowerUpKind,
} from "@/lib/games/star-courier/config";
import { getCourier, type CourierId } from "@/lib/games/star-courier/couriers";
import {
  laneX,
  multiplier,
  newRun,
  playerHeight,
  playerX,
  scoreOf,
  stepRun,
  type Action,
  type Run,
  type RunEvent,
} from "@/lib/games/star-courier/logic";
import { getWorld, type World } from "@/lib/games/star-courier/worlds";
import type { BaseCommand, GameBridge } from "../shared/bridge";
import { Music } from "../shared/music";
import { sfx } from "../shared/sfx";
import { Particles, Shake } from "./effects";
import {
  disposeMaterials,
  makeCourier,
  makeCrate,
  makeFreighter,
  makeGap,
  makeGate,
  makeGloop,
  makePickup,
  makePod,
  type CourierRig,
  type GloopRig,
} from "./models";
import { POWER_COLORS, POWER_NAMES } from "./names";
import { buildWorld, type Scenery } from "./world";

export type CourierCommand =
  | BaseCommand
  | { type: "setup"; world: string; courier: CourierId }
  | { type: "move"; action: Action };

export type CourierPhase = "ready" | "running" | "caught" | "crash";

export type CourierState = {
  phase: CourierPhase;
  stardust: number;
  multiplier: number;
  distance: number;
  sector: number;
  /** Active power-ups and how much time is left (0–1). */
  power: { kind: PowerUpKind; left: number }[];
  /** Latest message (also read out to screen readers). */
  message: string;
  messageId: number;
  /** Big banner (new sector) or a small toast. */
  banner: boolean;
};

const DT = 1 / 60;
const sx = (x: number) => -x;
const titleCase = (s: string) =>
  s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

type Bridge = GameBridge<CourierCommand, CourierState>;

export function createGame(parent: HTMLElement, bridge: Bridge): ThreeHandle {
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const renderer = new WebGLRenderer({
    antialias: !coarse,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, coarse ? 1.5 : 2));
  renderer.domElement.style.display = "block";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  parent.appendChild(renderer.domElement);

  const scene = new Scene();
  const camera = new PerspectiveCamera(62, 4 / 3, 0.1, 420);
  const particles = new Particles(scene);
  const shake = new Shake();
  const music = new Music();

  let world: World = getWorld(null);
  let scenery: Scenery = buildWorld(scene, world);
  let courierId: CourierId = "pip";
  let rig: CourierRig = makeCourier(getCourier(courierId));
  scene.add(rig.root);
  const gloop: GloopRig = makeGloop();
  scene.add(gloop.root);

  // Stardust: one instanced mesh for all of it.
  const DUST_MAX = 400;
  const dustMaterial = new MeshBasicMaterial({ color: "#ffe066" });
  const dustMesh = new InstancedMesh(
    new OctahedronGeometry(0.3),
    dustMaterial,
    DUST_MAX,
  );
  dustMesh.frustumCulled = false;
  scene.add(dustMesh);
  const m4 = new Matrix4();
  const q = new Quaternion();
  const v3 = new Vector3();
  const s3 = new Vector3();
  const yAxis = new Vector3(0, 1, 0);

  // Pools: meshes are reused by kind as things come and go.
  const pools = new Map<string, Object3D[]>();
  const live = new Map<number, { key: string; obj: Object3D }>();
  const take = (key: string, make: () => Object3D) => {
    const obj = pools.get(key)?.pop() ?? make();
    obj.visible = true;
    scene.add(obj);
    return obj;
  };
  const release = (id: number) => {
    const entry = live.get(id);
    if (!entry) return;
    entry.obj.visible = false;
    scene.remove(entry.obj);
    if (!pools.has(entry.key)) pools.set(entry.key, []);
    pools.get(entry.key)!.push(entry.obj);
    live.delete(id);
  };
  const disposePools = () => {
    for (const id of [...live.keys()]) release(id);
    for (const list of pools.values())
      for (const obj of list)
        obj.traverse((o) => {
          if ("geometry" in o)
            (o as { geometry: { dispose(): void } }).geometry.dispose();
        });
    pools.clear();
  };

  let run: Run = newRun();
  run.nextChunkAt = Infinity;
  let phase: CourierPhase = "ready";
  let paused = false;
  let endTimer = 0;
  let animTime = 0;
  let runPhase = 0;
  let squash = 0;
  let stretch = 0;
  let wobble = 0;
  let fov = 62;
  let aspect = 4 / 3;
  let lastReport = 0;
  let message = "";
  let messageId = 0;
  let banner = false;

  const say = (text: string, big = false) => {
    message = text;
    banner = big;
    messageId++;
    report(true);
  };

  function report(force = false) {
    if (!force && animTime - lastReport < 0.1) return;
    lastReport = animTime;
    bridge.onScore(scoreOf(run));
    bridge.onState({
      phase,
      stardust: run.stardust,
      multiplier: multiplier(run),
      distance: Math.floor(run.distance),
      sector: run.sector,
      power: POWER_UPS.filter((k) => run.active[k] > 0).map((k) => ({
        kind: k,
        left: run.active[k] / powerUpTime(k, run.upgrades[k]),
      })),
      message,
      messageId,
      banner,
    });
  }

  const play = (fn: () => void) => {
    if (bridge.sound) fn();
  };

  function setWorld(id: string) {
    if (id === world.id) return;
    disposePools();
    scenery.dispose();
    world = getWorld(id);
    scenery = buildWorld(scene, world);
  }

  function setCourier(id: CourierId) {
    if (id === courierId) return;
    scene.remove(rig.root);
    courierId = id;
    rig = makeCourier(getCourier(id));
    scene.add(rig.root);
  }

  function start() {
    for (const id of [...live.keys()]) release(id);
    particles.clear();
    shake.reset();
    run = newRun();
    phase = "running";
    paused = false;
    endTimer = 0;
    wobble = squash = stretch = 0;
    rig.root.rotation.set(0, 0, 0);
    rig.body.rotation.set(0, 0, 0);
    message = "";
    banner = false;
    say(`${titleCase(SECTORS[0].name)}! Gloop wants a hug — run!`, false);
    if (bridge.sound) music.play(world.music);
  }

  /** Moves pressed since the last step. */
  const pending: Action[] = [];
  const unlisten = bridge.listen((command) => {
    switch (command.type) {
      case "setup":
        setWorld(command.world);
        setCourier(command.courier);
        break;
      case "start":
        start();
        break;
      case "pause":
        paused = true;
        music.stop();
        break;
      case "resume":
        paused = false;
        if (bridge.sound && phase === "running") music.play(world.music);
        break;
      case "move":
        if (phase === "running" && !paused) pending.push(command.action);
        break;
    }
  });

  function onEvent(e: RunEvent) {
    const p = run.player;
    const x = sx(playerX(p));
    const reduced = bridge.reducedMotion;
    switch (e.type) {
      case "jump":
        stretch = 1;
        play(run.active.boots > 0 ? sfx.boing : sfx.hop);
        break;
      case "boing":
        stretch = 1;
        play(sfx.boing);
        break;
      case "land":
        squash = 1;
        play(sfx.land);
        if (!reduced)
          particles.burst(x, 0.1, run.distance, "#c9c3e6", 8, 2.5, { up: 0.4 });
        break;
      case "slide":
        play(sfx.slide);
        break;
      case "drop":
        play(sfx.swish);
        break;
      case "dust":
        play(() => sfx.stardust(e.streak));
        if (!reduced)
          particles.burst(x, 1, run.distance + 0.6, "#ffe066", 3, 2, {
            gravity: 0,
            life: 0.3,
          });
        break;
      case "power":
        play(sfx.powerUp);
        say(`${POWER_NAMES[e.kind]}!`);
        particles.burst(
          x,
          1,
          run.distance,
          POWER_COLORS[e.kind],
          reduced ? 6 : 24,
          4,
        );
        break;
      case "powerEnd":
        play(sfx.powerDown);
        break;
      case "stumble":
        wobble = 1;
        play(sfx.stumble);
        if (!reduced) {
          shake.kick(0.9);
          particles.burst(x, 0.8, run.distance + 0.4, "#ffb547", 16, 5);
        }
        say("Whoa! Gloop is right behind you!");
        break;
      case "shield":
        play(sfx.pop);
        particles.burst(x, 1, run.distance, "#7cf5ff", reduced ? 8 : 30, 6);
        say("Pop! Your Bubble Shield saved you!");
        break;
      case "smash":
        play(sfx.smash);
        particles.burst(
          sx(laneX(e.lane)),
          1,
          e.z,
          "#ffe066",
          reduced ? 6 : 26,
          7,
        );
        break;
      case "sector": {
        play(sfx.levelUp);
        const s = SECTORS[e.sector];
        say(`SECTOR ${e.sector + 1}: ${s.name}`, true);
        break;
      }
      case "caught":
        phase = "caught";
        music.stop();
        play(sfx.gloop);
        say("Gooped! Gloop gave you a big squishy hug.");
        break;
      case "crash":
        phase = "crash";
        music.stop();
        play(sfx.crash);
        if (!reduced) shake.kick(1.2);
        say("Bonk! You ran into a cargo pod.");
        break;
    }
  }

  // Drawing

  function syncObstacles() {
    const seen = new Set<number>();
    for (const o of run.obstacles) {
      seen.add(o.id);
      let entry = live.get(o.id);
      if (!entry) {
        const variant = o.id % 3;
        const key = o.kind === "pod" ? `pod${variant}` : o.kind;
        const obj = take(key, () => {
          switch (o.kind) {
            case "crate":
              return makeCrate(world);
            case "gate":
              return makeGate(world);
            case "gap":
              return makeGap(world);
            case "pod":
              return makePod(world, variant);
            case "freighter": {
              const f = makeFreighter(world);
              f.root.userData.warning = f.warning;
              return f.root;
            }
          }
        });
        entry = { key, obj };
        live.set(o.id, entry);
      }
      const obj = entry.obj;
      obj.position.set(sx(laneX(o.lane)), 0, o.z);
      if (o.smashed) obj.visible = false;
      const warning = obj.userData.warning as Object3D | undefined;
      if (warning) {
        const ahead = o.z - run.distance;
        warning.visible =
          o.awake && ahead > 4 && Math.floor(animTime * 6) % 2 === 0;
      }
    }
    for (const u of run.pickups) {
      seen.add(u.id);
      let entry = live.get(u.id);
      if (!entry) {
        entry = {
          key: `power-${u.kind}`,
          obj: take(`power-${u.kind}`, () => makePickup(u.kind)),
        };
        live.set(u.id, entry);
      }
      const obj = entry.obj;
      obj.position.set(
        sx(laneX(u.lane)),
        1.2 + Math.sin(animTime * 3 + u.id) * 0.15,
        u.z,
      );
      (obj.userData.icon as Object3D).rotation.y = animTime * 2.5;
      obj.rotation.y = Math.PI;
    }
    for (const id of [...live.keys()]) if (!seen.has(id)) release(id);
  }

  function syncDust() {
    const p = run.player;
    const px = sx(playerX(p));
    const py = p.y + playerHeight(p) / 2;
    const magnet = run.active.magnet > 0;
    let n = 0;
    for (const d of run.dust) {
      if (n >= DUST_MAX) break;
      const ahead = d.z - run.distance;
      if (ahead > 130) continue;
      let x = sx(laneX(d.lane));
      let y = d.y + Math.sin(animTime * 4 + d.id) * 0.08;
      let z = d.z;
      if (magnet && ahead < CONFIG.magnetReach && ahead > -1) {
        // Pulled in: slide toward the player the closer it gets.
        const pull = 1 - Math.max(0, ahead) / CONFIG.magnetReach;
        x += (px - x) * pull;
        y += (py - y) * pull;
        z = run.distance + Math.max(0, ahead) * (1 - pull * 0.5);
      }
      q.setFromAxisAngle(yAxis, animTime * 3 + d.id);
      s3.set(1, 1.3, 1);
      m4.compose(v3.set(x, y, z), q, s3);
      dustMesh.setMatrixAt(n++, m4);
    }
    dustMesh.count = n;
    dustMesh.instanceMatrix.needsUpdate = true;
  }

  function animateCourier(dt: number) {
    const p = run.player;
    const x = sx(playerX(p));
    const root = rig.root;
    root.position.set(x, p.y, run.distance);
    const running = phase === "running" && !paused;
    if (running) runPhase += run.speed * dt * 0.75;
    const airborne = p.y > 0.02;
    const sliding = p.slide > 0;
    const swing = airborne ? 0 : Math.sin(runPhase) * 0.9;
    rig.legs.forEach((leg, i) => {
      leg.rotation.x = airborne ? (i ? -0.5 : 0.7) : i ? -swing : swing;
    });
    rig.arms.forEach((arm, i) => {
      arm.rotation.x = airborne ? -2.4 : i ? swing : -swing;
      arm.rotation.z = airborne ? (i ? -0.4 : 0.4) : 0;
    });
    if (rig.wheel && running) rig.wheel.rotateY((run.speed * dt) / 0.36);
    rig.scarf.forEach((piece, i) => {
      piece.position.y = 1.42 + Math.sin(animTime * 14 - i * 0.9) * 0.05 * i;
      piece.position.x = Math.sin(animTime * 9 - i) * 0.04 * i;
    });

    squash = Math.max(0, squash - dt * 5);
    stretch = Math.max(0, stretch - dt * 4);
    wobble = Math.max(0, wobble - dt * 1.8);
    const sy = 1 - squash * 0.25 + stretch * 0.18;
    const sxz = 1 + squash * 0.18 - stretch * 0.08;
    rig.body.scale.set(sxz, sy, sxz);
    rig.body.rotation.x = sliding ? -1.05 : airborne ? 0.15 : 0.12;
    rig.body.position.y = sliding ? 0.25 : 0;
    // Lean into lane changes, wobble after a stumble.
    const lean = (sx(laneX(p.lane)) - x) * 0.25;
    rig.body.rotation.z = lean + Math.sin(animTime * 30) * wobble * 0.35;

    rig.bubble.visible = run.active.shield > 0;
    if (rig.bubble.visible) rig.bubble.rotation.y = animTime;
    for (const b of rig.boots) b.visible = run.active.boots > 0;
    if (run.active.warp > 0 && !bridge.reducedMotion && phase === "running")
      particles.burst(
        x + (Math.random() - 0.5),
        0.3 + Math.random() * 1.5,
        run.distance - 0.5,
        "#4cc9f0",
        2,
        1,
        { gravity: 0, life: 0.25 },
      );
  }

  function animateGloop(dt: number) {
    const p = run.player;
    const target = sx(playerX(p));
    const g = gloop.root;
    let gap = run.gloopGap;
    if (phase === "caught") gap = Math.max(-0.5, 2.5 - endTimer * 6);
    if (phase === "crash") gap = Math.max(0.8, 8 - endTimer * 6);
    // It drifts after you between lanes a little slowly, so it's rarely
    // right behind you blocking the view.
    g.position.x += (target - g.position.x) * Math.min(1, dt * 1.6);
    g.position.z = run.distance - gap - 0.6;
    g.visible = gap < 9;
    const hug = phase === "caught" ? Math.min(1, endTimer * 2) : 0;
    const size = 0.62 + hug * 0.35;
    const squish = Math.sin(animTime * 7);
    g.scale.set(size * (1 + squish * 0.05), size * (1 - squish * 0.05), size);
    g.position.y = Math.abs(Math.sin(animTime * 5)) * 0.2;
    gloop.eyes.position.y = squish * 0.06;
    gloop.eyes.rotation.z = Math.sin(animTime * 3) * 0.08;
  }

  function placeCamera(dt: number) {
    const p = run.player;
    const x = sx(playerX(p));
    const portrait = aspect < 1;
    const reduced = bridge.reducedMotion;
    const back = portrait ? 7.6 : 6.3;
    const up = portrait ? 4.8 : 3.8;
    const [ox, oy] = reduced ? [0, 0] : shake.offset(dt);
    camera.position.set(
      x * 0.55 + ox,
      up + p.y * 0.35 + oy,
      run.distance - back,
    );
    camera.lookAt(x * 0.35, 1.2 + p.y * 0.25, run.distance + 10);
    // FOV opens up with speed and during Warp Dash (not with reduced motion).
    const base = portrait ? 72 : 60;
    const speedKick =
      ((run.speed - CONFIG.speed.start) /
        (CONFIG.speed.max - CONFIG.speed.start)) *
      6;
    const warpKick = run.active.warp > 0 ? 10 : 0;
    const want = reduced ? base : base + Math.max(0, speedKick) + warpKick;
    fov += (want - fov) * Math.min(1, dt * 3);
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  }

  // Loop

  let raf = 0;
  let last = performance.now();
  let acc = 0;
  let soundWas = bridge.sound;

  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (paused) return;
    animTime += dt;

    // Follow the sound toggle while playing.
    if (bridge.sound !== soundWas) {
      soundWas = bridge.sound;
      if (!bridge.sound) music.stop();
      else if (phase === "running") music.play(world.music);
    }

    if (phase === "running") {
      acc += dt;
      let steps = 0;
      while (acc >= DT && steps < 6) {
        stepRun(run, DT, Math.random, pending.splice(0));
        for (const e of run.events) onEvent(e);
        acc -= DT;
        steps++;
        if (run.over) break;
      }
      if (steps >= 6) acc = 0;
      report();
    } else if (phase === "caught" || phase === "crash") {
      endTimer += dt;
      if (phase === "crash") {
        rig.root.rotation.x = -Math.min(1.3, endTimer * 4);
        if (!bridge.reducedMotion && Math.random() < 0.3)
          particles.burst(
            rig.root.position.x,
            1.6,
            run.distance - 0.6,
            "#ffe066",
            1,
            1.5,
            { gravity: 0, life: 0.5 },
          );
      }
      if (endTimer > 1.5 && endTimer - dt <= 1.5) {
        report(true);
        bridge.onOver(scoreOf(run));
      }
    }

    syncObstacles();
    syncDust();
    animateCourier(dt);
    animateGloop(dt);
    particles.update(dt);
    scenery.update(run.distance);
    placeCamera(dt);
    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(frame);

  return {
    resize(width, height) {
      aspect = width / height;
      renderer.setSize(width, height, false);
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    },
    destroy() {
      cancelAnimationFrame(raf);
      unlisten();
      music.stop();
      disposePools();
      scenery.dispose();
      particles.dispose();
      dustMesh.geometry.dispose();
      dustMaterial.dispose();
      scene.traverse((o) => {
        if ("geometry" in o)
          (o as { geometry: { dispose(): void } }).geometry.dispose();
      });
      disposeMaterials();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
