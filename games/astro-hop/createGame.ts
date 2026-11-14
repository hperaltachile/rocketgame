import Phaser from "phaser";
import type { GameBridge } from "../shared/bridge";
import { baseConfig } from "../shared/phaserConfig";
import { H, HopScene, W, type HopCommand, type HopState } from "./scenes";

export function createGame(
  parent: HTMLElement,
  bridge: GameBridge<HopCommand, HopState>,
): Phaser.Game {
  const config = baseConfig(parent, W, H, [new HopScene(bridge)]);
  // Pixel art: no smoothing when the canvas is scaled up.
  return new Phaser.Game({ ...config, pixelArt: true });
}
