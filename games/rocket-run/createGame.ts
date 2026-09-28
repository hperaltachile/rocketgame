import Phaser from "phaser";
import { WORLD } from "@/lib/games/rocket-run/logic";
import type { GameBridge } from "../shared/bridge";
import { baseConfig } from "../shared/phaserConfig";
import { BootScene, PlayScene, type RocketCommand } from "./scenes";

export function createGame(
  parent: HTMLElement,
  bridge: GameBridge<RocketCommand>,
): Phaser.Game {
  return new Phaser.Game(
    baseConfig(parent, WORLD.width, WORLD.height, [
      new BootScene(),
      new PlayScene(bridge),
    ]),
  );
}
