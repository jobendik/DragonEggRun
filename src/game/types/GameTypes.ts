/**
 * Core domain types shared across the Phaser game systems and the HTML UI layer.
 *
 * These are intentionally framework-agnostic: nothing here imports Phaser, so the
 * UI controllers can consume the same vocabulary without pulling in the engine.
 */

/** High-level game/match state machine. Drives both world logic and UI themes. */
export const GamePhase = {
  Boot: 'boot',
  MainMenu: 'main-menu',
  Countdown: 'countdown',
  Exploration: 'exploration',
  EggFound: 'egg-found',
  Escape: 'escape',
  Victory: 'victory',
  Defeat: 'defeat',
} as const;
export type GamePhase = (typeof GamePhase)[keyof typeof GamePhase];

/** Everything a search location can contain. Exactly one location hides the egg. */
export const SearchResult = {
  Coins: 'coins',
  SpeedBoost: 'speed-boost',
  Shield: 'shield',
  Trap: 'trap',
  StunTrap: 'stun-trap',
  SlowCurse: 'slow-curse',
  FakeEgg: 'fake-egg',
  MapHint: 'map-hint',
  TeleportScroll: 'teleport-scroll',
  Empty: 'empty',
  DragonEgg: 'dragon-egg',
} as const;
export type SearchResult = (typeof SearchResult)[keyof typeof SearchResult];

/** Visual flavour for searchable points of interest. */
export const SearchLocationKind = {
  Chest: 'chest',
  Ruin: 'ruin',
  Shrine: 'shrine',
  Cave: 'cave',
  Hut: 'hut',
  Altar: 'altar',
} as const;
export type SearchLocationKind = (typeof SearchLocationKind)[keyof typeof SearchLocationKind];

/** Simple AI archetypes that bias bot decision-making. */
export const AIPersonality = {
  Aggressive: 'aggressive',
  Cautious: 'cautious',
  Greedy: 'greedy',
  Wanderer: 'wanderer',
} as const;
export type AIPersonality = (typeof AIPersonality)[keyof typeof AIPersonality];

/** Collision-bearing world obstacles. */
export const ObstacleKind = {
  Water: 'water',
  Rock: 'rock',
  Tree: 'tree',
  RuinWall: 'ruin-wall',
  Hut: 'hut',
} as const;
export type ObstacleKind = (typeof ObstacleKind)[keyof typeof ObstacleKind];

/** Transient status effects applied to adventurers. */
export const StatusEffect = {
  Speed: 'speed',
  Shield: 'shield',
  Slow: 'slow',
  Stun: 'stun',
} as const;
export type StatusEffect = (typeof StatusEffect)[keyof typeof StatusEffect];

/** Why a match ended — used to theme the end screen. */
export const MatchOutcome = {
  Victory: 'victory',
  Defeat: 'defeat',
} as const;
export type MatchOutcome = (typeof MatchOutcome)[keyof typeof MatchOutcome];

export interface Vector2 {
  x: number;
  y: number;
}

/* ------------------------------------------------------------------ *
 * Map data — produced by MapGenerator, consumed by the GameScene.    *
 * ------------------------------------------------------------------ */

export interface CircleObstacle {
  shape: 'circle';
  x: number;
  y: number;
  radius: number;
  kind: ObstacleKind;
}

export interface RectObstacle {
  shape: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
  kind: ObstacleKind;
}

export type ObstacleDef = CircleObstacle | RectObstacle;

export interface SearchLocationDef {
  id: string;
  x: number;
  y: number;
  kind: SearchLocationKind;
}

export interface ExtractionGateDef {
  id: string;
  x: number;
  y: number;
}

export interface PortalDef {
  id: string;
  ax: number;
  ay: number;
  bx: number;
  by: number;
}

export interface ForestZoneDef {
  x: number;
  y: number;
  radius: number;
}

export interface BridgeDef {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const DecorKind = {
  Tree: 'tree',
  Bush: 'bush',
  Flower: 'flower',
  Rock: 'rock',
  Lily: 'lily',
} as const;
export type DecorKind = (typeof DecorKind)[keyof typeof DecorKind];

export interface DecorDef {
  kind: DecorKind;
  x: number;
  y: number;
  scale: number;
  tint: number;
}

export interface IslandMapData {
  width: number;
  height: number;
  /** Inset rectangle the players are confined to (inside the coastline). */
  bounds: { x: number; y: number; width: number; height: number };
  obstacles: ObstacleDef[];
  forests: ForestZoneDef[];
  bridges: BridgeDef[];
  searchLocations: SearchLocationDef[];
  gates: ExtractionGateDef[];
  portals: PortalDef[];
  decor: DecorDef[];
  spawns: Vector2[];
}

/* ------------------------------------------------------------------ *
 * Lightweight view-models shared with the UI via the event bus.      *
 * ------------------------------------------------------------------ */

export interface StatusEffectView {
  effect: StatusEffect;
  /** Remaining time in ms. */
  remaining: number;
  /** Total duration in ms (for progress rendering). */
  duration: number;
}

export interface CarrierHistoryEntry {
  name: string;
  isHuman: boolean;
  /** Match time (ms) at which this adventurer took the egg. */
  atMs: number;
}

export interface MinimapEntity {
  x: number;
  y: number;
  kind: 'human' | 'ai' | 'egg' | 'gate' | 'search' | 'carrier';
  color: number;
}

export interface MinimapSnapshot {
  width: number;
  height: number;
  entities: MinimapEntity[];
}
