import Phaser from 'phaser';

/** Minimal boot scene: configure input/scale, then hand off to preload. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.scale.scaleMode = Phaser.Scale.RESIZE;
    this.input.setDefaultCursor('default');
    this.scene.start('Preload');
  }
}
