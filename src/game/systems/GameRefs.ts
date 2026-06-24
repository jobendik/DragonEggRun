/**
 * The bundle of shared references the gameplay systems operate on. The GameScene
 * builds this once per match and hands it to each system, keeping their
 * constructors readable and their dependencies explicit.
 */
import type Phaser from 'phaser';
import type { Rng } from '../utils/Rng';
import type { IslandMap } from '../world/IslandMap';
import type { Player } from '../entities/Player';
import type { AIPlayer } from '../entities/AIPlayer';
import type { SearchLocation } from '../entities/SearchLocation';
import type { ExtractionGate } from '../entities/ExtractionGate';
import type { DragonEgg } from '../entities/DragonEgg';
import type { GameStateSystem } from './GameStateSystem';
import type { ParticleSystem } from './ParticleSystem';

export interface GameRefs {
  scene: Phaser.Scene;
  rng: Rng;
  map: IslandMap;
  state: GameStateSystem;
  particles: ParticleSystem;
  egg: DragonEgg;
  human: Player;
  /** All adventurers including the human (index 0 is the human). */
  players: Player[];
  aiPlayers: AIPlayer[];
  locations: SearchLocation[];
  locationById: Map<string, SearchLocation>;
  gates: ExtractionGate[];
}
