import Phaser from 'phaser';
import { eventBus } from '../types/Events';
import {
  AIPersonality,
  DecorKind,
  GamePhase,
  type CircleObstacle,
  type DecorDef,
  type MinimapEntity,
  type MinimapSnapshot,
  type RectObstacle,
} from '../types/GameTypes';
import {
  AI,
  AI_COLORS,
  AI_NAMES,
  COLORS,
  MINIMAP,
  SEARCH,
} from '../world/WorldConstants';
import { Rng, resolveSeed } from '../utils/Rng';
import { MapGenerator } from '../world/MapGenerator';
import { IslandMap } from '../world/IslandMap';
import { Player } from '../entities/Player';
import { AIPlayer } from '../entities/AIPlayer';
import { SearchLocation } from '../entities/SearchLocation';
import { ExtractionGate } from '../entities/ExtractionGate';
import { DragonEgg } from '../entities/DragonEgg';
import { GameStateSystem } from '../systems/GameStateSystem';
import { ParticleSystem } from '../systems/ParticleSystem';
import { CameraSystem } from '../systems/CameraSystem';
import { EggSystem } from '../systems/EggSystem';
import { SearchSystem } from '../systems/SearchSystem';
import { AISystem } from '../systems/AISystem';
import { InputSystem } from '../systems/InputSystem';
import { CollisionSystem } from '../systems/CollisionSystem';
import type { GameRefs } from '../systems/GameRefs';

/**
 * The single Phaser scene that owns the live match: it builds the world, wires
 * up every system, runs the update loop and bridges world events to the UI. The
 * HTML overlay reacts purely through the event bus — this scene never touches the
 * DOM.
 */
export class GameScene extends Phaser.Scene {
  private rng!: Rng;
  private map!: IslandMap;

  private state!: GameStateSystem;
  private particles!: ParticleSystem;
  private cameraSystem!: CameraSystem;
  private eggSystem!: EggSystem;
  private searchSystem!: SearchSystem;
  private aiSystem!: AISystem;
  private inputSystem!: InputSystem;
  private collision!: CollisionSystem;
  private refs!: GameRefs;

  private egg!: DragonEgg;
  private human!: Player;
  private players: Player[] = [];
  private aiPlayers: AIPlayer[] = [];
  private locations: SearchLocation[] = [];
  private locationById!: Map<string, SearchLocation>;
  private gates: ExtractionGate[] = [];

  private escapeOverlay!: Phaser.GameObjects.Rectangle;
  private portalCooldown!: Map<string, number>;
  private unsubs: Array<() => void> = [];

  private autoStart = false;
  private paused = false;
  private statusAccum = 0;
  private minimapAccum = 0;
  private lastPromptId: string | null | undefined;
  private resizeHandler?: () => void;

  constructor() {
    super('Game');
  }

  create(data: { autoStart?: boolean } = {}): void {
    this.resetState();
    this.autoStart = Boolean(data.autoStart);

    const seed = resolveSeed();
    console.info(`%c[Dragon Egg Run] match seed: ${seed}`, 'color:#ffd166');
    this.rng = new Rng(seed);
    this.map = new IslandMap(new MapGenerator(this.rng).generate());

    this.drawTerrain();
    this.drawDecor();
    this.drawObstacles();
    this.createPortals();
    this.createGates();
    this.createLocations();
    this.egg = new DragonEgg(this);
    this.createPlayers();
    this.createEscapeOverlay();

    this.buildSystems();
    this.searchSystem.assignLoot();
    this.cameraSystem.follow(this.human);

    this.bindEvents();

    eventBus.emit('game:ready', {});
    if (this.autoStart) {
      this.state.beginCountdown();
    } else {
      eventBus.emit('game:phase-changed', { phase: GamePhase.MainMenu, previous: GamePhase.MainMenu });
    }
  }

  private resetState(): void {
    this.players = [];
    this.aiPlayers = [];
    this.locations = [];
    this.gates = [];
    this.locationById = new Map();
    this.portalCooldown = new Map();
    this.unsubs = [];
    this.paused = false;
    this.statusAccum = 0;
    this.minimapAccum = 0;
    this.lastPromptId = undefined;
  }

  private buildSystems(): void {
    this.state = new GameStateSystem(
      () => this.time.now,
      () => ({ coins: this.human.coins, carrierHistory: this.eggSystem.getHistory() }),
    );
    this.particles = new ParticleSystem(this);
    this.cameraSystem = new CameraSystem(this, this.map);

    this.refs = {
      scene: this,
      rng: this.rng,
      map: this.map,
      state: this.state,
      particles: this.particles,
      egg: this.egg,
      human: this.human,
      players: this.players,
      aiPlayers: this.aiPlayers,
      locations: this.locations,
      locationById: this.locationById,
      gates: this.gates,
    };

    this.eggSystem = new EggSystem(this.refs);
    this.searchSystem = new SearchSystem(this.refs, this.eggSystem);
    this.aiSystem = new AISystem(this.refs, this.searchSystem, this.eggSystem);
    this.inputSystem = new InputSystem(this);
    this.collision = new CollisionSystem(this.refs);
    void this.collision;
  }

  /* ================================================================ *
   * Update loop                                                      *
   * ================================================================ */

  override update(time: number, delta: number): void {
    if (this.paused) return;
    this.state.update(delta);

    const now = time;
    const live = this.state.movementAllowed;

    this.updateSearchPrompt();

    const searchPressed = this.inputSystem.consumeSearchPressed();

    if (live) {
      const move = this.inputSystem.getMoveVector();
      this.human.moveDir.x = move.x;
      this.human.moveDir.y = move.y;

      if (this.state.phase === GamePhase.Exploration) {
        if (searchPressed) this.trySearchHuman(now);
        this.searchSystem.update(now);
      }

      this.aiSystem.update(now, delta);

      for (const player of this.players) {
        player.environmentMultiplier = this.map.speedMultiplierAt(player.x, player.y);
        this.checkPortal(player, now);
      }
    } else {
      for (const player of this.players) {
        player.moveDir.x = 0;
        player.moveDir.y = 0;
        player.environmentMultiplier = 1;
      }
    }

    this.eggSystem.update(now, delta);

    for (const player of this.players) player.tick(now, delta);
    for (const gate of this.gates) gate.update(now);

    this.pushThrottledUI(now, delta);
  }

  private pushThrottledUI(now: number, delta: number): void {
    this.statusAccum += delta;
    if (this.statusAccum >= 200) {
      this.statusAccum = 0;
      eventBus.emit('player:status-changed', { effects: this.human.statusViews(now) });
    }
    this.minimapAccum += delta;
    if (this.minimapAccum >= MINIMAP.updateIntervalMs) {
      this.minimapAccum = 0;
      eventBus.emit('minimap:update', this.buildSnapshot());
    }
  }

  /* ---- human search interaction --------------------------------- */

  private trySearchHuman(now: number): void {
    if (this.state.phase !== GamePhase.Exploration) return;
    if (this.searchSystem.isSearching(this.human.id)) return;
    const loc = this.nearestSearchable(this.human);
    if (loc) this.searchSystem.tryStartSearch(this.human, loc, now);
  }

  private nearestSearchable(player: Player): SearchLocation | null {
    let best: SearchLocation | null = null;
    let bestD = SEARCH.radius * SEARCH.radius;
    for (const loc of this.locations) {
      if (loc.opened || loc.claimedBy) continue;
      const d = loc.distanceToSq(player.x, player.y);
      if (d <= bestD) {
        bestD = d;
        best = loc;
      }
    }
    return best;
  }

  private updateSearchPrompt(): void {
    let promptLoc: SearchLocation | null = null;
    if (this.state.phase === GamePhase.Exploration && !this.searchSystem.isSearching(this.human.id)) {
      promptLoc = this.nearestSearchable(this.human);
    }
    const id = promptLoc ? promptLoc.id : null;
    if (id === this.lastPromptId) return;
    this.lastPromptId = id;
    if (promptLoc) {
      eventBus.emit('search:prompt', {
        visible: true,
        label: promptLoc.promptLabel(),
        locationId: promptLoc.id,
      });
    } else {
      eventBus.emit('search:prompt', { visible: false });
    }
  }

  private checkPortal(player: Player, now: number): void {
    if (now < (this.portalCooldown.get(player.id) ?? 0)) return;
    const exit = this.map.portalExitFor(player.x, player.y, 30);
    if (!exit) return;
    this.portalCooldown.set(player.id, now + 1400);
    this.particles.portalSparkle(player.x, player.y);
    player.setPosition(exit.x, exit.y);
    player.body.reset(exit.x, exit.y);
    this.particles.portalSparkle(exit.x, exit.y);
    if (player.isHuman) eventBus.emit('audio:play', { sound: 'portal' });
  }

  private buildSnapshot(): MinimapSnapshot {
    const entities: MinimapEntity[] = [];
    for (const loc of this.locations) {
      if (!loc.opened) entities.push({ x: loc.x, y: loc.y, kind: 'search', color: COLORS.gateBeam });
    }
    for (const gate of this.gates) {
      entities.push({
        x: gate.x,
        y: gate.y,
        kind: 'gate',
        color: gate.active ? COLORS.gateActive : COLORS.gate,
      });
    }
    for (const ai of this.aiPlayers) {
      entities.push({
        x: ai.x,
        y: ai.y,
        kind: ai.isCarrier ? 'carrier' : 'ai',
        color: ai.isCarrier ? COLORS.egg : ai.color,
      });
    }
    if (this.eggSystem.isDropped()) {
      const g = this.eggSystem.getGroundPosition();
      entities.push({ x: g.x, y: g.y, kind: 'egg', color: COLORS.egg });
    }
    entities.push({
      x: this.human.x,
      y: this.human.y,
      kind: this.human.isCarrier ? 'carrier' : 'human',
      color: this.human.isCarrier ? COLORS.egg : COLORS.human,
    });
    return { width: this.map.width, height: this.map.height, entities };
  }

  /* ================================================================ *
   * Entity construction                                              *
   * ================================================================ */

  private createPlayers(): void {
    const spawns = this.map.data.spawns;
    const hp = spawns[0];
    this.human = new Player(this, {
      id: 'human',
      name: 'You',
      color: COLORS.human,
      isHuman: true,
      x: hp.x,
      y: hp.y,
    });
    this.players.push(this.human);

    const personalities = [
      AIPersonality.Aggressive,
      AIPersonality.Greedy,
      AIPersonality.Cautious,
      AIPersonality.Wanderer,
    ];
    for (let i = 0; i < AI.count; i++) {
      const spawn = spawns[(i + 1) % spawns.length];
      const ai = new AIPlayer(this, {
        id: `ai-${i}`,
        name: AI_NAMES[i % AI_NAMES.length],
        color: AI_COLORS[i % AI_COLORS.length],
        isHuman: false,
        x: spawn.x,
        y: spawn.y,
        personality: personalities[i % personalities.length],
      });
      ai.lastProgressAt = this.time.now;
      this.players.push(ai);
      this.aiPlayers.push(ai);
    }
  }

  private createLocations(): void {
    for (const def of this.map.data.searchLocations) {
      const loc = new SearchLocation(this, def);
      this.locations.push(loc);
      this.locationById.set(loc.id, loc);
    }
  }

  private createGates(): void {
    for (const def of this.map.data.gates) {
      this.gates.push(new ExtractionGate(this, def));
    }
  }

  private createPortals(): void {
    this.map.data.portals.forEach((portal, i) => {
      const color = i === 0 ? COLORS.portalA : COLORS.portalB;
      this.createPortalMarker(portal.ax, portal.ay, color);
      this.createPortalMarker(portal.bx, portal.by, color);
    });
  }

  private createPortalMarker(x: number, y: number, color: number): void {
    const container = this.add.container(x, y).setDepth(7);
    const glow = this.add.graphics();
    glow.fillStyle(color, 0.2);
    glow.fillCircle(0, 0, 32);
    const pool = this.add.graphics();
    pool.fillStyle(0x10131f, 0.6);
    pool.fillEllipse(0, 0, 46, 32);
    pool.lineStyle(3, color, 0.9);
    pool.strokeEllipse(0, 0, 46, 32);
    const swirl = this.add.graphics();
    swirl.lineStyle(3, color, 0.85);
    swirl.strokeCircle(0, 0, 13);
    swirl.lineStyle(2, 0xffffff, 0.5);
    swirl.strokeCircle(0, 0, 7);

    container.add([glow, pool, swirl]);
    this.tweens.add({ targets: swirl, angle: 360, duration: 3200, repeat: -1 });
    this.tweens.add({
      targets: glow,
      scale: { from: 0.85, to: 1.18 },
      alpha: { from: 0.5, to: 1 },
      duration: 1100,
      yoyo: true,
      repeat: -1,
    });
  }

  private createEscapeOverlay(): void {
    this.escapeOverlay = this.add
      .rectangle(this.map.width / 2, this.map.height / 2, this.map.width, this.map.height, 0xff5530, 1)
      .setAlpha(0)
      .setDepth(14);
  }

  /* ================================================================ *
   * Event wiring & cinematics                                        *
   * ================================================================ */

  private bindEvents(): void {
    this.unsubs.push(
      eventBus.on('ui:start-match', () => this.scene.restart({ autoStart: true })),
      eventBus.on('ui:restart', () => this.scene.restart({ autoStart: true })),
      eventBus.on('ui:menu', () => this.scene.restart({ autoStart: false })),
      eventBus.on('ui:pause', () => this.pauseMatch()),
      eventBus.on('ui:resume', () => this.resumeMatch()),
      eventBus.on('egg:found', () => this.playEggFoundCinematic()),
      eventBus.on('egg:dropped', () => this.cameraSystem.shake(240, 0.013)),
      eventBus.on('match:ended', ({ outcome }) => {
        eventBus.emit('audio:play', { sound: outcome === 'victory' ? 'victory' : 'defeat' });
      }),
    );

    this.input.on(
      Phaser.Input.Events.GAMEOBJECT_DOWN,
      (_pointer: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject) => {
        if (obj instanceof SearchLocation) this.trySearchHuman(this.time.now);
      },
    );

    this.resizeHandler = () => this.cameraSystem.handleResize();
    this.scale.on('resize', this.resizeHandler);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());
  }

  private playEggFoundCinematic(): void {
    this.searchSystem.cancelAll();
    this.gates.forEach((gate) => gate.activate());
    this.cameraSystem.shake(640, 0.02);
    this.cameraSystem.flash(420, 255, 224, 150);
    this.cameraSystem.punchZoom(this.cameras.main.zoom * 1.12, 280);
    this.tweens.add({ targets: this.escapeOverlay, alpha: 0.22, duration: 900 });
  }

  private pauseMatch(): void {
    if (!this.state.isMatchActive || this.state.isFinished) return;
    this.paused = true;
    this.physics.world.pause();
  }

  private resumeMatch(): void {
    if (!this.paused) return;
    this.paused = false;
    this.physics.world.resume();
  }

  private teardown(): void {
    this.unsubs.forEach((off) => off());
    this.unsubs = [];
    this.inputSystem.destroy();
    if (this.resizeHandler) {
      this.scale.off('resize', this.resizeHandler);
      this.resizeHandler = undefined;
    }
  }

  /* ================================================================ *
   * Procedural world rendering (drawn once)                          *
   * ================================================================ */

  private drawTerrain(): void {
    const { width, height, bounds, obstacles, forests, bridges } = this.map.data;
    const g = this.add.graphics().setDepth(-20);

    g.fillStyle(COLORS.ocean, 1);
    g.fillRect(0, 0, width, height);
    g.fillStyle(COLORS.oceanFoam, 0.06);
    for (let i = 0; i < 70; i++) {
      g.fillEllipse(
        this.rng.range(0, width),
        this.rng.range(0, height),
        this.rng.range(40, 130),
        this.rng.range(8, 18),
      );
    }

    g.fillStyle(COLORS.sand, 1);
    g.fillRoundedRect(bounds.x - 30, bounds.y - 30, bounds.width + 60, bounds.height + 60, 80);
    g.fillStyle(COLORS.grassDark, 1);
    g.fillRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, 56);
    g.fillStyle(COLORS.grass, 1);
    g.fillRoundedRect(bounds.x + 5, bounds.y + 5, bounds.width - 10, bounds.height - 10, 52);

    for (let i = 0; i < 48; i++) {
      g.fillStyle(this.rng.chance(0.5) ? COLORS.grassLight : COLORS.grassDark, 0.45);
      g.fillEllipse(
        this.rng.range(bounds.x, bounds.x + bounds.width),
        this.rng.range(bounds.y, bounds.y + bounds.height),
        this.rng.range(60, 160),
        this.rng.range(34, 90),
      );
    }

    for (const f of forests) {
      g.fillStyle(COLORS.forest, 0.18);
      g.fillCircle(f.x, f.y, f.radius * 1.1);
      g.fillStyle(COLORS.forest, 0.3);
      g.fillCircle(f.x, f.y, f.radius * 0.82);
    }

    for (const o of obstacles) {
      if (o.kind !== 'water') continue;
      g.fillStyle(COLORS.ocean, 1);
      g.lineStyle(4, COLORS.oceanFoam, 0.5);
      if (o.shape === 'circle') {
        g.fillCircle(o.x, o.y, o.radius);
        g.strokeCircle(o.x, o.y, o.radius);
      } else {
        g.fillRect(o.x - o.width / 2, o.y - o.height / 2, o.width, o.height);
        g.strokeRect(o.x - o.width / 2, o.y - o.height / 2, o.width, o.height);
      }
    }

    for (const bridge of bridges) this.drawBridge(g, bridge.x, bridge.y, bridge.width, bridge.height);
  }

  private drawBridge(
    g: Phaser.GameObjects.Graphics,
    cx: number,
    cy: number,
    w: number,
    h: number,
  ): void {
    const x = cx - w / 2;
    const y = cy - h / 2;
    g.fillStyle(COLORS.bridgePlank, 1);
    g.fillRect(x, y, w, h);
    g.fillStyle(COLORS.bridge, 1);
    for (let py = y + 5; py < y + h - 5; py += 18) {
      g.fillRect(x + 4, py, w - 8, 13);
    }
    g.fillStyle(COLORS.bridgePlank, 1);
    g.fillRect(x, y, w, 6);
    g.fillRect(x, y + h - 6, w, 6);
  }

  private drawDecor(): void {
    const g = this.add.graphics().setDepth(4);
    for (const d of this.map.data.decor) this.drawDecorItem(g, d);
  }

  private drawDecorItem(g: Phaser.GameObjects.Graphics, d: DecorDef): void {
    switch (d.kind) {
      case DecorKind.Tree:
        this.drawTree(g, d.x, d.y, d.scale, d.tint);
        break;
      case DecorKind.Bush:
        g.fillStyle(d.tint, 1);
        g.fillCircle(d.x, d.y, 9 * d.scale);
        g.fillCircle(d.x - 7 * d.scale, d.y + 3, 7 * d.scale);
        g.fillCircle(d.x + 7 * d.scale, d.y + 2, 7 * d.scale);
        break;
      case DecorKind.Flower:
        g.fillStyle(COLORS.grassDark, 1);
        g.fillRect(d.x - 1, d.y, 2, 7);
        g.fillStyle(d.tint, 1);
        g.fillCircle(d.x, d.y, 3.6 * d.scale);
        g.fillStyle(0xffffff, 0.85);
        g.fillCircle(d.x, d.y, 1.5 * d.scale);
        break;
      case DecorKind.Rock:
        g.fillStyle(COLORS.rockDark, 1);
        g.fillEllipse(d.x, d.y + 2, 16 * d.scale, 11 * d.scale);
        g.fillStyle(d.tint, 1);
        g.fillEllipse(d.x, d.y, 15 * d.scale, 10 * d.scale);
        break;
      case DecorKind.Lily:
        g.fillStyle(COLORS.forestCanopy, 1);
        g.fillEllipse(d.x, d.y, 18 * d.scale, 13 * d.scale);
        g.fillStyle(COLORS.grassDark, 0.7);
        g.fillTriangle(d.x, d.y, d.x + 9 * d.scale, d.y - 2, d.x + 8 * d.scale, d.y + 4);
        break;
      default:
        break;
    }
  }

  private drawTree(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    scale: number,
    tint: number,
  ): void {
    g.fillStyle(0x0c1a12, 0.22);
    g.fillEllipse(x, y + 11 * scale, 24 * scale, 9 * scale);
    g.fillStyle(COLORS.trunk, 1);
    g.fillRect(x - 3 * scale, y, 6 * scale, 13 * scale);
    g.fillStyle(tint, 1);
    g.fillCircle(x, y - 6 * scale, 15 * scale);
    g.fillCircle(x - 10 * scale, y, 11 * scale);
    g.fillCircle(x + 10 * scale, y, 11 * scale);
    g.fillStyle(0xffffff, 0.08);
    g.fillCircle(x - 5 * scale, y - 10 * scale, 7 * scale);
  }

  private drawObstacles(): void {
    const g = this.add.graphics().setDepth(6);
    for (const o of this.map.data.obstacles) {
      switch (o.kind) {
        case 'rock':
          if (o.shape === 'circle') this.drawRock(g, o);
          break;
        case 'tree':
          if (o.shape === 'circle') this.drawTree(g, o.x, o.y, 1.5, COLORS.forest);
          break;
        case 'ruin-wall':
          if (o.shape === 'rect') this.drawWall(g, o);
          break;
        case 'hut':
          if (o.shape === 'rect') this.drawHut(g, o);
          break;
        default:
          break;
      }
    }
  }

  private drawRock(g: Phaser.GameObjects.Graphics, o: CircleObstacle): void {
    g.fillStyle(0x0c1a12, 0.24);
    g.fillEllipse(o.x, o.y + o.radius * 0.5, o.radius * 2.1, o.radius * 0.8);
    g.fillStyle(COLORS.rockDark, 1);
    g.fillCircle(o.x, o.y, o.radius);
    g.fillStyle(COLORS.rock, 1);
    g.fillCircle(o.x - o.radius * 0.2, o.y - o.radius * 0.25, o.radius * 0.78);
    g.fillStyle(0xffffff, 0.12);
    g.fillCircle(o.x - o.radius * 0.35, o.y - o.radius * 0.4, o.radius * 0.32);
  }

  private drawWall(g: Phaser.GameObjects.Graphics, o: RectObstacle): void {
    const x = o.x - o.width / 2;
    const y = o.y - o.height / 2;
    g.fillStyle(0x0c1a12, 0.22);
    g.fillRect(x + 3, y + o.height - 4, o.width, 8);
    g.fillStyle(COLORS.ruinDark, 1);
    g.fillRoundedRect(x, y, o.width, o.height, 4);
    g.fillStyle(COLORS.ruin, 1);
    g.fillRoundedRect(x, y, o.width, Math.max(6, o.height * 0.5), 4);
    g.lineStyle(2, 0x5b564d, 0.6);
    g.strokeRoundedRect(x, y, o.width, o.height, 4);
  }

  private drawHut(g: Phaser.GameObjects.Graphics, o: RectObstacle): void {
    const x = o.x - o.width / 2;
    const y = o.y - o.height / 2;
    g.fillStyle(0x0c1a12, 0.26);
    g.fillEllipse(o.x, o.y + o.height * 0.5, o.width * 1.1, o.height * 0.4);
    g.fillStyle(COLORS.hutWall, 1);
    g.fillRoundedRect(x, y + o.height * 0.32, o.width, o.height * 0.68, 4);
    g.fillStyle(COLORS.hutRoof, 1);
    g.fillTriangle(x - 6, y + o.height * 0.4, x + o.width + 6, y + o.height * 0.4, o.x, y - 6);
    g.fillStyle(0x4a2f1c, 1);
    g.fillRoundedRect(o.x - 7, o.y + o.height * 0.12, 14, o.height * 0.38, 2);
  }
}
