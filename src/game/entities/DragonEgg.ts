import Phaser from 'phaser';
import { COLORS } from '../world/WorldConstants';

export type EggVisualState = 'hidden' | 'carried' | 'dropped';

/**
 * The objective object. It is a "dumb" visual: {@link EggSystem} owns the rules
 * (who carries it, when it can be stolen) and positions it each frame, while the
 * egg handles its own glow, bob and shimmer so it always reads as *the* prize.
 */
export class DragonEgg extends Phaser.GameObjects.Container {
  // Named `visualState` (not `state`) to avoid clashing with Phaser's
  // `Container.state` member.
  visualState: EggVisualState = 'hidden';
  /** Scene time the egg was dropped — used by EggSystem for its settle window. */
  droppedAt = 0;

  private readonly glow: Phaser.GameObjects.Graphics;
  private readonly art: Phaser.GameObjects.Graphics;
  private bobPhase = 0;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    this.setDepth(30);

    this.glow = scene.add.graphics();
    this.drawGlow();

    this.art = scene.add.graphics();
    this.drawEgg();

    this.add([this.glow, this.art]);
    scene.add.existing(this);
    this.setVisible(false);
  }

  setVisualState(state: EggVisualState, now: number): void {
    this.visualState = state;
    this.setVisible(state !== 'hidden');
    if (state === 'dropped') {
      this.droppedAt = now;
      this.setScale(1.1);
    } else if (state === 'carried') {
      this.setScale(0.85);
    }
  }

  /** Place the egg, applying a gentle hover when it sits on the ground. */
  place(x: number, y: number, now: number): void {
    this.bobPhase = now / 360;
    const bob = this.visualState === 'dropped' ? Math.sin(this.bobPhase) * 5 : 0;
    this.setPosition(x, y + bob);
  }

  override update(now: number): void {
    if (!this.visible) return;
    const pulse = 0.7 + Math.sin(now / 130) * 0.3;
    this.glow.setAlpha(pulse);
    this.glow.setScale(1 + Math.sin(now / 200) * 0.12);
    this.art.setRotation(Math.sin(now / 500) * 0.12);
  }

  private drawGlow(): void {
    const g = this.glow;
    g.clear();
    for (let i = 5; i >= 1; i--) {
      g.fillStyle(COLORS.eggGlow, 0.1);
      g.fillCircle(0, 0, i * 9);
    }
  }

  private drawEgg(): void {
    const g = this.art;
    g.clear();
    // Shell.
    g.fillStyle(COLORS.egg, 1);
    g.fillEllipse(0, 0, 26, 34);
    g.fillStyle(COLORS.eggShell, 0.9);
    g.fillEllipse(-4, -6, 12, 16);
    // Speckles.
    g.fillStyle(COLORS.hutRoof, 0.8);
    g.fillCircle(5, 2, 3);
    g.fillCircle(-3, 8, 2.4);
    g.fillCircle(7, -8, 2);
    // Outline.
    g.lineStyle(2, 0xb9852f, 0.9);
    g.strokeEllipse(0, 0, 26, 34);
  }
}
