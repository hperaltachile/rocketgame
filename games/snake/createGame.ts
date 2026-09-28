import Phaser from "phaser";
import type { GameBridge } from "../shared/bridge";
import { baseConfig } from "../shared/phaserConfig";
import { BOARD, SnakeScene, type SnakeCommand } from "./scenes";

export function createGame(
  parent: HTMLElement,
  bridge: GameBridge<SnakeCommand>,
): Phaser.Game {
  return new Phaser.Game(
    baseConfig(parent, BOARD, BOARD, [new SnakeScene(bridge)]),
  );
}
