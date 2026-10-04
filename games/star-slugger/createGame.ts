import Phaser from "phaser";
import type { GameBridge } from "../shared/bridge";
import { baseConfig } from "../shared/phaserConfig";
import {
  H,
  SluggerScene,
  W,
  type SluggerCommand,
  type SluggerState,
} from "./scenes";

export function createGame(
  parent: HTMLElement,
  bridge: GameBridge<SluggerCommand, SluggerState>,
): Phaser.Game {
  return new Phaser.Game(baseConfig(parent, W, H, [new SluggerScene(bridge)]));
}
