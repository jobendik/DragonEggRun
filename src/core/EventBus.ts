/**
 * A tiny, dependency-free, strongly-typed event emitter.
 *
 * This is the single communication channel between the Phaser game world and the
 * HTML/CSS UI layer. Game systems `emit()` semantic events; UI controllers
 * `on()` them and mutate the DOM. Neither side needs a reference to the other,
 * which keeps the engine and the UI cleanly decoupled and easy to test.
 */
export type EventMap = Record<string, unknown>;

export type Handler<T> = (payload: T) => void;

// `extends object` (rather than `Record<string, unknown>`) so plain interfaces
// like GameEventMap — which lack an implicit string index signature — qualify.
export class TypedEmitter<TEvents extends object> {
  private readonly handlers = new Map<keyof TEvents, Set<Handler<unknown>>>();

  /** Subscribe to an event. Returns an unsubscribe function for convenience. */
  on<K extends keyof TEvents>(event: K, handler: Handler<TEvents[K]>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as Handler<unknown>);
    return () => this.off(event, handler);
  }

  /** Subscribe to an event for a single emission only. */
  once<K extends keyof TEvents>(event: K, handler: Handler<TEvents[K]>): () => void {
    const wrapped: Handler<TEvents[K]> = (payload) => {
      this.off(event, wrapped);
      handler(payload);
    };
    return this.on(event, wrapped);
  }

  off<K extends keyof TEvents>(event: K, handler: Handler<TEvents[K]>): void {
    this.handlers.get(event)?.delete(handler as Handler<unknown>);
  }

  emit<K extends keyof TEvents>(event: K, payload: TEvents[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    // Iterate a copy so handlers may safely (un)subscribe during dispatch.
    for (const handler of [...set]) {
      (handler as Handler<TEvents[K]>)(payload);
    }
  }

  /** Remove every handler — used when tearing the game down. */
  clear(): void {
    this.handlers.clear();
  }
}
