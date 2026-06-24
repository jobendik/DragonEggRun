import Phaser from 'phaser';

/**
 * Generates the handful of procedural textures the game needs (mostly particle
 * sprites). No external asset files are loaded — everything else is drawn with
 * Phaser Graphics at runtime.
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  create(): void {
    this.makeSoftParticle('particle', 16);
    this.makeRing('ring', 32);
    this.scene.start('Game');
  }

  /** A soft radial dot used for sparkles, trails and bursts. */
  private makeSoftParticle(key: string, size: number): void {
    if (this.textures.exists(key)) return;
    const g = this.add.graphics();
    const r = size / 2;
    for (let i = r; i > 0; i--) {
      const alpha = Phaser.Math.Clamp(1 - i / r, 0, 1);
      g.fillStyle(0xffffff, alpha * 0.5);
      g.fillCircle(r, r, i);
    }
    g.generateTexture(key, size, size);
    g.destroy();
  }

  private makeRing(key: string, size: number): void {
    if (this.textures.exists(key)) return;
    const g = this.add.graphics();
    const r = size / 2;
    g.lineStyle(3, 0xffffff, 1);
    g.strokeCircle(r, r, r - 3);
    g.generateTexture(key, size, size);
    g.destroy();
  }
}
