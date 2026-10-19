import Phaser from "phaser";
import type { GameBridge } from "../shared/bridge";
import { baseConfig } from "../shared/phaserConfig";
import { H, KickScene, W, type KickCommand, type KickState } from "./scenes";

export function createGame(
  parent: HTMLElement,
  bridge: GameBridge<KickCommand, KickState>,
): Phaser.Game {
  return new Phaser.Game(baseConfig(parent, W, H, [new KickScene(bridge)]));
}
