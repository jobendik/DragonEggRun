import Phaser from 'phaser';
import { COLORS } from '../world/WorldConstants';
import {
  SearchLocationKind,
  SearchResult,
  type SearchLocationDef,
} from '../types/GameTypes';

const KIND_LABEL: Record<string, string> = {
  [SearchLocationKind.Chest]: 'Search Chest',
  [SearchLocationKind.Ruin]: 'Search Ruins',
  [SearchLocationKind.Shrine]: 'Search Shrine',
  [SearchLocationKind.Cave]: 'Search Cave',
  [SearchLocationKind.Hut]: 'Search Hut',
  [SearchLocationKind.Altar]: 'Search Altar',
};

/**
 * An interactive point of interest. Every location is assigned a hidden loot
 * result at match start; exactly one holds the Dragon Egg. Appearance is purely
 * cosmetic by `kind` — nothing on screen betrays what is inside until searched.
 */
export class SearchLocation extends Phaser.GameObjects.Container {
  readonly def: SearchLocationDef;
  loot: SearchResult = SearchResult.Empty;
  opened = false;
  /** Adventurer id currently searching this location (prevents double-claims). */
  claimedBy: string | null = null;

  private readonly art: Phaser.GameObjects.Graphics;
  private readonly glow: Phaser.GameObjects.Graphics;
  private glowTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, def: SearchLocationDef) {
    super(scene, def.x, def.y);
    this.def = def;
    this.setDepth(8);

    this.glow = scene.add.graphics();
    this.glow.fillStyle(COLORS.gateBeam, 0.22);
    this.glow.fillCircle(0, 2, 26);
    this.glow.lineStyle(2, COLORS.eggGlow, 0.5);
    this.glow.strokeCircle(0, 2, 22);

    this.art = scene.add.graphics();
    this.drawArt(def.kind);

    this.add([this.glow, this.art]);
    scene.add.existing(this);

    // Tap/click support — the scene decides whether the human is close enough.
    // Containers need an explicit hit area (no texture to infer one from).
    this.setSize(64, 64);
    this.setInteractive(new Phaser.Geom.Circle(0, 0, 34), Phaser.Geom.Circle.Contains);
    if (this.input) this.input.cursor = 'pointer';

    this.glowTween = scene.tweens.add({
      targets: this.glow,
      alpha: { from: 0.55, to: 1 },
      scale: { from: 0.92, to: 1.12 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
  }

  get id(): string {
    return this.def.id;
  }

  containsEgg(): boolean {
    return this.loot === SearchResult.DragonEgg;
  }

  promptLabel(): string {
    return KIND_LABEL[this.def.kind] ?? 'Search';
  }

  distanceToSq(x: number, y: number): number {
    const dx = x - this.x;
    const dy = y - this.y;
    return dx * dx + dy * dy;
  }

  /** Mark the location searched and visibly deplete it. */
  markOpened(): void {
    if (this.opened) return;
    this.opened = true;
    this.claimedBy = null;
    this.glowTween?.stop();
    this.glow.setVisible(false);
    this.disableInteractive();
    this.setAlpha(0.62);
    this.drawOpened();
  }

  private drawArt(kind: SearchLocationDef['kind']): void {
    const g = this.art;
    g.clear();
    switch (kind) {
      case SearchLocationKind.Chest:
        this.drawChest(g);
        break;
      case SearchLocationKind.Shrine:
        this.drawShrine(g);
        break;
      case SearchLocationKind.Cave:
        this.drawCave(g);
        break;
      case SearchLocationKind.Hut:
        this.drawHut(g);
        break;
      case SearchLocationKind.Altar:
        this.drawAltar(g);
        break;
      case SearchLocationKind.Ruin:
      default:
        this.drawRuin(g);
        break;
    }
  }

  private shadow(g: Phaser.GameObjects.Graphics, w: number): void {
    g.fillStyle(0x0c1a12, 0.28);
    g.fillEllipse(0, 18, w, w * 0.4);
  }

  private drawChest(g: Phaser.GameObjects.Graphics): void {
    this.shadow(g, 50);
    g.fillStyle(COLORS.chest, 1);
    g.fillRoundedRect(-22, -8, 44, 26, 4);
    g.fillStyle(COLORS.chestLid, 1);
    g.fillRoundedRect(-22, -20, 44, 16, { tl: 8, tr: 8, bl: 0, br: 0 });
    g.fillStyle(COLORS.gateBeam, 1);
    g.fillRect(-4, -10, 8, 12);
    g.lineStyle(2, 0x3a2a18, 0.8);
    g.strokeRoundedRect(-22, -20, 44, 38, 4);
  }

  private drawShrine(g: Phaser.GameObjects.Graphics): void {
    this.shadow(g, 46);
    g.fillStyle(COLORS.shrine, 1);
    g.fillRoundedRect(-16, -6, 32, 22, 3);
    g.fillStyle(COLORS.shrine, 1);
    g.fillTriangle(-20, -6, 20, -6, 0, -34);
    g.fillStyle(COLORS.shrineGlow, 0.9);
    g.fillCircle(0, -18, 6);
  }

  private drawCave(g: Phaser.GameObjects.Graphics): void {
    this.shadow(g, 54);
    g.fillStyle(COLORS.rockDark, 1);
    g.fillEllipse(0, -2, 56, 42);
    g.fillStyle(0x0a0f14, 1);
    g.fillEllipse(0, 4, 30, 26);
    g.fillStyle(COLORS.rock, 1);
    g.fillEllipse(-16, -14, 18, 12);
  }

  private drawHut(g: Phaser.GameObjects.Graphics): void {
    this.shadow(g, 50);
    g.fillStyle(COLORS.hutWall, 1);
    g.fillRoundedRect(-20, -6, 40, 24, 3);
    g.fillStyle(COLORS.hutRoof, 1);
    g.fillTriangle(-26, -6, 26, -6, 0, -30);
    g.fillStyle(0x4a2f1c, 1);
    g.fillRoundedRect(-6, 2, 12, 16, 2);
  }

  private drawAltar(g: Phaser.GameObjects.Graphics): void {
    this.shadow(g, 52);
    g.fillStyle(COLORS.ruinDark, 1);
    g.fillRoundedRect(-22, 2, 44, 14, 3);
    g.fillStyle(COLORS.ruin, 1);
    g.fillRoundedRect(-16, -10, 32, 14, 2);
    g.fillStyle(COLORS.portalA, 0.85);
    g.fillCircle(0, -16, 7);
    g.lineStyle(2, COLORS.shrineGlow, 0.7);
    g.strokeCircle(0, -16, 11);
  }

  private drawRuin(g: Phaser.GameObjects.Graphics): void {
    this.shadow(g, 48);
    g.fillStyle(COLORS.ruin, 1);
    g.fillRoundedRect(-20, -18, 14, 36, 2);
    g.fillRoundedRect(6, -10, 14, 28, 2);
    g.fillStyle(COLORS.ruinDark, 1);
    g.fillRoundedRect(-22, 14, 44, 8, 2);
  }

  private drawOpened(): void {
    // A faint scuffed "X" so depleted spots read clearly even when re-approached.
    const g = this.art;
    g.lineStyle(3, 0x20140c, 0.6);
    g.beginPath();
    g.moveTo(-10, -6);
    g.lineTo(10, 12);
    g.moveTo(10, -6);
    g.lineTo(-10, 12);
    g.strokePath();
  }
}
