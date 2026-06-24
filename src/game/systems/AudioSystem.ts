import { eventBus } from '../types/Events';
import { GamePhase } from '../types/GameTypes';
import type { SoundId } from '../types/Events';

type Osc = OscillatorType;

/**
 * Fully synthesised audio — no asset files required. Sound effects are short
 * envelopes over oscillators/noise; a minimal ambient bed shifts mood between
 * exploration and the escape chase. Lives for the whole app (created once in
 * main.ts) so it survives match restarts and keeps a single set of listeners.
 */
export class AudioSystem {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private musicNodes: AudioNode[] = [];
  private muted = false;

  constructor() {
    eventBus.on('audio:play', ({ sound }) => this.play(sound));
    eventBus.on('ui:toggle-mute', ({ muted }) => this.setMuted(muted));
    eventBus.on('game:phase-changed', ({ phase }) => this.handlePhase(phase));

    // Resume the context on the first user gesture (autoplay policy).
    const resume = () => this.ensureContext();
    window.addEventListener('pointerdown', resume, { once: true });
    window.addEventListener('keydown', resume, { once: true });
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.05);
    }
  }

  private ensureContext(): AudioContext | null {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return this.ctx;
    }
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;

    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(this.ctx.destination);

    // Pre-build a reusable white-noise buffer.
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.5, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buffer;

    return this.ctx;
  }

  /* ---- SFX router ----------------------------------------------- */

  private play(sound: SoundId): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;

    switch (sound) {
      case 'button':
        this.tone(660, t, 0.07, 'sine', 0.18);
        break;
      case 'chest':
        this.tone(300, t, 0.09, 'square', 0.12);
        this.tone(460, t + 0.05, 0.12, 'triangle', 0.12);
        this.noise(t, 0.05, 0.12, 1800);
        break;
      case 'coin':
        this.tone(880, t, 0.08, 'sine', 0.16);
        this.tone(1320, t + 0.07, 0.12, 'sine', 0.16);
        break;
      case 'trap':
        this.slide(220, 60, t, 0.3, 'sawtooth', 0.2);
        this.noise(t, 0.18, 0.2, 900);
        break;
      case 'stun':
        this.tone(120, t, 0.25, 'square', 0.18, 6, 26);
        break;
      case 'shield':
        this.slide(420, 820, t, 0.3, 'sine', 0.16);
        this.tone(1200, t + 0.12, 0.2, 'sine', 0.08);
        break;
      case 'boost':
        this.slide(320, 960, t, 0.22, 'triangle', 0.18);
        break;
      case 'hint':
        this.tone(740, t, 0.18, 'sine', 0.14);
        this.tone(988, t + 0.12, 0.26, 'sine', 0.12);
        break;
      case 'teleport':
        this.slide(900, 200, t, 0.18, 'sine', 0.16);
        this.slide(300, 1200, t + 0.16, 0.24, 'sine', 0.14);
        this.noise(t, 0.32, 0.1, 2400);
        break;
      case 'eggFound':
        this.arpeggio([523, 659, 784, 1047], t, 0.13, 'triangle', 0.22);
        this.noise(t, 0.4, 0.12, 3200);
        break;
      case 'eggDropped':
        this.slide(420, 90, t, 0.34, 'sawtooth', 0.22);
        this.noise(t, 0.2, 0.2, 700);
        break;
      case 'eggPickup':
        this.arpeggio([659, 880, 1175], t, 0.07, 'sine', 0.18);
        break;
      case 'extraction':
        this.arpeggio([523, 784, 1047, 1568], t, 0.12, 'triangle', 0.24);
        break;
      case 'portal':
        this.slide(600, 1400, t, 0.3, 'sine', 0.12);
        break;
      case 'countdown':
        this.tone(440, t, 0.12, 'square', 0.16);
        break;
      case 'go':
        this.tone(880, t, 0.22, 'square', 0.2);
        break;
      case 'victory':
        this.arpeggio([523, 659, 784, 1047, 1319], t, 0.14, 'triangle', 0.24);
        break;
      case 'defeat':
        this.arpeggio([440, 392, 330, 262], t, 0.18, 'sawtooth', 0.2);
        break;
      default:
        break;
    }
  }

  /* ---- ambient music bed ---------------------------------------- */

  private handlePhase(phase: GamePhase): void {
    if (phase === GamePhase.Exploration) this.startMusic(false);
    else if (phase === GamePhase.Escape) this.startMusic(true);
    else if (phase === GamePhase.Victory || phase === GamePhase.Defeat || phase === GamePhase.MainMenu)
      this.stopMusic();
  }

  private startMusic(tense: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.master) return;
    this.stopMusic();

    const bed = ctx.createGain();
    bed.gain.value = 0;
    bed.gain.setTargetAtTime(tense ? 0.07 : 0.05, ctx.currentTime, 0.8);
    bed.connect(this.master);

    const roots = tense ? [131, 139] : [110, 165];
    for (const freq of roots) {
      const osc = ctx.createOscillator();
      osc.type = tense ? 'sawtooth' : 'sine';
      osc.frequency.value = freq;
      osc.connect(bed);
      osc.start();
      this.musicNodes.push(osc);
    }

    if (tense) {
      // Tremolo to ratchet up tension during the chase.
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 5.5;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.04;
      lfo.connect(lfoGain);
      lfoGain.connect(bed.gain);
      lfo.start();
      this.musicNodes.push(lfo);
    }

    this.musicNodes.push(bed);
  }

  private stopMusic(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const node of this.musicNodes) {
      if (node instanceof OscillatorNode) {
        try {
          node.stop(now + 0.4);
        } catch {
          /* already stopped */
        }
      } else if (node instanceof GainNode) {
        node.gain.setTargetAtTime(0, now, 0.2);
      }
    }
    const stale = this.musicNodes;
    this.musicNodes = [];
    window.setTimeout(() => stale.forEach((n) => n.disconnect()), 800);
  }

  /* ---- low-level synth helpers ---------------------------------- */

  private tone(
    freq: number,
    start: number,
    dur: number,
    type: Osc,
    peak: number,
    vibratoHz = 0,
    vibratoDepth = 0,
  ): void {
    if (!this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peak, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain).connect(this.master);

    if (vibratoHz > 0) {
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.value = vibratoHz;
      lfoGain.gain.value = vibratoDepth;
      lfo.connect(lfoGain).connect(osc.frequency);
      lfo.start(start);
      lfo.stop(start + dur);
    }

    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  private slide(from: number, to: number, start: number, dur: number, type: Osc, peak: number): void {
    if (!this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + dur);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peak, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain).connect(this.master);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  private noise(start: number, dur: number, peak: number, filterFreq: number): void {
    if (!this.ctx || !this.master || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(peak, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(start);
    src.stop(start + dur + 0.02);
  }

  private arpeggio(freqs: number[], start: number, step: number, type: Osc, peak: number): void {
    freqs.forEach((freq, i) => this.tone(freq, start + i * step, step * 1.7, type, peak));
  }
}
