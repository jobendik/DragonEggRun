import Phaser from 'phaser';
import type { IslandMap } from '../world/IslandMap';

/**
 * Owns the main camera: bounds, smooth follow, screen shake and flashes.
 * All "felt" world effects (impact shake, the egg-found punch) live here so the
 * GameScene can stay declarative about *when* they happen.
 */
export class CameraSystem {
  private readonly cam: Phaser.Cameras.Scene2D.Camera;

  constructor(
    private readonly scene: Phaser.Scene,
    map: IslandMap,
  ) {
    this.cam = scene.cameras.main;
    this.cam.setBounds(0, 0, map.width, map.height);
    this.cam.setBackgroundColor(0x16384f);
    this.cam.setZoom(this.computeZoom());
    this.cam.setRoundPixels(true);
  }

  follow(target: Phaser.GameObjects.GameObject): void {
    this.cam.startFollow(target, true, 0.12, 0.12);
  }

  stopFollow(): void {
    this.cam.stopFollow();
  }

  /** Pick a zoom that frames a comfortable slice of the world on any screen. */
  private computeZoom(): number {
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;
    const zoom = Math.min(w / 1180, h / 720);
    return Phaser.Math.Clamp(zoom, 0.62, 1.18);
  }

  handleResize(): void {
    this.cam.setZoom(this.computeZoom());
  }

  shake(durationMs: number, intensity: number): void {
    this.cam.shake(durationMs, intensity);
  }

  flash(durationMs: number, r: number, g: number, b: number): void {
    this.cam.flash(durationMs, r, g, b);
  }

  /** A quick zoom "punch" used for the egg-found moment. */
  punchZoom(target: number, holdMs: number): void {
    const base = this.computeZoom();
    this.scene.tweens.add({
      targets: this.cam,
      zoom: target,
      duration: 220,
      yoyo: true,
      hold: holdMs,
      ease: 'Sine.inOut',
      onComplete: () => this.cam.setZoom(base),
    });
  }
}
