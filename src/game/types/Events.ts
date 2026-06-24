/**
 * The typed event contract between the Phaser game world and the HTML UI.
 *
 * Adding a new cross-layer interaction is a two-step process:
 *   1. add the event name + payload shape to `GameEventMap`,
 *   2. emit it from a game system / subscribe to it from a UI controller.
 *
 * The shared `eventBus` singleton below is imported by both sides.
 */
import { TypedEmitter } from '../../core/EventBus';
import type {
  CarrierHistoryEntry,
  GamePhase,
  MatchOutcome,
  MinimapSnapshot,
  SearchResult,
  StatusEffectView,
} from './GameTypes';

export type NotificationTone = 'info' | 'good' | 'bad' | 'warning' | 'epic';

export type SoundId =
  | 'chest'
  | 'coin'
  | 'trap'
  | 'stun'
  | 'shield'
  | 'boost'
  | 'hint'
  | 'teleport'
  | 'eggFound'
  | 'eggDropped'
  | 'eggPickup'
  | 'extraction'
  | 'button'
  | 'countdown'
  | 'go'
  | 'portal'
  | 'victory'
  | 'defeat';

/** Payload alias for events that carry no data. */
export type Empty = Record<string, never>;

export interface GameEventMap {
  /* ---- world → UI ------------------------------------------------ */
  'game:ready': Empty;
  'game:phase-changed': { phase: GamePhase; previous: GamePhase };
  'game:countdown': { value: number | 'go' };
  'game:timer-updated': { matchRemaining: number; escapeRemaining: number | null };

  'player:coins-changed': { coins: number };
  'player:status-changed': { effects: StatusEffectView[] };

  'search:prompt': { visible: boolean; label?: string; locationId?: string };
  'search:started': { locationId: string; duration: number; byHuman: boolean };
  'search:progress': { progress: number };
  'search:cancelled': { byHuman: boolean };
  'search:completed': {
    locationId: string;
    result: SearchResult;
    byHuman: boolean;
    actorName: string;
  };

  'egg:found': { carrierId: string; carrierName: string; isHuman: boolean };
  'egg:dropped': { x: number; y: number; byName: string };
  'egg:picked-up': { carrierId: string; carrierName: string; isHuman: boolean };
  'egg:carrier-changed': {
    carrierId: string;
    carrierName: string;
    isHuman: boolean;
    previousName: string | null;
  };

  'match:ended': {
    outcome: MatchOutcome;
    winnerName: string | null;
    winnerIsHuman: boolean;
    reason: string;
    durationMs: number;
    coins: number;
    carrierHistory: CarrierHistoryEntry[];
  };

  'notification:show': {
    message: string;
    tone: NotificationTone;
    icon?: string;
    duration?: number;
  };

  'minimap:update': MinimapSnapshot;
  'audio:play': { sound: SoundId };

  /* ---- UI → world ------------------------------------------------ */
  'ui:start-match': Empty;
  'ui:restart': Empty;
  'ui:menu': Empty;
  'ui:pause': Empty;
  'ui:resume': Empty;
  'ui:toggle-mute': { muted: boolean };
  'ui:search-action': Empty;
  'ui:move-vector': { x: number; y: number };
}

export type GameEventName = keyof GameEventMap;

/** Shared singleton bus used by every system and UI controller. */
export const eventBus = new TypedEmitter<GameEventMap>();
