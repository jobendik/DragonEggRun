import { eventBus } from '../game/types/Events';
import type { NotificationTone } from '../game/types/Events';
import { byId } from './dom';

const MAX_TOASTS = 5;
const DEFAULT_DURATION = 3200;

/**
 * Renders the transient toast stack. Subscribes to `notification:show` and keeps
 * the DOM bounded so a long match never grows an unbounded list of nodes.
 */
export class NotificationController {
  private readonly container = byId('notifications');

  constructor() {
    eventBus.on('notification:show', ({ message, tone, icon, duration }) => {
      this.show(message, tone, icon, duration ?? DEFAULT_DURATION);
    });
  }

  private show(message: string, tone: NotificationTone, icon: string | undefined, duration: number): void {
    const toast = document.createElement('div');
    toast.className = `notification notification--${tone}`;
    if (icon) {
      const iconEl = document.createElement('span');
      iconEl.className = 'notification-icon';
      iconEl.textContent = icon;
      toast.appendChild(iconEl);
    }
    const text = document.createElement('span');
    text.className = 'notification-text';
    text.textContent = message;
    toast.appendChild(text);

    this.container.appendChild(toast);

    while (this.container.childElementCount > MAX_TOASTS) {
      this.container.firstElementChild?.remove();
    }

    // Trigger entry animation on the next frame.
    requestAnimationFrame(() => toast.classList.add('is-shown'));

    window.setTimeout(() => {
      toast.classList.add('is-leaving');
      window.setTimeout(() => toast.remove(), 360);
    }, duration);
  }
}
