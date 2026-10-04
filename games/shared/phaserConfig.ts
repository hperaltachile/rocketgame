import Phaser from "phaser";

/**
 * The canvas has 2× the pixels of the game world and every scene's camera
 * zooms in 2×, so the game stays sharp when it's scaled up to fullscreen.
 * Scenes keep working in world units (e.g. 720×480).
 */
export const RENDER_SCALE = 2;

/** Points the scene's camera at the whole world at RENDER_SCALE. */
export function fitCamera(scene: Phaser.Scene, width: number, height: number) {
  scene.cameras.main.setZoom(RENDER_SCALE).centerOn(width / 2, height / 2);
}

/**
 * Saves what `g` has drawn (in world units) as a texture with RENDER_SCALE
 * times the pixels. Show it with `.setScale(1 / RENDER_SCALE)` (or `HI`).
 */
export function bake(
  g: Phaser.GameObjects.Graphics,
  key: string,
  width: number,
  height: number,
) {
  g.setScale(RENDER_SCALE);
  g.generateTexture(key, width * RENDER_SCALE, height * RENDER_SCALE);
  g.clear();
}

/** Scale for images made with `bake` so they appear at their world size. */
export const HI = 1 / RENDER_SCALE;

/** Shared Phaser setup: fit-and-center scaling, Arcade physics, React owns keyboard and audio. */
export function baseConfig(
  parent: HTMLElement,
  width: number,
  height: number,
  scene: Phaser.Types.Scenes.SceneType[],
): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    width: width * RENDER_SCALE,
    height: height * RENDER_SCALE,
    backgroundColor: "#0b1026",
    banner: false,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: { default: "arcade", arcade: { debug: false } },
    // Keyboard is handled by the React page (so buttons and page shortcuts
    // keep working), and sounds by games/shared/sfx.ts.
    input: { keyboard: false },
    audio: { noAudio: true },
    fps: { target: 60 },
    scene,
  };
}
