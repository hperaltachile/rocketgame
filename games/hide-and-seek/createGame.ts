import Phaser from "phaser";
import type { GameBridge } from "../shared/bridge";
import { baseConfig } from "../shared/phaserConfig";
import { H, HideScene, W, type HideCommand, type HideState } from "./scenes";

export function createGame(
  parent: HTMLElement,
  bridge: GameBridge<HideCommand, HideState>,
): Phaser.Game {
  const config = baseConfig(parent, W, H, [new HideScene(bridge)]);
  // Pixel art: no smoothing when the canvas is scaled up.
  return new Phaser.Game({ ...config, pixelArt: true });
}
