import Phaser from 'phaser';
import { COLORS } from '../world/WorldConstants';
import type { ExtractionGateDef } from '../types/GameTypes';

/**
 * An extraction point. Dormant (and visibly sealed) during exploration, it roars
 * to life once the egg is found — the carrier's goal, the chasers' ambush spot.
 */
export class ExtractionGate extends Phaser.GameObjects.Container {
  readonly def: ExtractionGateDef;
  // Reuses Phaser's GameObject `active` flag (harmless for a manually-updated
  // container) as the gameplay "gate is open" state.
  override active = false;

  private readonly base: Phaser.GameObjects.Graphics;
  private readonly beam: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, def: ExtractionGateDef) {
    super(scene, def.x, def.y);
    this.def = def;
    // Above the escape-phase ground tint so gates stay vivid during the chase.
    this.setDepth(16);

    this.beam = scene.add.graphics();
    this.base = scene.add.graphics();
    this.add([this.beam, this.base]);
    this.drawDormant();

    scene.add.existing(this);
  }

  get id(): string {
    return this.def.id;
  }

  activate(): void {
    if (this.active) return;
    this.active = true;
    this.drawActive();
    this.scene.tweens.add({
      targets: this,
      scale: { from: 0.6, to: 1 },
      duration: 420,
      ease: 'Back.out',
    });
  }

  override update(now: number): void {
    if (!this.active) return;
    const pulse = 0.55 + Math.sin(now / 120) * 0.45;
    this.beam.setAlpha(pulse);
    this.beam.setScale(1, 1 + Math.sin(now / 240) * 0.06);
  }

  private drawDormant(): void {
    const g = this.base;
    g.clear();
    g.fillStyle(0x0c1a12, 0.3);
    g.fillEllipse(0, 30, 70, 22);
    // Two leaning pillars + a sealed arch.
    g.fillStyle(COLORS.ruinDark, 1);
    g.fillRoundedRect(-34, -36, 14, 70, 3);
    g.fillRoundedRect(20, -36, 14, 70, 3);
    g.fillStyle(COLORS.ruin, 1);
    g.fillRoundedRect(-34, -48, 68, 16, 4);
    g.fillStyle(0x12202c, 0.85);
    g.fillRoundedRect(-20, -32, 40, 66, 4);
  }

  private drawActive(): void {
    // Beam behind the arch.
    const b = this.beam;
    b.clear();
    b.fillStyle(COLORS.gateBeam, 0.45);
    b.fillEllipse(0, -4, 56, 96);
    b.fillStyle(COLORS.gateActive, 0.6);
    b.fillEllipse(0, 0, 34, 74);

    const g = this.base;
    g.clear();
    g.fillStyle(0x0c1a12, 0.3);
    g.fillEllipse(0, 30, 78, 24);
    g.fillStyle(COLORS.gate, 1);
    g.fillRoundedRect(-36, -40, 16, 76, 3);
    g.fillRoundedRect(20, -40, 16, 76, 3);
    g.fillStyle(COLORS.gateActive, 1);
    g.fillRoundedRect(-38, -54, 76, 18, 4);
    // Glowing runes on the pillars.
    g.fillStyle(COLORS.gateBeam, 0.9);
    g.fillCircle(-28, -10, 4);
    g.fillCircle(28, -10, 4);
    g.fillCircle(-28, 14, 4);
    g.fillCircle(28, 14, 4);
  }
}
