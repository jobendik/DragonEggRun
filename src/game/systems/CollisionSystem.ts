import type Phaser from 'phaser';
import type { ObstacleDef } from '../types/GameTypes';
import type { GameRefs } from './GameRefs';

/**
 * Builds invisible static collision bodies from the generated obstacle list and
 * wires up the colliders. Obstacles are immovable, non-moving dynamic bodies
 * (simpler circle support than static bodies); players collide with them and
 * with each other so tackles feel physical.
 */
export class CollisionSystem {
  private readonly zones: Phaser.GameObjects.Zone[] = [];

  constructor(private readonly refs: GameRefs) {
    const { scene, map, players } = refs;

    const b = map.bounds;
    scene.physics.world.setBounds(b.x, b.y, b.width, b.height);

    for (const obstacle of map.data.obstacles) {
      this.zones.push(this.createZone(obstacle));
    }

    scene.physics.add.collider(players, this.zones);
    scene.physics.add.collider(players, players);
  }

  private createZone(obstacle: ObstacleDef): Phaser.GameObjects.Zone {
    const scene = this.refs.scene;
    let zone: Phaser.GameObjects.Zone;
    if (obstacle.shape === 'circle') {
      const size = obstacle.radius * 2;
      zone = scene.add.zone(obstacle.x, obstacle.y, size, size);
      scene.physics.add.existing(zone);
      const body = zone.body as Phaser.Physics.Arcade.Body;
      body.setCircle(obstacle.radius);
      this.lock(body);
    } else {
      zone = scene.add.zone(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
      scene.physics.add.existing(zone);
      this.lock(zone.body as Phaser.Physics.Arcade.Body);
    }
    zone.setData('kind', obstacle.kind);
    return zone;
  }

  private lock(body: Phaser.Physics.Arcade.Body): void {
    body.setImmovable(true);
    body.moves = false;
    body.allowGravity = false;
  }
}
