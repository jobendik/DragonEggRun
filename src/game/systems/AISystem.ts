import { AIPersonality, GamePhase } from '../types/GameTypes';
import { AI, SEARCH } from '../world/WorldConstants';
import { normalize } from '../utils/MathUtils';
import type { AIPlayer } from '../entities/AIPlayer';
import type { SearchLocation } from '../entities/SearchLocation';
import type { GameRefs } from './GameRefs';
import type { SearchSystem } from './SearchSystem';
import type { EggSystem } from './EggSystem';

const NEAREST_POOL = 6;
const LOOKAHEAD = 50;
const AVOID_ANGLES = [0, 0.6, -0.6, 1.2, -1.2, 1.9, -1.9];

/**
 * Lightweight but believable bots. During exploration they pick and rummage
 * search locations with a personality bias; during the chase they carry, chase,
 * intercept or guard. All steering goes through {@link steerTo}, which applies
 * basic obstacle avoidance so bots flow around geometry instead of grinding into
 * it (a stuck-timer detour is the safety net).
 */
export class AISystem {
  constructor(
    private readonly refs: GameRefs,
    private readonly search: SearchSystem,
    private readonly eggs: EggSystem,
  ) {}

  update(now: number, _deltaMs: number): void {
    const exploring = this.refs.state.phase === GamePhase.Exploration;
    for (const ai of this.refs.aiPlayers) {
      if (ai.isStunned(now)) {
        ai.moveDir.x = 0;
        ai.moveDir.y = 0;
        continue;
      }
      if (exploring) this.explore(ai, now);
      else this.escape(ai, now);
    }
  }

  /* ---- exploration ---------------------------------------------- */

  private explore(ai: AIPlayer, now: number): void {
    // Finish the current rummage before doing anything else.
    if (ai.searchingId) {
      if (this.search.isSearching(ai.id)) {
        ai.moveDir.x = 0;
        ai.moveDir.y = 0;
        return;
      }
      ai.searchingId = null;
      ai.targetLocationId = null;
    }

    let target = this.resolveTarget(ai);
    const shouldDecide = !target || now >= ai.nextDecisionAt;
    if (shouldDecide) {
      const chosen = this.chooseTarget(ai, target);
      if (chosen) {
        ai.targetLocationId = chosen.id;
        target = chosen;
      }
      ai.nextDecisionAt = now + AI.decisionIntervalMs * this.refs.rng.range(0.7, 1.3);
    }

    if (!target) {
      this.wander(ai, now);
      return;
    }

    if (target.distanceToSq(ai.x, ai.y) <= SEARCH.radius * SEARCH.radius * 0.85) {
      if (this.search.tryStartSearch(ai, target, now)) {
        ai.searchingId = target.id;
        ai.moveDir.x = 0;
        ai.moveDir.y = 0;
        return;
      }
      // Someone beat us to it — pick again next frame.
      ai.targetLocationId = null;
    }

    this.steerTo(ai, target.x, target.y, now);
  }

  private resolveTarget(ai: AIPlayer): SearchLocation | null {
    if (!ai.targetLocationId) return null;
    const loc = this.refs.locationById.get(ai.targetLocationId);
    if (!loc || loc.opened || (loc.claimedBy && loc.claimedBy !== ai.id)) return null;
    return loc;
  }

  private chooseTarget(ai: AIPlayer, current: SearchLocation | null): SearchLocation | null {
    const open = this.refs.locations.filter(
      (l) => !l.opened && (!l.claimedBy || l.claimedBy === ai.id),
    );
    if (open.length === 0) return current;

    open.sort((a, b) => a.distanceToSq(ai.x, ai.y) - b.distanceToSq(ai.x, ai.y));
    const pool = open.slice(0, NEAREST_POOL);

    let choice: SearchLocation;
    switch (ai.personality) {
      case AIPersonality.Wanderer:
        choice = this.refs.rng.pick(pool);
        break;
      case AIPersonality.Cautious:
        choice = pool.reduce((safest, loc) =>
          this.nearestRivalDistSq(loc) > this.nearestRivalDistSq(safest) ? loc : safest,
        );
        break;
      case AIPersonality.Aggressive:
      case AIPersonality.Greedy:
      default:
        choice = pool[0];
        break;
    }

    // Avoid jittery flip-flopping: keep the current target unless the new one is
    // meaningfully closer.
    if (current && !current.opened) {
      const slack = AI.retargetSlackPx;
      const curD = Math.sqrt(current.distanceToSq(ai.x, ai.y));
      const newD = Math.sqrt(choice.distanceToSq(ai.x, ai.y));
      if (curD <= newD + slack) return current;
    }
    return choice;
  }

  private nearestRivalDistSq(loc: SearchLocation): number {
    let best = Infinity;
    for (const player of this.refs.players) {
      const d = loc.distanceToSq(player.x, player.y);
      if (d < best) best = d;
    }
    return best;
  }

  private wander(ai: AIPlayer, now: number): void {
    if (now >= ai.nextDecisionAt) {
      ai.wanderAngle += this.refs.rng.range(-1, 1);
      ai.nextDecisionAt = now + 700;
    }
    const tx = ai.x + Math.cos(ai.wanderAngle) * 220;
    const ty = ai.y + Math.sin(ai.wanderAngle) * 220;
    const clamped = this.refs.map.clampToBounds(tx, ty, 40);
    this.steerTo(ai, clamped.x, clamped.y, now);
  }

  /* ---- escape --------------------------------------------------- */

  private escape(ai: AIPlayer, now: number): void {
    if (this.eggs.isDropped()) {
      const pos = this.eggs.getGroundPosition();
      this.steerTo(ai, pos.x, pos.y, now);
      return;
    }

    const carrier = this.eggs.getCarrier();
    if (!carrier) {
      this.wander(ai, now);
      return;
    }

    if (carrier === ai) {
      const gate = this.nearestActiveGate(ai.x, ai.y);
      if (gate) this.steerTo(ai, gate.x, gate.y, now);
      return;
    }

    switch (ai.personality) {
      case AIPersonality.Cautious: {
        // Camp the gate the carrier is most likely heading for.
        const gate = this.nearestActiveGate(carrier.x, carrier.y);
        if (gate) this.steerTo(ai, gate.x, gate.y, now);
        break;
      }
      case AIPersonality.Wanderer:
        this.steerTo(ai, carrier.x, carrier.y, now);
        break;
      case AIPersonality.Aggressive:
      case AIPersonality.Greedy:
      default: {
        // Intercept: aim where the carrier is going, not where it is.
        const lead = 0.5;
        const px = carrier.x + carrier.body.velocity.x * lead;
        const py = carrier.y + carrier.body.velocity.y * lead;
        this.steerTo(ai, px, py, now);
        break;
      }
    }
  }

  private nearestActiveGate(x: number, y: number): { x: number; y: number } | null {
    let best: { x: number; y: number } | null = null;
    let bestD = Infinity;
    for (const gate of this.refs.gates) {
      if (!gate.active) continue;
      const d = (gate.x - x) ** 2 + (gate.y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = { x: gate.x, y: gate.y };
      }
    }
    return best;
  }

  /* ---- steering ------------------------------------------------- */

  private steerTo(ai: AIPlayer, tx: number, ty: number, now: number): void {
    let dir = normalize(tx - ai.x, ty - ai.y);

    // Obstacle avoidance: probe ahead, rotating the heading until it is clear.
    if (this.refs.map.isBlocked(ai.x + dir.x * LOOKAHEAD, ai.y + dir.y * LOOKAHEAD, 24)) {
      const base = Math.atan2(dir.y, dir.x);
      for (const offset of AVOID_ANGLES) {
        const a = base + offset;
        const nx = ai.x + Math.cos(a) * LOOKAHEAD;
        const ny = ai.y + Math.sin(a) * LOOKAHEAD;
        if (!this.refs.map.isBlocked(nx, ny, 24)) {
          dir = { x: Math.cos(a), y: Math.sin(a) };
          break;
        }
      }
    }

    // Stuck detour: blend in a perpendicular sidestep for a short window.
    if (ai.updateStuck(now, AI.stuckMs) && now >= ai.detourUntil) {
      ai.detourUntil = now + 800;
      const sign = this.refs.rng.sign();
      ai.detourDir.x = -dir.y * sign;
      ai.detourDir.y = dir.x * sign;
    }
    if (now < ai.detourUntil) {
      dir = normalize(dir.x + ai.detourDir.x * 0.9, dir.y + ai.detourDir.y * 0.9);
    }

    ai.moveDir.x = dir.x;
    ai.moveDir.y = dir.y;
  }
}
