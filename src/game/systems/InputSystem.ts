import Phaser from 'phaser';
import { eventBus } from '../types/Events';
import { normalize } from '../utils/MathUtils';
import type { Vector2 } from '../types/GameTypes';

/**
 * Translates raw input (keyboard + on-screen joystick) into a single normalised
 * move vector and edge-triggered "search" intent. It deliberately knows nothing
 * about the player entity — the GameScene applies the vector — so the same code
 * path serves desktop and touch.
 */
export class InputSystem {
  private readonly keys: Record<string, Phaser.Input.Keyboard.Key>;
  private readonly touchVector: Vector2 = { x: 0, y: 0 };
  private searchQueued = false;

  private readonly unsubscribers: Array<() => void> = [];

  constructor(scene: Phaser.Scene) {
    const keyboard = scene.input.keyboard;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = keyboard
      ? (keyboard.addKeys(
          {
            up: K.W,
            down: K.S,
            left: K.A,
            right: K.D,
            upArrow: K.UP,
            downArrow: K.DOWN,
            leftArrow: K.LEFT,
            rightArrow: K.RIGHT,
            search: K.E,
            searchAlt: K.SPACE,
          },
          false,
        ) as Record<string, Phaser.Input.Keyboard.Key>)
      : {};

    this.unsubscribers.push(
      eventBus.on('ui:move-vector', ({ x, y }) => {
        this.touchVector.x = x;
        this.touchVector.y = y;
      }),
    );
    this.unsubscribers.push(
      eventBus.on('ui:search-action', () => {
        this.searchQueued = true;
      }),
    );
  }

  /** Normalised movement direction this frame (length 0..1). */
  getMoveVector(): Vector2 {
    let x = 0;
    let y = 0;
    if (this.down('left') || this.down('leftArrow')) x -= 1;
    if (this.down('right') || this.down('rightArrow')) x += 1;
    if (this.down('up') || this.down('upArrow')) y -= 1;
    if (this.down('down') || this.down('downArrow')) y += 1;

    if (x !== 0 || y !== 0) return normalize(x, y);

    const touchLen = Math.hypot(this.touchVector.x, this.touchVector.y);
    if (touchLen > 0.18) {
      const scale = Math.min(1, touchLen) / touchLen;
      return { x: this.touchVector.x * scale, y: this.touchVector.y * scale };
    }
    return { x: 0, y: 0 };
  }

  /** True once per discrete search request (key press or UI tap). */
  consumeSearchPressed(): boolean {
    let pressed = this.searchQueued;
    this.searchQueued = false;
    if (this.keys.search && Phaser.Input.Keyboard.JustDown(this.keys.search)) pressed = true;
    if (this.keys.searchAlt && Phaser.Input.Keyboard.JustDown(this.keys.searchAlt)) pressed = true;
    return pressed;
  }

  private down(name: string): boolean {
    return this.keys[name]?.isDown ?? false;
  }

  destroy(): void {
    this.unsubscribers.forEach((off) => off());
    this.unsubscribers.length = 0;
  }
}
