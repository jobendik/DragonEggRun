import { eventBus } from '../game/types/Events';
import { GamePhase } from '../game/types/GameTypes';
import { byId, retriggerClass, setHidden } from './dom';
import { HUDController } from './HUDController';
import { MenuController } from './MenuController';
import { NotificationController } from './NotificationController';
import { MinimapController } from './MinimapController';

type BannerTone = 'info' | 'danger' | 'epic';

/**
 * Top-level UI orchestrator. It owns the cinematic overlays that sit *above* the
 * other controllers — the phase banner, the countdown, the body theme and the
 * touch joystick — and constructs the focused sub-controllers (HUD, menus,
 * notifications, minimap). Everything talks over the shared event bus.
 */
export class UIController {
  private banner!: HTMLElement;
  private bannerTitle!: HTMLElement;
  private bannerSub!: HTMLElement;
  private countdown!: HTMLElement;
  private countdownValue!: HTMLElement;
  private bannerTimer = 0;

  private joystickActive = false;
  private joystickCenter = { x: 0, y: 0 };
  private joystickMax = 48;

  init(): void {
    // Focused sub-controllers (each caches its DOM + subscribes to the bus).
    new NotificationController();
    new HUDController();
    new MenuController();
    new MinimapController();

    this.banner = byId('phase-banner');
    this.bannerTitle = byId('phase-banner-title');
    this.bannerSub = byId('phase-banner-sub');
    this.countdown = byId('countdown');
    this.countdownValue = byId('countdown-value');

    eventBus.on('game:phase-changed', ({ phase }) => this.onPhase(phase));
    eventBus.on('game:countdown', ({ value }) => this.onCountdown(value));
    eventBus.on('egg:found', ({ carrierName, isHuman }) => {
      this.showBanner(
        'The Dragon Egg has been Found!',
        `${isHuman ? 'You have' : `${carrierName} has`} the egg — the gates are open!`,
        'epic',
        2500,
      );
    });

    this.initTouchControls();
  }

  /* ---- banners, countdown & theme ------------------------------- */

  private onPhase(phase: GamePhase): void {
    const intense = phase === GamePhase.Escape || phase === GamePhase.EggFound;
    document.body.classList.toggle('phase-escape', intense);

    switch (phase) {
      case GamePhase.Exploration:
        this.showBanner('Explore the Island', 'Search the ruins for the hidden Dragon Egg', 'info', 1900);
        break;
      case GamePhase.Escape:
        this.showBanner('The Chase Begins!', 'Reach a glowing extraction gate', 'danger', 2000);
        break;
      case GamePhase.MainMenu:
        this.banner.classList.remove('is-shown');
        break;
      default:
        break;
    }
  }

  private onCountdown(value: number | 'go'): void {
    setHidden(this.countdown, false);
    if (value === 'go') {
      this.countdownValue.textContent = 'GO!';
      this.countdownValue.classList.add('countdown-value--go');
      retriggerClass(this.countdownValue, 'is-pop');
      window.setTimeout(() => setHidden(this.countdown, true), 750);
    } else {
      this.countdownValue.classList.remove('countdown-value--go');
      this.countdownValue.textContent = String(value);
      retriggerClass(this.countdownValue, 'is-pop');
    }
  }

  private showBanner(title: string, sub: string, tone: BannerTone, duration: number): void {
    window.clearTimeout(this.bannerTimer);
    this.bannerTitle.textContent = title;
    this.bannerSub.textContent = sub;
    this.banner.className = `phase-banner phase-banner--${tone}`;
    retriggerClass(this.banner, 'is-shown');
    this.bannerTimer = window.setTimeout(() => this.banner.classList.remove('is-shown'), duration);
  }

  /* ---- virtual joystick (touch) --------------------------------- */

  private initTouchControls(): void {
    const isTouch =
      window.matchMedia('(pointer: coarse)').matches ||
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0;
    if (!isTouch) return;

    const controls = byId('touch-controls');
    const stick = byId('joystick');
    const thumb = byId('joystick-thumb');
    const action = byId('btn-action');
    setHidden(controls, false);

    const start = (event: PointerEvent) => {
      this.joystickActive = true;
      const rect = stick.getBoundingClientRect();
      this.joystickCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      this.joystickMax = rect.width * 0.36;
      stick.setPointerCapture(event.pointerId);
      this.moveJoystick(event, thumb);
    };

    stick.addEventListener('pointerdown', start);
    stick.addEventListener('pointermove', (event) => {
      if (this.joystickActive) this.moveJoystick(event, thumb);
    });
    const end = () => {
      if (!this.joystickActive) return;
      this.joystickActive = false;
      thumb.style.transform = 'translate(0px, 0px)';
      eventBus.emit('ui:move-vector', { x: 0, y: 0 });
    };
    stick.addEventListener('pointerup', end);
    stick.addEventListener('pointercancel', end);

    action.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      eventBus.emit('audio:play', { sound: 'button' });
      eventBus.emit('ui:search-action', {});
    });
  }

  private moveJoystick(event: PointerEvent, thumb: HTMLElement): void {
    let dx = event.clientX - this.joystickCenter.x;
    let dy = event.clientY - this.joystickCenter.y;
    const len = Math.hypot(dx, dy);
    const max = this.joystickMax;
    if (len > max) {
      dx = (dx / len) * max;
      dy = (dy / len) * max;
    }
    thumb.style.transform = `translate(${dx}px, ${dy}px)`;
    eventBus.emit('ui:move-vector', { x: dx / max, y: dy / max });
  }
}
