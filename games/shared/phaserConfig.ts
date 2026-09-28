import Phaser from "phaser";

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
    width,
    height,
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
