/**
 * Deterministic island builder.
 *
 * The layout is "handcrafted in code": the macro structure (river, bridges,
 * lakes, ruins, villages, gates, portals) is placed deliberately so connectivity
 * and choke points are guaranteed, while the micro detail (rock scatter, trees,
 * loot positions, spawns) is sampled from the seeded {@link Rng} for variety.
 */
import type {
  BridgeDef,
  DecorDef,
  ExtractionGateDef,
  ForestZoneDef,
  IslandMapData,
  ObstacleDef,
  PortalDef,
  RectObstacle,
  SearchLocationDef,
  SearchLocationKind,
  Vector2,
} from '../types/GameTypes';
import { DecorKind, ObstacleKind, SearchLocationKind as Kind } from '../types/GameTypes';
import { AI, COLORS, WORLD } from './WorldConstants';
import type { Rng } from '../utils/Rng';

const TARGET_LOCATIONS = 44;
const PLAYER_COUNT = AI.count + 1;

/**
 * Note on conventions: every rectangle (obstacles, bridges) uses **centre**
 * coordinates for `x`/`y`, matching circle obstacles. Renderers and physics
 * convert to top-left where needed.
 */
export class MapGenerator {
  private readonly obstacles: ObstacleDef[] = [];
  private readonly forests: ForestZoneDef[] = [];
  private readonly bridges: BridgeDef[] = [];
  private readonly searchLocations: SearchLocationDef[] = [];
  private readonly gates: ExtractionGateDef[] = [];
  private readonly portals: PortalDef[] = [];
  private readonly decor: DecorDef[] = [];
  private readonly spawns: Vector2[] = [];

  private readonly bounds = {
    x: WORLD.coastInset,
    y: WORLD.coastInset,
    width: WORLD.width - WORLD.coastInset * 2,
    height: WORLD.height - WORLD.coastInset * 2,
  };

  private locationSeq = 0;
  private readonly riverX = 1290;
  private readonly riverWidth = 150;

  constructor(private readonly rng: Rng) {}

  generate(): IslandMapData {
    this.buildRiverAndBridges();
    this.buildLakes();
    this.buildForests();
    this.buildRockClusters();
    this.buildRuins(700, 430);
    this.buildRuins(1980, 1520);
    this.buildVillage(2150, 420);
    this.buildVillage(980, 1620);
    this.buildShrines();
    this.buildPortals();
    this.buildGates();
    this.scatterSearchLocations();
    this.scatterDecor();
    this.buildSpawns();

    return {
      width: WORLD.width,
      height: WORLD.height,
      bounds: this.bounds,
      obstacles: this.obstacles,
      forests: this.forests,
      bridges: this.bridges,
      searchLocations: this.searchLocations,
      gates: this.gates,
      portals: this.portals,
      decor: this.decor,
      spawns: this.spawns,
    };
  }

  /* --------------------------------------------------------------- *
   * Macro structure                                                 *
   * --------------------------------------------------------------- */

  private buildRiverAndBridges(): void {
    const top = this.bounds.y;
    const bottom = this.bounds.y + this.bounds.height;
    const gap1 = 560;
    const gap2 = 1380;
    const gapHalf = 96;

    // River = three vertical water slabs separated by two bridge gaps.
    this.addRiverSegment(top, gap1 - gapHalf);
    this.addRiverSegment(gap1 + gapHalf, gap2 - gapHalf);
    this.addRiverSegment(gap2 + gapHalf, bottom);

    for (const gy of [gap1, gap2]) {
      this.bridges.push({
        x: this.riverX,
        y: gy,
        width: this.riverWidth + 54,
        height: gapHalf * 2 + 26,
      });
    }
  }

  private addRiverSegment(yStart: number, yEnd: number): void {
    if (yEnd <= yStart) return;
    this.obstacles.push({
      shape: 'rect',
      x: this.riverX,
      y: (yStart + yEnd) / 2,
      width: this.riverWidth,
      height: yEnd - yStart,
      kind: ObstacleKind.Water,
    });
  }

  private buildLakes(): void {
    const lakes: Array<{ x: number; y: number; r: number }> = [
      { x: 1980, y: 690, r: 240 },
      { x: 760, y: 1430, r: 180 },
    ];
    for (const lake of lakes) {
      this.obstacles.push({
        shape: 'circle',
        x: lake.x,
        y: lake.y,
        radius: lake.r,
        kind: ObstacleKind.Water,
      });
      // Lily pads for flavour.
      const pads = this.rng.int(4, 7);
      for (let i = 0; i < pads; i++) {
        const a = this.rng.angle();
        const d = this.rng.range(lake.r * 0.3, lake.r * 0.8);
        this.decor.push({
          kind: DecorKind.Lily,
          x: lake.x + Math.cos(a) * d,
          y: lake.y + Math.sin(a) * d,
          scale: this.rng.range(0.7, 1.2),
          tint: COLORS.forestCanopy,
        });
      }
    }
  }

  private buildForests(): void {
    const anchors: Array<{ x: number; y: number; r: number }> = [
      { x: 470, y: 760, r: 230 },
      { x: 1700, y: 1250, r: 250 },
      { x: 2300, y: 1050, r: 210 },
      { x: 980, y: 1080, r: 200 },
      { x: 2080, y: 1640, r: 190 },
      { x: 1480, y: 540, r: 170 },
    ];
    for (const forest of anchors) {
      this.forests.push({ x: forest.x, y: forest.y, radius: forest.r });

      // A few canopy trees inside the forest are solid; the rest are decor.
      const solid = this.rng.int(2, 4);
      for (let i = 0; i < solid; i++) {
        const a = this.rng.angle();
        const d = this.rng.range(0, forest.r * 0.7);
        const x = forest.x + Math.cos(a) * d;
        const y = forest.y + Math.sin(a) * d;
        this.obstacles.push({ shape: 'circle', x, y, radius: 20, kind: ObstacleKind.Tree });
      }

      const trees = this.rng.int(9, 16);
      for (let i = 0; i < trees; i++) {
        const a = this.rng.angle();
        const d = this.rng.range(0, forest.r);
        this.decor.push({
          kind: DecorKind.Tree,
          x: forest.x + Math.cos(a) * d,
          y: forest.y + Math.sin(a) * d,
          scale: this.rng.range(0.85, 1.5),
          tint: this.rng.chance(0.5) ? COLORS.forest : COLORS.forestCanopy,
        });
      }
    }
  }

  private buildRockClusters(): void {
    const anchors: Vector2[] = [
      { x: 560, y: 520 },
      { x: 2350, y: 820 },
      { x: 2230, y: 1330 },
      { x: 520, y: 1120 },
      { x: 1640, y: 880 },
    ];
    for (const anchor of anchors) {
      const rocks = this.rng.int(3, 5);
      for (let i = 0; i < rocks; i++) {
        const a = this.rng.angle();
        const d = this.rng.range(0, 70);
        const x = anchor.x + Math.cos(a) * d;
        const y = anchor.y + Math.sin(a) * d;
        this.obstacles.push({
          shape: 'circle',
          x,
          y,
          radius: this.rng.range(28, 46),
          kind: ObstacleKind.Rock,
        });
      }
      // Caves hide among the rocks — searchable.
      this.tryAddLocation(anchor.x, anchor.y, 110, Kind.Cave);
    }
  }

  private buildRuins(cx: number, cy: number): void {
    const hw = 190;
    const hh = 150;
    const t = 26;
    const g = 58; // half-gap (opening) on each wall

    // Perimeter walls with a doorway in the middle of each side.
    this.addWall(cx - hw, cy - hh, cx - g, cy - hh, t); // top-left
    this.addWall(cx + g, cy - hh, cx + hw, cy - hh, t); // top-right
    this.addWall(cx - hw, cy + hh, cx - g, cy + hh, t); // bottom-left
    this.addWall(cx + g, cy + hh, cx + hw, cy + hh, t); // bottom-right
    this.addWall(cx - hw, cy - hh, cx - hw, cy - g, t); // left-top
    this.addWall(cx - hw, cy + g, cx - hw, cy + hh, t); // left-bottom
    this.addWall(cx + hw, cy - hh, cx + hw, cy - g, t); // right-top
    this.addWall(cx + hw, cy + g, cx + hw, cy + hh, t); // right-bottom

    // Broken pillars as decor.
    for (const [px, py] of [
      [cx - hw, cy - hh],
      [cx + hw, cy - hh],
      [cx - hw, cy + hh],
      [cx + hw, cy + hh],
    ]) {
      this.decor.push({ kind: DecorKind.Rock, x: px, y: py, scale: 1.1, tint: COLORS.ruin });
    }

    // Treasures within the ruins.
    this.tryAddLocation(cx, cy, 30, Kind.Altar);
    this.tryAddLocation(cx - 90, cy + 40, 30, Kind.Ruin);
    this.tryAddLocation(cx + 95, cy - 35, 30, Kind.Ruin);
  }

  private buildVillage(cx: number, cy: number): void {
    const huts = 5;
    const ring = 150;
    for (let i = 0; i < huts; i++) {
      const a = (i / huts) * Math.PI * 2 + this.rng.range(-0.2, 0.2);
      const x = cx + Math.cos(a) * ring;
      const y = cy + Math.sin(a) * ring;
      this.obstacles.push({
        shape: 'rect',
        x,
        y,
        width: 80,
        height: 66,
        kind: ObstacleKind.Hut,
      });
      this.decor.push({ kind: DecorKind.Bush, x: x + 46, y: y + 30, scale: 1, tint: COLORS.grassDark });
    }
    // Market chests in and around the village.
    this.tryAddLocation(cx, cy, 26, Kind.Chest);
    this.tryAddLocation(cx + ring * 0.6, cy + ring * 0.6, 40, Kind.Hut);
    this.tryAddLocation(cx - ring * 0.6, cy - ring * 0.55, 40, Kind.Hut);
  }

  private buildShrines(): void {
    const spots: Vector2[] = [
      { x: 1180, y: 1500 },
      { x: 2360, y: 1620 },
      { x: 380, y: 1500 },
      { x: 1520, y: 1680 },
      { x: 2480, y: 320 },
    ];
    for (const spot of spots) {
      const placed = this.tryAddLocation(spot.x, spot.y, 90, Kind.Shrine);
      if (placed) {
        this.decor.push({ kind: DecorKind.Flower, x: spot.x, y: spot.y + 40, scale: 1.2, tint: COLORS.shrineGlow });
      }
    }
  }

  private buildPortals(): void {
    // Two diagonal portal pairs let players make daring shortcuts across the
    // river — handy for both the carrier and the chasers.
    const corners: Array<[Vector2, Vector2]> = [
      [
        { x: 380, y: 400 },
        { x: 2440, y: 1620 },
      ],
      [
        { x: 2440, y: 400 },
        { x: 380, y: 1620 },
      ],
    ];
    corners.forEach(([a, b], i) => {
      const pa = this.findClearPoint(a.x, a.y, 60);
      const pb = this.findClearPoint(b.x, b.y, 60);
      this.portals.push({ id: `portal-${i}`, ax: pa.x, ay: pa.y, bx: pb.x, by: pb.y });
    });
  }

  private buildGates(): void {
    const desired: Vector2[] = [
      { x: 300, y: 980 },
      { x: 1040, y: 250 },
      { x: 2490, y: 560 },
      { x: 2470, y: 1500 },
      { x: 720, y: 1760 },
    ];
    desired.forEach((spot, i) => {
      const clear = this.findClearPoint(spot.x, spot.y, 64);
      this.gates.push({ id: `gate-${i}`, x: clear.x, y: clear.y });
    });
  }

  /* --------------------------------------------------------------- *
   * Scatter passes                                                  *
   * --------------------------------------------------------------- */

  private scatterSearchLocations(): void {
    const kinds: SearchLocationKind[] = [Kind.Chest, Kind.Chest, Kind.Ruin, Kind.Cave, Kind.Shrine];
    let attempts = 0;
    while (this.searchLocations.length < TARGET_LOCATIONS && attempts < 2000) {
      attempts++;
      const x = this.rng.range(this.bounds.x + 70, this.bounds.x + this.bounds.width - 70);
      const y = this.rng.range(this.bounds.y + 70, this.bounds.y + this.bounds.height - 70);
      this.tryAddLocation(x, y, 0, this.rng.pick(kinds), 150);
    }
  }

  private scatterDecor(): void {
    this.scatterDecorKind(DecorKind.Flower, 80, COLORS.shrineGlow, 0.7, 1.3);
    this.scatterDecorKind(DecorKind.Bush, 46, COLORS.grassDark, 0.8, 1.4);
    this.scatterDecorKind(DecorKind.Tree, 26, COLORS.forest, 0.9, 1.4);
    this.scatterDecorKind(DecorKind.Rock, 26, COLORS.rock, 0.6, 1.1);
  }

  private scatterDecorKind(
    kind: DecorDef['kind'],
    count: number,
    tint: number,
    minScale: number,
    maxScale: number,
  ): void {
    let placed = 0;
    let attempts = 0;
    while (placed < count && attempts < count * 8) {
      attempts++;
      const x = this.rng.range(this.bounds.x + 30, this.bounds.x + this.bounds.width - 30);
      const y = this.rng.range(this.bounds.y + 30, this.bounds.y + this.bounds.height - 30);
      // Decor must avoid solid obstacles (water especially) but may sit on grass.
      if (this.overlapsObstacle(x, y, 14)) continue;
      this.decor.push({ kind, x, y, scale: this.rng.range(minScale, maxScale), tint });
      placed++;
    }
  }

  private buildSpawns(): void {
    let attempts = 0;
    while (this.spawns.length < PLAYER_COUNT && attempts < 3000) {
      attempts++;
      const x = this.rng.range(this.bounds.x + 90, this.bounds.x + this.bounds.width - 90);
      const y = this.rng.range(this.bounds.y + 90, this.bounds.y + this.bounds.height - 90);
      if (this.overlapsObstacle(x, y, 64)) continue;
      if (!this.farFromAll(this.spawns, x, y, 300)) continue;
      this.spawns.push({ x, y });
    }
    // Guarantee enough spawns even if sampling was unlucky.
    while (this.spawns.length < PLAYER_COUNT) {
      const fallback = this.findClearPoint(
        this.rng.range(this.bounds.x + 120, this.bounds.x + this.bounds.width - 120),
        this.rng.range(this.bounds.y + 120, this.bounds.y + this.bounds.height - 120),
        56,
      );
      this.spawns.push(fallback);
    }
  }

  /* --------------------------------------------------------------- *
   * Geometry helpers                                                *
   * --------------------------------------------------------------- */

  private addWall(ax: number, ay: number, bx: number, by: number, thickness: number): void {
    const rect: RectObstacle = {
      shape: 'rect',
      x: (ax + bx) / 2,
      y: (ay + by) / 2,
      width: Math.max(Math.abs(bx - ax), thickness),
      height: Math.max(Math.abs(by - ay), thickness),
      kind: ObstacleKind.RuinWall,
    };
    this.obstacles.push(rect);
  }

  private tryAddLocation(
    x: number,
    y: number,
    jitter: number,
    kind: SearchLocationKind,
    minSpacing = 130,
  ): boolean {
    for (let attempt = 0; attempt < 8; attempt++) {
      const px = x + (jitter ? this.rng.range(-jitter, jitter) : 0);
      const py = y + (jitter ? this.rng.range(-jitter, jitter) : 0);
      if (!this.insideBounds(px, py, 56)) continue;
      if (this.overlapsObstacle(px, py, 40)) continue;
      if (!this.farFromAll(this.searchLocations, px, py, minSpacing)) continue;
      if (!this.farFromAll(this.gates, px, py, 150)) continue;
      this.searchLocations.push({ id: `loc-${this.locationSeq++}`, x: px, y: py, kind });
      return true;
    }
    return false;
  }

  private insideBounds(x: number, y: number, margin: number): boolean {
    return (
      x >= this.bounds.x + margin &&
      x <= this.bounds.x + this.bounds.width - margin &&
      y >= this.bounds.y + margin &&
      y <= this.bounds.y + this.bounds.height - margin
    );
  }

  private overlapsObstacle(x: number, y: number, clearance: number): boolean {
    for (const o of this.obstacles) {
      if (o.shape === 'circle') {
        if (Math.hypot(x - o.x, y - o.y) < o.radius + clearance) return true;
      } else if (this.rectDistance(x, y, o) < clearance) {
        return true;
      }
    }
    return false;
  }

  private rectDistance(px: number, py: number, r: RectObstacle): number {
    const dx = Math.max(Math.abs(px - r.x) - r.width / 2, 0);
    const dy = Math.max(Math.abs(py - r.y) - r.height / 2, 0);
    return Math.hypot(dx, dy);
  }

  private farFromAll(points: ReadonlyArray<Vector2>, x: number, y: number, minDist: number): boolean {
    const minSq = minDist * minDist;
    for (const p of points) {
      const dx = p.x - x;
      const dy = p.y - y;
      if (dx * dx + dy * dy < minSq) return false;
    }
    return true;
  }

  /** Spiral outward from (x,y) until a point clear of obstacles is found. */
  private findClearPoint(x: number, y: number, clearance: number): Vector2 {
    if (this.insideBounds(x, y, clearance) && !this.overlapsObstacle(x, y, clearance)) {
      return { x, y };
    }
    for (let r = 40; r < 700; r += 40) {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const px = x + Math.cos(a) * r;
        const py = y + Math.sin(a) * r;
        if (this.insideBounds(px, py, clearance) && !this.overlapsObstacle(px, py, clearance)) {
          return { x: px, y: py };
        }
      }
    }
    return { x, y };
  }
}
