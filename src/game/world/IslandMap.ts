/**
 * Runtime wrapper around generated {@link IslandMapData}. Holds the immutable
 * layout and answers the spatial questions gameplay systems ask every frame
 * (forest slow zones, bounds clamping, portal lookups).
 */
import type {
  ForestZoneDef,
  IslandMapData,
  ObstacleDef,
  PortalDef,
  Vector2,
} from '../types/GameTypes';
import type { Rng } from '../utils/Rng';
import { PLAYER } from './WorldConstants';

export class IslandMap {
  constructor(public readonly data: IslandMapData) {}

  get width(): number {
    return this.data.width;
  }

  get height(): number {
    return this.data.height;
  }

  get bounds() {
    return this.data.bounds;
  }

  /** Keep a circular body of `radius` fully inside the playable coastline. */
  clampToBounds(x: number, y: number, radius: number): Vector2 {
    const b = this.data.bounds;
    return {
      x: Math.min(Math.max(x, b.x + radius), b.x + b.width - radius),
      y: Math.min(Math.max(y, b.y + radius), b.y + b.height - radius),
    };
  }

  isInsideBounds(x: number, y: number, radius = 0): boolean {
    const b = this.data.bounds;
    return (
      x >= b.x + radius &&
      x <= b.x + b.width - radius &&
      y >= b.y + radius &&
      y <= b.y + b.height - radius
    );
  }

  /** Movement multiplier at a point (forest canopies slow adventurers down). */
  speedMultiplierAt(x: number, y: number): number {
    return this.isInForest(x, y) ? PLAYER.forestMultiplier : 1;
  }

  isInForest(x: number, y: number): boolean {
    for (const forest of this.data.forests) {
      if (withinCircle(x, y, forest)) return true;
    }
    return false;
  }

  /** Would a body of `radius` at (x,y) intersect any solid obstacle? */
  isBlocked(x: number, y: number, radius: number): boolean {
    for (const obstacle of this.data.obstacles) {
      if (obstacleOverlaps(obstacle, x, y, radius)) return true;
    }
    return false;
  }

  /** Sample a point clear of obstacles, optionally far from a reference point. */
  randomClearPoint(rng: Rng, radius: number, from?: Vector2, minFromDist = 0): Vector2 {
    const b = this.data.bounds;
    for (let i = 0; i < 80; i++) {
      const x = b.x + radius + rng.next() * (b.width - radius * 2);
      const y = b.y + radius + rng.next() * (b.height - radius * 2);
      if (this.isBlocked(x, y, radius)) continue;
      if (from && Math.hypot(x - from.x, y - from.y) < minFromDist) continue;
      return { x, y };
    }
    return this.clampToBounds(from?.x ?? b.x + b.width / 2, from?.y ?? b.y + b.height / 2, radius);
  }

  /**
   * If `(x, y)` overlaps a portal mouth, return the matching exit point (with a
   * little push-off so the traveller doesn't immediately re-trigger it).
   */
  portalExitFor(x: number, y: number, triggerRadius: number): Vector2 | null {
    for (const portal of this.data.portals) {
      const exit = this.resolvePortal(portal, x, y, triggerRadius);
      if (exit) return exit;
    }
    return null;
  }

  private resolvePortal(
    portal: PortalDef,
    x: number,
    y: number,
    triggerRadius: number,
  ): Vector2 | null {
    const pushOff = triggerRadius + 36;
    if (within(x, y, portal.ax, portal.ay, triggerRadius)) {
      return offsetTowards(portal.bx, portal.by, portal.ax, portal.ay, pushOff);
    }
    if (within(x, y, portal.bx, portal.by, triggerRadius)) {
      return offsetTowards(portal.ax, portal.ay, portal.bx, portal.by, pushOff);
    }
    return null;
  }
}

function within(x: number, y: number, cx: number, cy: number, r: number): boolean {
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

function obstacleOverlaps(o: ObstacleDef, x: number, y: number, radius: number): boolean {
  if (o.shape === 'circle') {
    return within(x, y, o.x, o.y, o.radius + radius);
  }
  const dx = Math.max(Math.abs(x - o.x) - o.width / 2, 0);
  const dy = Math.max(Math.abs(y - o.y) - o.height / 2, 0);
  return dx * dx + dy * dy < radius * radius;
}

function withinCircle(x: number, y: number, c: ForestZoneDef): boolean {
  return within(x, y, c.x, c.y, c.radius);
}

/** A point `dist` px away from (toX,toY) along the direction (from → to). */
function offsetTowards(
  toX: number,
  toY: number,
  fromX: number,
  fromY: number,
  dist: number,
): Vector2 {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const len = Math.hypot(dx, dy) || 1;
  return { x: toX + (dx / len) * dist, y: toY + (dy / len) * dist };
}
