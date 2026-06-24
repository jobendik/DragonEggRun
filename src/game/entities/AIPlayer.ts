import type Phaser from 'phaser';
import { Player, type AdventurerOptions } from './Player';
import type { AIPersonality, Vector2 } from '../types/GameTypes';

export interface AIOptions extends AdventurerOptions {
  personality: AIPersonality;
}

/**
 * An AI-controlled adventurer. It is mechanically identical to the human
 * {@link Player}; this subclass only carries the bot's transient "brain" state.
 * The decision-making itself lives in {@link AISystem} so behaviour is easy to
 * tune in one place (and could later be swapped for networked input).
 */
export class AIPlayer extends Player {
  readonly personality: AIPersonality;

  /** Current search-location target (exploration) — null while re-deciding. */
  targetLocationId: string | null = null;
  /** Free-form world target (chasing / fleeing / wandering). */
  targetPoint: Vector2 | null = null;
  /** Location the bot is presently committed to searching. */
  searchingId: string | null = null;

  nextDecisionAt = 0;
  /** Scene time when the bot last made meaningful progress (stuck detection). */
  lastProgressAt = 0;
  private lastX = 0;
  private lastY = 0;
  /** Personality-driven wander heading, nudged over time. */
  wanderAngle = 0;

  /** Temporary "sidestep" applied while escaping geometry it got wedged on. */
  detourUntil = 0;
  readonly detourDir: Vector2 = { x: 0, y: 0 };

  constructor(scene: Phaser.Scene, opts: AIOptions) {
    super(scene, opts);
    this.personality = opts.personality;
    this.lastX = opts.x;
    this.lastY = opts.y;
  }

  /** Returns true (and resets the tracker) if the bot is wedged against geometry. */
  updateStuck(now: number, stuckMs: number): boolean {
    const moved = Math.hypot(this.x - this.lastX, this.y - this.lastY);
    this.lastX = this.x;
    this.lastY = this.y;
    if (moved > 2.4) {
      this.lastProgressAt = now;
      return false;
    }
    return now - this.lastProgressAt > stuckMs;
  }
}
