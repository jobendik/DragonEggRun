import { eventBus, type GameEventMap } from '../game/types/Events';
import { GamePhase, MatchOutcome } from '../game/types/GameTypes';
import { formatClock } from '../game/utils/MathUtils';
import { byId, onClick, setHidden } from './dom';

type MatchEnded = GameEventMap['match:ended'];

/**
 * Owns every full-screen overlay: the main menu, the pause dialog and the end
 * screen. Buttons translate directly into intent events on the bus; the screens
 * show/hide in response to phase changes and `match:ended`.
 */
export class MenuController {
  private readonly mainMenu = byId('main-menu');
  private readonly pauseMenu = byId('pause-menu');
  private readonly endScreen = byId('end-screen');

  private readonly soundToggle = byId<HTMLInputElement>('toggle-sound');

  private readonly resultTag = byId('end-result-tag');
  private readonly endTitle = byId('end-title');
  private readonly endSummary = byId('end-summary');
  private readonly endDuration = byId('end-duration');
  private readonly endCoins = byId('end-coins');
  private readonly carrierList = byId('end-carrier-list');

  constructor() {
    this.wireButtons();
    this.subscribe();
  }

  private wireButtons(): void {
    onClick(byId('btn-start'), () => eventBus.emit('ui:start-match', {}));

    onClick(byId('btn-resume'), () => {
      setHidden(this.pauseMenu, true);
      eventBus.emit('ui:resume', {});
    });
    onClick(byId('btn-pause-restart'), () => {
      setHidden(this.pauseMenu, true);
      eventBus.emit('ui:restart', {});
    });
    onClick(byId('btn-pause-menu'), () => {
      setHidden(this.pauseMenu, true);
      eventBus.emit('ui:menu', {});
    });

    onClick(byId('btn-play-again'), () => eventBus.emit('ui:restart', {}));
    onClick(byId('btn-end-menu'), () => eventBus.emit('ui:menu', {}));

    this.soundToggle.addEventListener('change', () => {
      eventBus.emit('ui:toggle-mute', { muted: !this.soundToggle.checked });
    });
  }

  private subscribe(): void {
    eventBus.on('game:phase-changed', ({ phase }) => this.onPhase(phase));
    eventBus.on('match:ended', (payload) => this.showEndScreen(payload));
    eventBus.on('ui:pause', () => this.openPause());
  }

  private onPhase(phase: GamePhase): void {
    setHidden(this.mainMenu, phase !== GamePhase.MainMenu);
    if (phase !== GamePhase.Victory && phase !== GamePhase.Defeat) {
      setHidden(this.endScreen, true);
    }
    if (phase !== GamePhase.Countdown) setHidden(this.pauseMenu, true);
    // ui:pause is what opens the pause dialog.
    if (phase === GamePhase.MainMenu) setHidden(this.pauseMenu, true);
  }

  private showEndScreen(payload: MatchEnded): void {
    const win = payload.outcome === MatchOutcome.Victory;
    this.resultTag.textContent = win ? 'Victory' : 'Defeat';
    this.resultTag.classList.toggle('result-tag--victory', win);
    this.resultTag.classList.toggle('result-tag--defeat', !win);

    this.endTitle.textContent = win ? 'You escaped with the egg!' : 'The egg slipped away';
    this.endSummary.textContent = payload.reason;
    this.endDuration.textContent = formatClock(payload.durationMs);
    this.endCoins.textContent = String(payload.coins);

    this.renderCarrierHistory(payload);

    setHidden(this.endScreen, false);
  }

  private renderCarrierHistory(payload: MatchEnded): void {
    this.carrierList.replaceChildren();
    if (payload.carrierHistory.length === 0) {
      const li = document.createElement('li');
      li.className = 'carrier-list-empty';
      li.textContent = 'No one ever held the Dragon Egg.';
      this.carrierList.appendChild(li);
      return;
    }
    const base = payload.carrierHistory[0].atMs;
    for (const entry of payload.carrierHistory) {
      const li = document.createElement('li');
      const who = document.createElement('span');
      who.className = entry.isHuman ? 'carrier-who is-you' : 'carrier-who';
      who.textContent = entry.isHuman ? 'You' : entry.name;
      const when = document.createElement('span');
      when.className = 'carrier-when';
      const secs = Math.max(0, Math.round((entry.atMs - base) / 1000));
      when.textContent = secs === 0 ? 'found it' : `+${secs}s`;
      li.append(who, when);
      this.carrierList.appendChild(li);
    }
  }

  /** Pause dialog is opened by the HUD pause button via the bus. */
  openPause(): void {
    setHidden(this.pauseMenu, false);
  }
}
