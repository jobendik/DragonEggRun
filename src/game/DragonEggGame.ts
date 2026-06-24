import Phaser from 'phaser';
import { createGameConfig } from './config';

/**
 * Thin wrapper around `Phaser.Game`. Keeping it as its own class gives the rest
 * of the app a clean construction point and a place to hang lifecycle helpers
 * (e.g. a future `dispose()` for hot-reload teardown).
 */
export class DragonEggGame extends Phaser.Game {
  constructor(parent: HTMLElement) {
    super(createGameConfig(parent));
  }
}
