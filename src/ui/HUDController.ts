import { eventBus } from '../game/types/Events';
import { GamePhase, StatusEffect, type StatusEffectView } from '../game/types/GameTypes';
import { formatClock } from '../game/utils/MathUtils';
import { byId, retriggerClass, setHidden } from './dom';

const PHASE_PILL: Partial<Record<GamePhase, string>> = {
  [GamePhase.Countdown]: 'Get Ready',
  [GamePhase.Exploration]: 'Exploration',
  [GamePhase.EggFound]: 'Egg Found!',
  [GamePhase.Escape]: 'Escape',
};

const EFFECT_META: Record<StatusEffect, { icon: string; label: string }> = {
  [StatusEffect.Speed]: { icon: '⚡', label: 'Swift' },
  [StatusEffect.Shield]: { icon: '🛡️', label: 'Shield' },
  [StatusEffect.Slow]: { icon: '🐌', label: 'Slow' },
  [StatusEffect.Stun]: { icon: '💫', label: 'Stun' },
};

/**
 * Owns the in-match heads-up display: phase pill, objective, the two clocks,
 * coins, status effects, the egg-carrier indicator and the search prompt. It
 * reacts to events only — it never reads game state directly — and is careful to
 * touch the DOM only when values actually change.
 */
export class HUDController {
  private readonly hud = byId('hud');
  private readonly phasePill = byId('hud-phase');
  private readonly objective = byId('hud-objective');
  private readonly matchTimer = byId('match-timer');
  private readonly escapeWrap = byId('escape-timer-wrap');
  private readonly escapeTimer = byId('escape-timer');
  private readonly coins = byId('hud-coins');
  private readonly statusEffects = byId('status-effects');
  private readonly carrierIndicator = byId('carrier-indicator');
  private readonly carrierName = byId('carrier-name');
  private readonly searchPrompt = byId('search-prompt');
  private readonly searchLabel = byId('search-prompt-label');
  private readonly searchFill = byId('search-progress-fill');
  private readonly pauseBtn = byId('btn-pause');

  private phase: GamePhase = GamePhase.MainMenu;
  private humanIsCarrier = false;
  private currentCarrier = '—';
  private eggLoose = false;
  private searching = false;

  constructor() {
    this.subscribe();
    this.pauseBtn.addEventListener('click', () => {
      eventBus.emit('audio:play', { sound: 'button' });
      eventBus.emit('ui:pause', {});
    });
    this.searchPrompt.addEventListener('click', () => eventBus.emit('ui:search-action', {}));
  }

  private subscribe(): void {
    eventBus.on('game:phase-changed', ({ phase }) => this.onPhase(phase));
    eventBus.on('game:timer-updated', ({ matchRemaining, escapeRemaining }) => {
      this.matchTimer.textContent = formatClock(matchRemaining);
      if (escapeRemaining !== null) {
        this.escapeTimer.textContent = formatClock(escapeRemaining);
        this.escapeTimer.classList.toggle('is-urgent', escapeRemaining <= 15000);
      }
    });
    eventBus.on('player:coins-changed', ({ coins }) => this.setCoins(coins));
    eventBus.on('player:status-changed', ({ effects }) => this.renderStatus(effects));

    eventBus.on('search:prompt', ({ visible, label }) => this.onPrompt(visible, label));
    eventBus.on('search:started', ({ byHuman }) => byHuman && this.beginSearchUI());
    eventBus.on('search:progress', ({ progress }) => {
      if (this.searching) this.searchFill.style.width = `${Math.round(progress * 100)}%`;
    });
    eventBus.on('search:completed', ({ byHuman }) => byHuman && this.endSearchUI());
    eventBus.on('search:cancelled', ({ byHuman }) => byHuman && this.endSearchUI());

    eventBus.on('egg:found', ({ carrierName, isHuman }) => this.setCarrier(carrierName, isHuman));
    eventBus.on('egg:carrier-changed', ({ carrierName, isHuman }) =>
      this.setCarrier(carrierName, isHuman),
    );
    eventBus.on('egg:dropped', () => this.setEggLoose());
  }

  /* ---- phase ---------------------------------------------------- */

  private onPhase(phase: GamePhase): void {
    this.phase = phase;
    const matchActive =
      phase === GamePhase.Countdown ||
      phase === GamePhase.Exploration ||
      phase === GamePhase.EggFound ||
      phase === GamePhase.Escape;
    setHidden(this.hud, !matchActive);

    if (phase === GamePhase.Countdown) this.reset();

    this.phasePill.textContent = PHASE_PILL[phase] ?? '';
    this.phasePill.classList.toggle('phase-pill--escape', phase === GamePhase.Escape);
    this.phasePill.classList.toggle('phase-pill--found', phase === GamePhase.EggFound);

    const showEscape = phase === GamePhase.EggFound || phase === GamePhase.Escape;
    setHidden(this.escapeWrap, !showEscape);

    this.updateObjective();
  }

  private updateObjective(): void {
    let text = '';
    switch (this.phase) {
      case GamePhase.Countdown:
        text = 'Adventurers, ready yourselves…';
        break;
      case GamePhase.Exploration:
        text = 'Search the island for the Dragon Egg';
        break;
      case GamePhase.EggFound:
        text = this.humanIsCarrier ? 'You have the Dragon Egg!' : `${this.currentCarrier} found the egg!`;
        break;
      case GamePhase.Escape:
        if (this.eggLoose) text = 'Grab the loose Dragon Egg!';
        else if (this.humanIsCarrier) text = 'Run to a glowing extraction gate!';
        else text = `Stop ${this.currentCarrier} reaching a gate!`;
        break;
      default:
        text = '';
    }
    this.objective.textContent = text;
  }

  /* ---- carrier -------------------------------------------------- */

  private setCarrier(name: string, isHuman: boolean): void {
    this.currentCarrier = isHuman ? 'You' : name;
    this.humanIsCarrier = isHuman;
    this.eggLoose = false;
    this.carrierName.textContent = this.currentCarrier;
    this.carrierIndicator.classList.toggle('carrier-indicator--you', isHuman);
    setHidden(this.carrierIndicator, false);
    this.updateObjective();
  }

  private setEggLoose(): void {
    this.eggLoose = true;
    this.humanIsCarrier = false;
    this.carrierName.textContent = 'Loose!';
    this.carrierIndicator.classList.remove('carrier-indicator--you');
    this.updateObjective();
  }

  /* ---- coins & status ------------------------------------------- */

  private setCoins(value: number): void {
    this.coins.textContent = String(value);
    retriggerClass(this.coins, 'is-pop');
  }

  private renderStatus(effects: StatusEffectView[]): void {
    if (effects.length === 0) {
      if (this.statusEffects.childElementCount > 0) this.statusEffects.replaceChildren();
      return;
    }
    const html = effects
      .map((e) => {
        const meta = EFFECT_META[e.effect];
        const pct = Math.max(0, Math.min(100, (e.remaining / e.duration) * 100));
        return `<div class="status-chip status-chip--${e.effect}" title="${meta.label}">
            <span class="status-chip-icon">${meta.icon}</span>
            <span class="status-chip-bar"><span style="width:${pct}%"></span></span>
          </div>`;
      })
      .join('');
    this.statusEffects.innerHTML = html;
  }

  /* ---- search prompt -------------------------------------------- */

  private onPrompt(visible: boolean, label?: string): void {
    if (this.searching) return;
    if (visible && label) this.searchLabel.textContent = label;
    setHidden(this.searchPrompt, !visible);
  }

  private beginSearchUI(): void {
    this.searching = true;
    this.searchLabel.textContent = 'Searching…';
    this.searchFill.style.width = '0%';
    this.searchPrompt.classList.add('is-searching');
    setHidden(this.searchPrompt, false);
  }

  private endSearchUI(): void {
    this.searching = false;
    this.searchPrompt.classList.remove('is-searching');
    this.searchFill.style.width = '0%';
    setHidden(this.searchPrompt, true);
  }

  /* ---- reset ---------------------------------------------------- */

  private reset(): void {
    this.setCoins(0);
    this.matchTimer.textContent = '—:—';
    this.escapeTimer.classList.remove('is-urgent');
    this.statusEffects.replaceChildren();
    this.humanIsCarrier = false;
    this.currentCarrier = '—';
    this.eggLoose = false;
    this.searching = false;
    setHidden(this.carrierIndicator, true);
    this.endSearchUI();
  }
}
