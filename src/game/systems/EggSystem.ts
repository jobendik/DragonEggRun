import { eventBus } from '../types/Events';
import { GamePhase, MatchOutcome, type CarrierHistoryEntry } from '../types/GameTypes';
import { EGG, MATCH, PLAYER } from '../world/WorldConstants';
import type { Player } from '../entities/Player';
import type { GameRefs } from './GameRefs';

const PICKUP_RADIUS = 42;

/**
 * The dramatic core of the game: who holds the Dragon Egg, how it is knocked
 * loose, scooped up, and finally extracted. Pure gameplay/logic — it emits
 * semantic events and lets the GameScene/UI handle the cinematics (shake,
 * lighting, banners).
 */
export class EggSystem {
  private carrier: Player | null = null;
  private readonly history: CarrierHistoryEntry[] = [];
  private lastCarrierName: string | null = null;

  private trailAccum = 0;
  private groundX = 0;
  private groundY = 0;

  constructor(private readonly refs: GameRefs) {}

  getCarrier(): Player | null {
    return this.carrier;
  }

  /** True when the egg is loose on the ground (anyone can grab it). */
  isDropped(): boolean {
    return !this.carrier && this.refs.egg.visualState === 'dropped';
  }

  getGroundPosition(): { x: number; y: number } {
    return { x: this.groundX, y: this.groundY };
  }

  getHistory(): CarrierHistoryEntry[] {
    return this.history.map((h) => ({ ...h }));
  }

  /** First discovery — kicks off the whole escape sequence. */
  captureEgg(finder: Player, now: number): void {
    this.setCarrierInternal(finder, now, null);
    this.refs.egg.setVisualState('carried', now);
    this.refs.particles.eggFoundExplosion(finder.x, finder.y);
    eventBus.emit('egg:found', {
      carrierId: finder.id,
      carrierName: finder.adventurerName,
      isHuman: finder.isHuman,
    });
    eventBus.emit('notification:show', {
      message: `${finder.isHuman ? 'You' : finder.adventurerName} found the Dragon Egg!`,
      tone: 'epic',
      icon: '🐉',
    });
    eventBus.emit('audio:play', { sound: 'eggFound' });
    this.refs.state.enterEggFound();
  }

  update(now: number, deltaMs: number): void {
    const phase = this.refs.state.phase;
    const egg = this.refs.egg;

    if (this.carrier) {
      egg.place(this.carrier.x, this.carrier.y - PLAYER.radius * 0.4, now);
      egg.update(now);
      if (phase === GamePhase.Escape) {
        this.trailAccum += deltaMs;
        if (this.trailAccum >= EGG.trailIntervalMs) {
          this.trailAccum = 0;
          this.refs.particles.carrierTrail(this.carrier.x, this.carrier.y + 6);
        }
        this.checkSteal(now);
        this.checkExtraction(now);
      }
    } else if (egg.visualState === 'dropped') {
      egg.place(this.groundX, this.groundY, now);
      egg.update(now);
      if (phase === GamePhase.Escape) this.checkPickup(now);
    }
  }

  /* ---- internals ------------------------------------------------ */

  private setCarrierInternal(player: Player, now: number, previousName: string | null): void {
    this.carrier = player;
    player.setCarrier(true, now);
    this.history.push({ name: player.adventurerName, isHuman: player.isHuman, atMs: now });
    eventBus.emit('egg:carrier-changed', {
      carrierId: player.id,
      carrierName: player.adventurerName,
      isHuman: player.isHuman,
      previousName,
    });
  }

  private checkSteal(now: number): void {
    const carrier = this.carrier;
    if (!carrier || !carrier.isStealable(now)) return;
    const r2 = EGG.stealRadius * EGG.stealRadius;
    for (const player of this.refs.players) {
      if (player === carrier) continue;
      if (player.isStunned(now)) continue;
      const dx = player.x - carrier.x;
      const dy = player.y - carrier.y;
      if (dx * dx + dy * dy <= r2) {
        this.dropEgg(now);
        return;
      }
    }
  }

  private dropEgg(now: number): void {
    const prev = this.carrier;
    if (!prev) return;
    prev.setCarrier(false, now);
    this.lastCarrierName = prev.adventurerName;
    this.carrier = null;
    this.groundX = prev.x;
    this.groundY = prev.y;
    this.refs.egg.setVisualState('dropped', now);
    this.refs.egg.place(this.groundX, this.groundY, now);
    this.refs.particles.eggDropBurst(this.groundX, this.groundY);
    eventBus.emit('egg:dropped', { x: this.groundX, y: this.groundY, byName: prev.adventurerName });
    eventBus.emit('audio:play', { sound: 'eggDropped' });
    eventBus.emit('notification:show', {
      message: `${prev.isHuman ? 'You' : prev.adventurerName} dropped the Dragon Egg!`,
      tone: 'warning',
      icon: '🥚',
    });
  }

  private checkPickup(now: number): void {
    if (now - this.refs.egg.droppedAt < EGG.settleMs) return;
    let best: Player | null = null;
    let bestSq = PICKUP_RADIUS * PICKUP_RADIUS;
    for (const player of this.refs.players) {
      if (player.isStunned(now)) continue;
      const dx = player.x - this.groundX;
      const dy = player.y - this.groundY;
      const d2 = dx * dx + dy * dy;
      if (d2 <= bestSq) {
        bestSq = d2;
        best = player;
      }
    }
    if (best) this.pickup(best, now);
  }

  private pickup(player: Player, now: number): void {
    this.setCarrierInternal(player, now, this.lastCarrierName);
    this.refs.egg.setVisualState('carried', now);
    this.refs.particles.pickupFlash(player.x, player.y);
    eventBus.emit('egg:picked-up', {
      carrierId: player.id,
      carrierName: player.adventurerName,
      isHuman: player.isHuman,
    });
    eventBus.emit('audio:play', { sound: 'eggPickup' });
    eventBus.emit('notification:show', {
      message: `${player.isHuman ? 'You' : player.adventurerName} grabbed the Dragon Egg!`,
      tone: player.isHuman ? 'good' : 'bad',
      icon: '🥚',
    });
  }

  private checkExtraction(now: number): void {
    const carrier = this.carrier;
    if (!carrier) return;
    const r2 = MATCH.gateReachRadius * MATCH.gateReachRadius;
    for (const gate of this.refs.gates) {
      if (!gate.active) continue;
      const dx = carrier.x - gate.x;
      const dy = carrier.y - gate.y;
      if (dx * dx + dy * dy <= r2) {
        this.extract(carrier, now);
        return;
      }
    }
  }

  private extract(carrier: Player, _now: number): void {
    this.refs.particles.celebrate(carrier.x, carrier.y);
    eventBus.emit('audio:play', { sound: 'extraction' });
    if (carrier.isHuman) {
      this.refs.state.finish(
        MatchOutcome.Victory,
        'You',
        true,
        'You carried the Dragon Egg to freedom!',
      );
    } else {
      this.refs.state.finish(
        MatchOutcome.Defeat,
        carrier.adventurerName,
        false,
        `${carrier.adventurerName} escaped with the Dragon Egg.`,
      );
    }
  }
}
