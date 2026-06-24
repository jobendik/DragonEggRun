import Phaser from 'phaser';
import { COLORS, EFFECT, EGG, PLAYER } from '../world/WorldConstants';
import { StatusEffect, type StatusEffectView, type Vector2 } from '../types/GameTypes';

export interface AdventurerOptions {
  id: string;
  name: string;
  color: number;
  isHuman: boolean;
  x: number;
  y: number;
}

/**
 * Base adventurer entity. Both the human and the AI bots are `Player`s — the
 * only difference is *who sets `moveDir`* each frame (the InputSystem vs the
 * AISystem). That symmetry is deliberate: a future networked opponent would be
 * another `Player` subclass fed by remote input, with no other changes.
 */
export class Player extends Phaser.GameObjects.Container {
  declare body: Phaser.Physics.Arcade.Body;

  readonly id: string;
  readonly adventurerName: string;
  readonly color: number;
  readonly isHuman: boolean;

  /** Desired movement direction (unit vector) set externally each frame. */
  readonly moveDir: Vector2 = { x: 0, y: 0 };
  /** Last facing direction, retained when standing still. */
  readonly facing: Vector2 = { x: 0, y: 1 };
  /** Multiplier applied by the environment (e.g. forest), set by the scene. */
  environmentMultiplier = 1;

  coins = 0;
  isCarrier = false;

  /** Absolute scene-time (ms) at which each effect expires. */
  private speedUntil = 0;
  private shieldUntil = 0;
  private slowUntil = 0;
  private stunUntil = 0;
  private pickupInvulnUntil = 0;

  private readonly bodyRadius = PLAYER.radius;
  private readonly facingIndicator: Phaser.GameObjects.Graphics;
  private readonly shieldRing: Phaser.GameObjects.Graphics;
  private readonly carrierRing: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, opts: AdventurerOptions) {
    super(scene, opts.x, opts.y);
    this.id = opts.id;
    this.adventurerName = opts.name;
    this.color = opts.color;
    this.isHuman = opts.isHuman;

    this.setDepth(opts.isHuman ? 22 : 20);

    this.carrierRing = scene.add.graphics();
    this.shieldRing = scene.add.graphics();
    const bodyGfx = this.drawBody(scene);
    this.facingIndicator = this.drawFacingIndicator(scene);
    this.label = this.drawLabel(scene);

    this.add([this.carrierRing, this.shieldRing, bodyGfx, this.facingIndicator, this.label]);

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body.setCircle(this.bodyRadius, -this.bodyRadius, -this.bodyRadius);
    this.body.setCollideWorldBounds(true);
    this.body.setBounce(0.05);

    this.refreshShield();
    this.refreshCarrier();
  }

  /* ---- per-frame integration ------------------------------------ */

  tick(now: number, deltaMs: number): void {
    const dt = deltaMs / 1000;

    if (this.isStunned(now)) {
      this.body.setVelocity(this.body.velocity.x * 0.8, this.body.velocity.y * 0.8);
      this.setAngle(Math.sin(now / 40) * 6);
    } else {
      this.setAngle(0);
      const speed = this.currentSpeed(now);
      const targetVx = this.moveDir.x * speed;
      const targetVy = this.moveDir.y * speed;
      const t = Math.min(1, PLAYER.steerResponse * dt);
      this.body.setVelocity(
        Phaser.Math.Linear(this.body.velocity.x, targetVx, t),
        Phaser.Math.Linear(this.body.velocity.y, targetVy, t),
      );

      if (this.moveDir.x !== 0 || this.moveDir.y !== 0) {
        this.facing.x = this.moveDir.x;
        this.facing.y = this.moveDir.y;
      }
    }

    this.facingIndicator.setRotation(Math.atan2(this.facing.y, this.facing.x));

    if (this.shieldUntil > now) {
      this.shieldRing.setVisible(true).setAlpha(0.5 + Math.sin(now / 90) * 0.3);
    } else {
      this.shieldRing.setVisible(false);
    }
    if (this.isCarrier) {
      const pulse = 0.55 + Math.sin(now / 110) * 0.35;
      this.carrierRing.setAlpha(pulse);
      this.carrierRing.setScale(1 + Math.sin(now / 220) * 0.08);
    }
  }

  /** Final movement speed including status, carrier penalty and environment. */
  currentSpeed(now: number): number {
    let speed = PLAYER.baseSpeed;
    if (this.speedUntil > now) speed *= PLAYER.boostMultiplier;
    if (this.slowUntil > now) speed *= PLAYER.slowMultiplier;
    if (this.isCarrier) speed *= PLAYER.carrierSpeedMultiplier;
    return speed * this.environmentMultiplier;
  }

  /* ---- status effects ------------------------------------------- */

  applySpeedBoost(now: number): void {
    this.speedUntil = now + EFFECT.boostMs;
    this.slowUntil = 0;
  }

  applyShield(now: number): void {
    this.shieldUntil = now + EFFECT.shieldMs;
    this.refreshShield();
  }

  applySlow(now: number): void {
    if (this.shieldUntil > now) return;
    this.slowUntil = now + EFFECT.slowMs;
    this.speedUntil = 0;
  }

  applyStun(now: number, durationMs: number = EFFECT.stunMs): void {
    if (this.shieldUntil > now) return;
    this.stunUntil = Math.max(this.stunUntil, now + durationMs);
  }

  isShielded(now: number): boolean {
    return this.shieldUntil > now;
  }

  isStunned(now: number): boolean {
    return this.stunUntil > now;
  }

  markPickupInvuln(now: number): void {
    this.pickupInvulnUntil = now + EGG.pickupInvulnMs;
  }

  /** Can a rival currently knock the egg loose from this carrier? */
  isStealable(now: number): boolean {
    return this.isCarrier && now >= this.pickupInvulnUntil && !this.isShielded(now);
  }

  addCoins(amount: number): void {
    this.coins += amount;
  }

  setCarrier(isCarrier: boolean, now: number): void {
    this.isCarrier = isCarrier;
    if (isCarrier) this.pickupInvulnUntil = now + EGG.pickupInvulnMs;
    this.refreshCarrier();
  }

  /** Active effects as lightweight view-models for the HUD (human only). */
  statusViews(now: number): StatusEffectView[] {
    const views: StatusEffectView[] = [];
    if (this.speedUntil > now) {
      views.push({ effect: StatusEffect.Speed, remaining: this.speedUntil - now, duration: EFFECT.boostMs });
    }
    if (this.shieldUntil > now) {
      views.push({ effect: StatusEffect.Shield, remaining: this.shieldUntil - now, duration: EFFECT.shieldMs });
    }
    if (this.slowUntil > now) {
      views.push({ effect: StatusEffect.Slow, remaining: this.slowUntil - now, duration: EFFECT.slowMs });
    }
    if (this.stunUntil > now) {
      views.push({ effect: StatusEffect.Stun, remaining: this.stunUntil - now, duration: EFFECT.stunMs });
    }
    return views;
  }

  /* ---- visuals -------------------------------------------------- */

  private drawBody(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
    const g = scene.add.graphics();
    const r = this.bodyRadius;
    // Soft shadow.
    g.fillStyle(0x0c1a12, 0.32);
    g.fillEllipse(0, r * 0.72, r * 1.9, r * 0.9);
    // Body.
    g.fillStyle(this.color, 1);
    g.fillCircle(0, 0, r);
    // Rim light.
    g.fillStyle(0xffffff, 0.18);
    g.fillCircle(-r * 0.28, -r * 0.32, r * 0.5);
    // Outline — humans get a bright trim so the player can always find themselves.
    g.lineStyle(this.isHuman ? 4 : 3, this.isHuman ? COLORS.humanTrim : 0x10231a, this.isHuman ? 1 : 0.7);
    g.strokeCircle(0, 0, r);
    return g;
  }

  private drawFacingIndicator(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
    const g = scene.add.graphics();
    const r = this.bodyRadius;
    g.fillStyle(0xffffff, 0.92);
    // A wedge pointing along +x; rotated each frame to match `facing`.
    g.fillTriangle(r * 0.2, -r * 0.42, r * 1.05, 0, r * 0.2, r * 0.42);
    return g;
  }

  private drawLabel(scene: Phaser.Scene): Phaser.GameObjects.Text {
    const text = scene.add.text(0, -this.bodyRadius - 15, this.isHuman ? 'You' : this.adventurerName, {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: this.isHuman ? '14px' : '12px',
      color: this.isHuman ? '#eaffff' : '#dfe7ef',
      stroke: '#0a1410',
      strokeThickness: 3,
      fontStyle: this.isHuman ? 'bold' : 'normal',
    });
    text.setOrigin(0.5, 1);
    return text;
  }

  private refreshShield(): void {
    // Drawn once; tick() toggles visibility/alpha based on the shield timer.
    const r = this.bodyRadius + 7;
    this.shieldRing.clear();
    this.shieldRing.lineStyle(3, COLORS.human, 0.85);
    this.shieldRing.strokeCircle(0, 0, r);
    this.shieldRing.setVisible(false);
  }

  private refreshCarrier(): void {
    const r = this.bodyRadius + 13;
    this.carrierRing.clear();
    if (this.isCarrier) {
      this.carrierRing.lineStyle(4, COLORS.egg, 0.9);
      this.carrierRing.strokeCircle(0, 0, r);
      this.carrierRing.fillStyle(COLORS.eggGlow, 0.12);
      this.carrierRing.fillCircle(0, 0, r);
      this.carrierRing.setVisible(true);
    } else {
      this.carrierRing.setVisible(false);
      this.carrierRing.setScale(1);
    }
  }
}
