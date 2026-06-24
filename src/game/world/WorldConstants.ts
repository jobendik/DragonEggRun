/**
 * Single source of truth for world dimensions, gameplay tuning and the colour
 * palette. Keeping every magic number here makes the prototype easy to balance.
 */

export const WORLD = {
  width: 2800,
  height: 2000,
  /** Thickness of the decorative water/coast band around the playable island. */
  coastInset: 140,
} as const;

export const PLAYER = {
  radius: 19,
  baseSpeed: 248,
  /** How quickly velocity approaches the target each second (higher = snappier). */
  steerResponse: 16,
  carrierSpeedMultiplier: 0.82,
  boostMultiplier: 1.5,
  slowMultiplier: 0.55,
  forestMultiplier: 0.74,
} as const;

export const SEARCH = {
  durationMs: 1000,
  /** Distance within which an adventurer may interact with a location. */
  radius: 78,
} as const;

export const EFFECT = {
  boostMs: 6000,
  shieldMs: 7000,
  slowMs: 5000,
  stunMs: 1600,
} as const;

export const EGG = {
  /** Proximity at which a rival knocks the egg loose from the carrier. */
  stealRadius: 50,
  /** Grace window after taking the egg during which it cannot be stolen. */
  pickupInvulnMs: 1600,
  /** A dropped egg must settle before anyone can scoop it up. */
  settleMs: 450,
  /** Spacing (ms) between trail puffs left by the carrier. */
  trailIntervalMs: 70,
  carrierGlowRadius: 46,
} as const;

export const MATCH = {
  countdownMs: 3000,
  /** Exploration time budget before the trail goes cold. */
  explorationMs: 240_000,
  /** Countdown the carrier races against once the egg is found. */
  escapeMs: 80_000,
  /** Length of the dramatic "egg found" interstitial before the chase begins. */
  eggFoundBannerMs: 2600,
  /** Distance at which the carrier counts as having reached a gate. */
  gateReachRadius: 58,
} as const;

export const AI = {
  count: 8,
  /** Re-evaluate the current target roughly this often (ms). */
  decisionIntervalMs: 650,
  /** Switch targets if another location is at least this much closer (px). */
  retargetSlackPx: 140,
  /** If an AI fails to make progress for this long, it gets unstuck. */
  stuckMs: 1400,
} as const;

export const MINIMAP = {
  /** How often the world pushes a radar snapshot to the UI (ms). */
  updateIntervalMs: 90,
} as const;

/** Number reference for a search-location loot distribution (excludes the egg). */
export const LOOT_WEIGHTS = {
  coins: 30,
  empty: 16,
  'speed-boost': 9,
  shield: 8,
  'map-hint': 7,
  trap: 8,
  'stun-trap': 6,
  'slow-curse': 6,
  'teleport-scroll': 5,
  'fake-egg': 5,
} as const;

export const COINS = {
  small: 25,
  medium: 60,
  large: 120,
} as const;

/**
 * Colour palette as 0xRRGGBB integers for Phaser. CSS counterparts live in the
 * stylesheets; keep the two visually in sync when retheming.
 */
export const COLORS = {
  oceanDeep: 0x1c3f63,
  ocean: 0x265b82,
  oceanFoam: 0x4d8fb8,
  sand: 0xe2c98c,
  grass: 0x3f7d4f,
  grassLight: 0x4f9a5f,
  grassDark: 0x336942,
  forest: 0x2c6440,
  forestCanopy: 0x3a8051,
  trunk: 0x6c4a2c,
  rock: 0x868a93,
  rockDark: 0x60636c,
  ruin: 0xa49e92,
  ruinDark: 0x817b70,
  hutWall: 0xc08a4e,
  hutRoof: 0x8c4f30,
  shrine: 0xc3cad6,
  shrineGlow: 0x9bd0ff,
  path: 0xc9b079,
  bridge: 0x9c6b3f,
  bridgePlank: 0x80552f,
  chest: 0xb5793f,
  chestLid: 0x8a5a2c,
  chestOpened: 0x5d4a33,
  gate: 0x6c5ce7,
  gateActive: 0xffb24d,
  gateBeam: 0xffd98a,
  portalA: 0x9b5de5,
  portalB: 0x2ec4f0,
  egg: 0xffd166,
  eggShell: 0xfff0bf,
  eggGlow: 0xffe79a,
  human: 0x4cc9f0,
  humanTrim: 0xeaffff,
  danger: 0xff5d5d,
  warning: 0xffb84d,
  good: 0x6ee7a8,
} as const;

/** Distinct, readable hues for AI adventurers (cycled if fewer than `AI.count`). */
export const AI_COLORS: number[] = [
  0xef476f, 0xf78c6b, 0xffd166, 0x83d483, 0x06d6a0, 0x4dd2e8, 0x9d8df1, 0xff8fab, 0xc0eb6a,
  0xf6a5c0,
];

/** Whimsical fantasy names so the bots read as characters, not "AI 3". */
export const AI_NAMES: string[] = [
  'Brambletoe',
  'Vextra',
  'Old Pike',
  'Mossbeard',
  'Quill',
  'Sable',
  'Fenwick',
  'Marrow',
  'Thistle',
  'Greel',
];
