import Phaser from 'phaser';
import { COLORS } from '../world/WorldConstants';

interface BurstOptions {
  tint: number | number[];
  count: number;
  speed?: number;
  scaleStart?: number;
  scaleEnd?: number;
  lifespan?: number;
  gravityY?: number;
  blend?: boolean;
}

/**
 * Thin wrapper over Phaser's particle emitters. Game systems call semantic
 * helpers (`coinSparkle`, `eggFoundExplosion`, …) rather than building emitter
 * configs inline, keeping particle tuning in one place. Uses the `particle`
 * texture generated in PreloadScene.
 */
export class ParticleSystem {
  private readonly trail: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(private readonly scene: Phaser.Scene) {
    this.trail = scene.add.particles(0, 0, 'particle', {
      tint: COLORS.eggGlow,
      speed: { min: 4, max: 26 },
      scale: { start: 0.7, end: 0 },
      alpha: { start: 0.85, end: 0 },
      lifespan: 520,
      blendMode: Phaser.BlendModes.ADD,
      frequency: -1,
      emitting: false,
    });
    this.trail.setDepth(28);
  }

  private burst(x: number, y: number, opts: BurstOptions): void {
    const emitter = this.scene.add.particles(x, y, 'particle', {
      tint: opts.tint,
      speed: { min: 20, max: opts.speed ?? 160 },
      scale: { start: opts.scaleStart ?? 0.9, end: opts.scaleEnd ?? 0 },
      alpha: { start: 1, end: 0 },
      lifespan: opts.lifespan ?? 600,
      gravityY: opts.gravityY ?? 0,
      blendMode: opts.blend === false ? Phaser.BlendModes.NORMAL : Phaser.BlendModes.ADD,
      emitting: false,
    });
    emitter.setDepth(40);
    emitter.explode(opts.count, x, y);
    this.scene.time.delayedCall((opts.lifespan ?? 600) + 80, () => emitter.destroy());
  }

  carrierTrail(x: number, y: number): void {
    this.trail.emitParticleAt(x, y, 2);
  }

  coinSparkle(x: number, y: number): void {
    this.burst(x, y, { tint: [COLORS.egg, COLORS.gateBeam], count: 12, speed: 130, gravityY: 260 });
  }

  searchPuff(x: number, y: number): void {
    this.burst(x, y, { tint: COLORS.sand, count: 8, speed: 70, lifespan: 420, blend: false });
  }

  trapPuff(x: number, y: number): void {
    this.burst(x, y, { tint: [COLORS.danger, 0x7a2f2f], count: 16, speed: 150, lifespan: 520 });
  }

  shieldPop(x: number, y: number): void {
    this.burst(x, y, { tint: COLORS.human, count: 18, speed: 150, scaleStart: 1.1 });
  }

  boostPop(x: number, y: number): void {
    this.burst(x, y, { tint: COLORS.good, count: 18, speed: 200 });
  }

  hintPop(x: number, y: number): void {
    this.burst(x, y, { tint: COLORS.shrineGlow, count: 14, speed: 120 });
  }

  teleportRings(x: number, y: number): void {
    this.burst(x, y, { tint: [COLORS.portalA, COLORS.portalB], count: 26, speed: 220, lifespan: 700 });
  }

  portalSparkle(x: number, y: number): void {
    this.burst(x, y, { tint: [COLORS.portalA, COLORS.portalB], count: 16, speed: 180 });
  }

  eggFoundExplosion(x: number, y: number): void {
    this.burst(x, y, {
      tint: [COLORS.egg, COLORS.eggGlow, COLORS.gateActive],
      count: 60,
      speed: 320,
      scaleStart: 1.4,
      lifespan: 1000,
    });
  }

  eggDropBurst(x: number, y: number): void {
    this.burst(x, y, {
      tint: [COLORS.egg, COLORS.danger],
      count: 34,
      speed: 260,
      scaleStart: 1.2,
      lifespan: 760,
    });
  }

  pickupFlash(x: number, y: number): void {
    this.burst(x, y, { tint: [COLORS.egg, COLORS.eggGlow], count: 22, speed: 180 });
  }

  celebrate(x: number, y: number): void {
    this.burst(x, y, {
      tint: [COLORS.egg, COLORS.good, COLORS.human, COLORS.portalA],
      count: 80,
      speed: 360,
      scaleStart: 1.3,
      lifespan: 1400,
      gravityY: 200,
    });
  }
}
