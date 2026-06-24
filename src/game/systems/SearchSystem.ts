import { eventBus, type SoundId } from '../types/Events';
import { SearchResult, type SearchResult as SearchResultType } from '../types/GameTypes';
import { COINS, EFFECT, LOOT_WEIGHTS, SEARCH } from '../world/WorldConstants';
import type { Player } from '../entities/Player';
import type { SearchLocation } from '../entities/SearchLocation';
import type { GameRefs } from './GameRefs';
import type { EggSystem } from './EggSystem';

interface ActiveSearch {
  player: Player;
  location: SearchLocation;
  startedAt: number;
  byHuman: boolean;
}

const CANCEL_RADIUS = SEARCH.radius * 1.3;

/**
 * Owns the rummaging interaction for everyone: loot assignment at match start,
 * the ~1s search timer, cancellation when an adventurer walks off, and applying
 * each result (coins, buffs, traps, hints, and the egg itself).
 */
export class SearchSystem {
  private readonly active = new Map<string, ActiveSearch>();

  constructor(
    private readonly refs: GameRefs,
    private readonly eggSystem: EggSystem,
  ) {}

  /** Seed every location with hidden loot; exactly one gets the Dragon Egg. */
  assignLoot(): void {
    const { rng, locations } = this.refs;
    const eggIndex = rng.int(0, locations.length - 1);
    locations.forEach((loc, i) => {
      loc.loot = i === eggIndex ? SearchResult.DragonEgg : rng.weighted(LOOT_WEIGHTS);
    });
  }

  isSearching(playerId: string): boolean {
    return this.active.has(playerId);
  }

  searchProgress(playerId: string, now: number): number {
    const entry = this.active.get(playerId);
    if (!entry) return 0;
    return Math.min(1, (now - entry.startedAt) / SEARCH.durationMs);
  }

  /** Begin a search if the location is free and the searcher is in range. */
  tryStartSearch(player: Player, location: SearchLocation, now: number): boolean {
    if (location.opened || location.claimedBy || this.active.has(player.id)) return false;
    if (player.isStunned(now)) return false;
    if (location.distanceToSq(player.x, player.y) > SEARCH.radius * SEARCH.radius) return false;

    location.claimedBy = player.id;
    this.active.set(player.id, { player, location, startedAt: now, byHuman: player.isHuman });
    this.refs.particles.searchPuff(location.x, location.y);
    eventBus.emit('search:started', {
      locationId: location.id,
      duration: SEARCH.durationMs,
      byHuman: player.isHuman,
    });
    return true;
  }

  update(now: number): void {
    for (const entry of [...this.active.values()]) {
      const dist2 = entry.location.distanceToSq(entry.player.x, entry.player.y);
      if (dist2 > CANCEL_RADIUS * CANCEL_RADIUS) {
        this.cancel(entry);
        continue;
      }
      if (entry.byHuman) {
        eventBus.emit('search:progress', { progress: this.searchProgress(entry.player.id, now) });
      }
      if (now - entry.startedAt >= SEARCH.durationMs) {
        this.complete(entry, now);
      }
    }
  }

  /** Release any in-progress searches (e.g. when the egg is found). */
  cancelAll(): void {
    for (const entry of [...this.active.values()]) this.cancel(entry);
  }

  private cancel(entry: ActiveSearch): void {
    entry.location.claimedBy = null;
    this.active.delete(entry.player.id);
    if (entry.byHuman) eventBus.emit('search:cancelled', { byHuman: true });
  }

  private complete(entry: ActiveSearch, now: number): void {
    const { player, location } = entry;
    this.active.delete(player.id);
    location.markOpened();

    const result = location.loot;
    eventBus.emit('search:completed', {
      locationId: location.id,
      result,
      byHuman: player.isHuman,
      actorName: player.adventurerName,
    });
    this.applyResult(player, location, result, now);
  }

  /* ---- result application --------------------------------------- */

  private applyResult(
    player: Player,
    location: SearchLocation,
    result: SearchResultType,
    now: number,
  ): void {
    const { particles } = this.refs;
    const human = player.isHuman;

    switch (result) {
      case SearchResult.DragonEgg:
        this.eggSystem.captureEgg(player, now);
        return;

      case SearchResult.Coins: {
        const amount = this.rollCoins();
        player.coins += amount;
        particles.coinSparkle(location.x, location.y);
        this.sfx('coin');
        if (human) {
          eventBus.emit('player:coins-changed', { coins: player.coins });
          this.notifyHuman(`Found ${amount} gold coins!`, 'good', '🪙');
        }
        return;
      }

      case SearchResult.SpeedBoost:
        player.applySpeedBoost(now);
        particles.boostPop(location.x, location.y);
        this.sfx('boost');
        if (human) this.notifyHuman('Swift Boots! Speed boost active.', 'good', '⚡');
        return;

      case SearchResult.Shield:
        player.applyShield(now);
        particles.shieldPop(location.x, location.y);
        this.sfx('shield');
        if (human) this.notifyHuman('Aegis Charm! You are shielded.', 'good', '🛡️');
        return;

      case SearchResult.Trap: {
        const loss = Math.min(player.coins, 30);
        player.coins -= loss;
        player.applyStun(now, EFFECT.stunMs * 0.55);
        particles.trapPuff(location.x, location.y);
        this.sfx('trap');
        if (human) {
          if (loss > 0) eventBus.emit('player:coins-changed', { coins: player.coins });
          this.notifyHuman(
            loss > 0 ? `A spring trap! You drop ${loss} coins.` : 'A spring trap! Ouch.',
            'bad',
            '💥',
          );
        }
        return;
      }

      case SearchResult.StunTrap:
        player.applyStun(now, EFFECT.stunMs * 1.9);
        particles.trapPuff(location.x, location.y);
        this.sfx('stun');
        if (human) this.notifyHuman('Snare trap! You are stunned.', 'bad', '💫');
        return;

      case SearchResult.SlowCurse:
        player.applySlow(now);
        particles.trapPuff(location.x, location.y);
        this.sfx('trap');
        if (human) this.notifyHuman('Cursed mire! Your boots feel heavy.', 'bad', '🐌');
        return;

      case SearchResult.MapHint:
        particles.hintPop(location.x, location.y);
        this.sfx('hint');
        if (human) this.notifyHuman(`Ancient map: the egg lies to the ${this.hintDirection(player)}.`, 'info', '🧭');
        return;

      case SearchResult.TeleportScroll:
        this.teleport(player);
        this.sfx('teleport');
        if (human) this.notifyHuman('Teleport scroll! Whoosh!', 'info', '✨');
        return;

      case SearchResult.FakeEgg:
        particles.hintPop(location.x, location.y);
        this.sfx('chest');
        if (human) this.notifyHuman('A counterfeit egg — painted wood. Cruel!', 'warning', '🥚');
        return;

      case SearchResult.Empty:
      default:
        this.sfx('chest');
        if (human) this.notifyHuman('Empty… just cobwebs and dust.', 'info', '🕸️');
        return;
    }
  }

  private rollCoins(): number {
    const roll = this.refs.rng.next();
    if (roll < 0.6) return COINS.small;
    if (roll < 0.9) return COINS.medium;
    return COINS.large;
  }

  private teleport(player: Player): void {
    const dest = this.refs.map.randomClearPoint(
      this.refs.rng,
      24,
      { x: player.x, y: player.y },
      500,
    );
    this.refs.particles.teleportRings(player.x, player.y);
    player.setPosition(dest.x, dest.y);
    player.body.reset(dest.x, dest.y);
    this.refs.particles.teleportRings(dest.x, dest.y);
  }

  private hintDirection(player: Player): string {
    const eggLoc = this.refs.locations.find((l) => l.containsEgg());
    if (!eggLoc) return 'unknown';
    const angle = Math.atan2(eggLoc.y - player.y, eggLoc.x - player.x);
    const dirs = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
    const index = Math.round(((angle + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8;
    return dirs[index];
  }

  private sfx(sound: SoundId): void {
    eventBus.emit('audio:play', { sound });
  }

  private notifyHuman(
    message: string,
    tone: 'good' | 'bad' | 'info' | 'warning',
    icon: string,
  ): void {
    eventBus.emit('notification:show', { message, tone, icon });
  }
}
