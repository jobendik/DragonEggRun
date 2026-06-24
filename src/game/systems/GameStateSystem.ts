import { eventBus } from '../types/Events';
import { GamePhase, MatchOutcome, type CarrierHistoryEntry } from '../types/GameTypes';
import { MATCH } from '../world/WorldConstants';

/** Stats the state system folds into the end-of-match payload. */
export interface EndStatsProvider {
  (): { coins: number; carrierHistory: CarrierHistoryEntry[] };
}

/**
 * Owns the match state machine and the two clocks (exploration + escape).
 * It is deliberately the *only* place phases change, so the rest of the game and
 * the entire UI can simply react to `game:phase-changed`.
 */
export class GameStateSystem {
  private _phase: GamePhase = GamePhase.MainMenu;
  private finished = false;

  private matchStartMs = 0;
  private explorationRemaining: number = MATCH.explorationMs;
  private escapeRemaining: number = MATCH.escapeMs;
  private eggFoundRemaining: number = MATCH.eggFoundBannerMs;

  private countdownStep = 0;
  private countdownAccum = 0;

  private emitAccum = 0;

  constructor(
    private readonly now: () => number,
    private readonly endStats: EndStatsProvider,
  ) {}

  get phase(): GamePhase {
    return this._phase;
  }

  get isFinished(): boolean {
    return this.finished;
  }

  /** Movement + AI run only while the world is "live". */
  get movementAllowed(): boolean {
    return this._phase === GamePhase.Exploration || this._phase === GamePhase.Escape;
  }

  get isMatchActive(): boolean {
    return (
      this._phase === GamePhase.Countdown ||
      this._phase === GamePhase.Exploration ||
      this._phase === GamePhase.EggFound ||
      this._phase === GamePhase.Escape
    );
  }

  /* ---- transitions ---------------------------------------------- */

  beginCountdown(): void {
    this.finished = false;
    this.matchStartMs = this.now();
    this.explorationRemaining = MATCH.explorationMs;
    this.escapeRemaining = MATCH.escapeMs;
    this.eggFoundRemaining = MATCH.eggFoundBannerMs;
    this.countdownStep = Math.ceil(MATCH.countdownMs / 1000);
    this.countdownAccum = 0;
    this.setPhase(GamePhase.Countdown);
    this.emitTimers();
    eventBus.emit('game:countdown', { value: this.countdownStep });
  }

  enterEggFound(): void {
    this.eggFoundRemaining = MATCH.eggFoundBannerMs;
    this.setPhase(GamePhase.EggFound);
    this.emitTimers();
  }

  private beginExploration(): void {
    this.matchStartMs = this.now();
    this.setPhase(GamePhase.Exploration);
    this.emitTimers();
  }

  private beginEscape(): void {
    this.escapeRemaining = MATCH.escapeMs;
    this.setPhase(GamePhase.Escape);
    this.emitTimers();
  }

  finish(
    outcome: MatchOutcome,
    winnerName: string | null,
    winnerIsHuman: boolean,
    reason: string,
  ): void {
    if (this.finished) return;
    this.finished = true;
    this.setPhase(outcome === MatchOutcome.Victory ? GamePhase.Victory : GamePhase.Defeat);

    const stats = this.endStats();
    eventBus.emit('match:ended', {
      outcome,
      winnerName,
      winnerIsHuman,
      reason,
      durationMs: this.now() - this.matchStartMs,
      coins: stats.coins,
      carrierHistory: stats.carrierHistory,
    });
  }

  /* ---- per-frame ------------------------------------------------ */

  update(deltaMs: number): void {
    switch (this._phase) {
      case GamePhase.Countdown:
        this.tickCountdown(deltaMs);
        break;
      case GamePhase.Exploration:
        this.explorationRemaining -= deltaMs;
        if (this.explorationRemaining <= 0) {
          this.explorationRemaining = 0;
          this.finish(
            MatchOutcome.Defeat,
            null,
            false,
            'The trail went cold — the dragon spirited its egg away.',
          );
        }
        this.throttledEmit(deltaMs);
        break;
      case GamePhase.EggFound:
        this.eggFoundRemaining -= deltaMs;
        if (this.eggFoundRemaining <= 0) this.beginEscape();
        break;
      case GamePhase.Escape:
        this.escapeRemaining -= deltaMs;
        if (this.escapeRemaining <= 0) {
          this.escapeRemaining = 0;
          this.finish(
            MatchOutcome.Defeat,
            null,
            false,
            'Time ran out. The dragon swooped in and reclaimed its egg!',
          );
        }
        this.throttledEmit(deltaMs);
        break;
      default:
        break;
    }
  }

  private tickCountdown(deltaMs: number): void {
    this.countdownAccum += deltaMs;
    if (this.countdownAccum >= 1000) {
      this.countdownAccum -= 1000;
      this.countdownStep -= 1;
      if (this.countdownStep > 0) {
        eventBus.emit('game:countdown', { value: this.countdownStep });
      } else {
        eventBus.emit('game:countdown', { value: 'go' });
        this.beginExploration();
      }
    }
  }

  private throttledEmit(deltaMs: number): void {
    this.emitAccum += deltaMs;
    if (this.emitAccum >= 200) {
      this.emitAccum = 0;
      this.emitTimers();
    }
  }

  private emitTimers(): void {
    const escape =
      this._phase === GamePhase.Escape || this._phase === GamePhase.EggFound
        ? Math.max(0, this.escapeRemaining)
        : null;
    eventBus.emit('game:timer-updated', {
      matchRemaining: Math.max(0, this.explorationRemaining),
      escapeRemaining: escape,
    });
  }

  private setPhase(phase: GamePhase): void {
    if (phase === this._phase) return;
    const previous = this._phase;
    this._phase = phase;
    eventBus.emit('game:phase-changed', { phase, previous });
  }
}
