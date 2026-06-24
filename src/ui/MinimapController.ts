import { eventBus } from '../game/types/Events';
import type { MinimapSnapshot } from '../game/types/GameTypes';
import { byId } from './dom';

/**
 * Draws the radar minimap onto its own canvas from throttled `minimap:update`
 * snapshots — drawing to a canvas (rather than DOM nodes) keeps it cheap even at
 * ~11 updates/sec.
 */
export class MinimapController {
  private readonly canvas = byId<HTMLCanvasElement>('minimap');
  private readonly ctx: CanvasRenderingContext2D;

  constructor() {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Dragon Egg Run UI: minimap canvas 2D context unavailable');
    this.ctx = ctx;
    eventBus.on('minimap:update', (snapshot) => this.render(snapshot));
  }

  private render(snapshot: MinimapSnapshot): void {
    const { ctx } = this;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    ctx.clearRect(0, 0, cw, ch);

    const pad = 6;
    const scale = Math.min((cw - pad * 2) / snapshot.width, (ch - pad * 2) / snapshot.height);
    const offX = (cw - snapshot.width * scale) / 2;
    const offY = (ch - snapshot.height * scale) / 2;

    // Island backdrop.
    ctx.fillStyle = 'rgba(38, 74, 52, 0.85)';
    this.roundRect(offX, offY, snapshot.width * scale, snapshot.height * scale, 8);
    ctx.fill();

    for (const e of snapshot.entities) {
      const x = offX + e.x * scale;
      const y = offY + e.y * scale;
      const color = `#${e.color.toString(16).padStart(6, '0')}`;

      switch (e.kind) {
        case 'search':
          this.dot(x, y, 1.4, 'rgba(255, 230, 150, 0.55)');
          break;
        case 'gate':
          this.diamond(x, y, 4, color);
          break;
        case 'ai':
          this.dot(x, y, 2.6, color);
          break;
        case 'human':
          this.ringDot(x, y, 3.4, color, '#ffffff');
          break;
        case 'egg':
          this.ringDot(x, y, 3.2, color, '#fff6cf');
          break;
        case 'carrier':
          this.pulse(x, y, color);
          break;
        default:
          break;
      }
    }
  }

  private dot(x: number, y: number, r: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(x, y, r, 0, Math.PI * 2);
    this.ctx.fill();
  }

  private ringDot(x: number, y: number, r: number, color: string, ring: string): void {
    this.dot(x, y, r, color);
    this.ctx.strokeStyle = ring;
    this.ctx.lineWidth = 1.4;
    this.ctx.beginPath();
    this.ctx.arc(x, y, r + 1.6, 0, Math.PI * 2);
    this.ctx.stroke();
  }

  private pulse(x: number, y: number, color: string): void {
    const t = (Date.now() % 900) / 900;
    this.ctx.strokeStyle = color;
    this.ctx.globalAlpha = 1 - t;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(x, y, 3 + t * 7, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.globalAlpha = 1;
    this.dot(x, y, 3.4, color);
  }

  private diamond(x: number, y: number, r: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.moveTo(x, y - r);
    this.ctx.lineTo(x + r, y);
    this.ctx.lineTo(x, y + r);
    this.ctx.lineTo(x - r, y);
    this.ctx.closePath();
    this.ctx.fill();
  }

  private roundRect(x: number, y: number, w: number, h: number, r: number): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}
