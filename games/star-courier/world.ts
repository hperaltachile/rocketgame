/**
 * Builds a world's scenery from its entry in lib/games/star-courier/worlds.ts:
 * sky, fog, lights, the big planet, stars, the track and the skyline. The
 * track and skyline pieces are pooled and leapfrog forward as you run.
 */

import {
  BufferGeometry,
  CanvasTexture,
  Float32BufferAttribute,
  Fog,
  Group,
  HemisphereLight,
  DirectionalLight,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Points,
  PointsMaterial,
  RingGeometry,
  SRGBColorSpace,
  DoubleSide,
  type Material,
  type Scene,
} from "three";
import { seeded } from "@/lib/games/rng";
import { CONFIG } from "@/lib/games/star-courier/config";
import type { World } from "@/lib/games/star-courier/worlds";
import { SEGMENT, color, makeSegment, makeSkylinePiece } from "./models";

const SEGMENTS = 16;
const SKYLINE = 36;
const SKYLINE_SPACING = 8;

export type Scenery = {
  /** Moves the pooled pieces and the sky along with the player. */
  update: (distance: number) => void;
  dispose: () => void;
};

function skyTexture(world: World) {
  const canvas = document.createElement("canvas");
  canvas.width = 2;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, world.sky.top);
  g.addColorStop(0.75, world.sky.bottom);
  g.addColorStop(1, world.fog.color);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 2, 256);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export function buildWorld(scene: Scene, world: World): Scenery {
  const root = new Group();
  scene.add(root);
  const rng = seeded(world.id.length * 977 + world.name.charCodeAt(0));

  const sky = skyTexture(world);
  scene.background = sky;
  scene.fog = new Fog(color(world.fog.color), world.fog.near, world.fog.far);

  const hemi = new HemisphereLight(
    color(world.light.sky),
    color(world.light.ground),
    2.2,
  );
  const sun = new DirectionalLight(color(world.light.sun), 1.6);
  sun.position.set(-4, 10, -6);
  root.add(hemi, sun, sun.target);

  // Things that stay put in the sky: they move along with the player.
  const skyGroup = new Group();
  const skyMaterials: Material[] = [];
  root.add(skyGroup);
  const p = world.planet;
  // The sky is further away than the fog, so it ignores the fog.
  const planetMaterial = new MeshLambertMaterial({
    color: p.color,
    flatShading: true,
    fog: false,
  });
  skyMaterials.push(planetMaterial);
  const planet = new Mesh(new IcosahedronGeometry(p.size, 3), planetMaterial);
  planet.position.set(p.x, p.y, 260);
  skyGroup.add(planet);
  if (p.ring) {
    const ringMaterial = new MeshBasicMaterial({
      color: p.ring,
      transparent: true,
      opacity: 0.55,
      side: DoubleSide,
      fog: false,
    });
    skyMaterials.push(ringMaterial);
    const ring = new Mesh(
      new RingGeometry(p.size * 1.35, p.size * 1.9, 48),
      ringMaterial,
    );
    ring.position.copy(planet.position);
    ring.rotation.set(-1.2, 0.3, 0.2);
    skyGroup.add(ring);
  }
  const starPositions: number[] = [];
  for (let i = 0; i < world.stars; i++) {
    const a = rng() * Math.PI * 2;
    const up = 0.08 + rng() * 0.9;
    const r = 300;
    starPositions.push(
      Math.cos(a) * r * Math.cos(up),
      Math.sin(up) * r,
      Math.sin(a) * r * Math.cos(up) + 120,
    );
  }
  const starGeometry = new BufferGeometry();
  starGeometry.setAttribute(
    "position",
    new Float32BufferAttribute(starPositions, 3),
  );
  const stars = new Points(
    starGeometry,
    new PointsMaterial({
      color: "#ffffff",
      size: 1.4,
      sizeAttenuation: false,
      fog: false,
    }),
  );
  skyGroup.add(stars);

  const segments = Array.from({ length: SEGMENTS }, () => {
    const s = makeSegment(world, CONFIG.laneWidth);
    root.add(s);
    return s;
  });

  const skyline = Array.from({ length: SKYLINE }, (_, i) => {
    const piece = makeSkylinePiece(world, rng);
    const side = i % 2 === 0 ? -1 : 1;
    piece.position.set(
      side * (10 + rng() * 26),
      -2 - rng() * 3,
      i * SKYLINE_SPACING,
    );
    piece.rotation.y = rng() * Math.PI;
    root.add(piece);
    return piece;
  });

  return {
    update(distance) {
      skyGroup.position.z = distance;
      const first = Math.floor((distance - SEGMENT) / SEGMENT);
      segments.forEach((s, i) => (s.position.z = (first + i) * SEGMENT));
      const span = SKYLINE * SKYLINE_SPACING;
      for (const piece of skyline) {
        while (piece.position.z < distance - 20) piece.position.z += span;
        while (piece.position.z > distance - 20 + span)
          piece.position.z -= span;
      }
    },
    dispose() {
      scene.remove(root);
      root.traverse((o) => {
        if (o instanceof Mesh || o instanceof Points) o.geometry.dispose();
      });
      stars.material.dispose();
      for (const m of skyMaterials) m.dispose();
      sky.dispose();
      scene.background = null;
      scene.fog = null;
    },
  };
}
