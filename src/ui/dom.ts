/** Tiny typed DOM helpers shared by the UI controllers. */
import { eventBus } from '../game/types/Events';
import type { SoundId } from '../game/types/Events';

export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Dragon Egg Run UI: missing element #${id}`);
  return node as T;
}

/** Toggle the standard `is-hidden` visibility class. */
export function setHidden(el: HTMLElement, hidden: boolean): void {
  el.classList.toggle('is-hidden', hidden);
  el.setAttribute('aria-hidden', String(hidden));
}

/** Restart a CSS animation by forcing a reflow before re-adding a class. */
export function retriggerClass(el: HTMLElement, className: string): void {
  el.classList.remove(className);
  void el.offsetWidth; // reflow
  el.classList.add(className);
}

/** Wire a click handler that also plays the UI click sound. */
export function onClick(el: HTMLElement, handler: () => void): void {
  el.addEventListener('click', () => {
    playSound('button');
    handler();
  });
}

export function playSound(sound: SoundId): void {
  eventBus.emit('audio:play', { sound });
}
