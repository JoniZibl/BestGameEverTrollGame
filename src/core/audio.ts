import type { ThemeId } from './types';

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

interface EraMusic {
  bpm: number;
  wave: OscillatorType;
  bassWave: OscillatorType;
  /** MIDI notes, 0 = rest. */
  lead: number[];
  bass: number[];
  /** Lowpass cutoff — the cheap way to hear 40 years of audio hardware. */
  cutoff: number;
  decay: number;
  lead2?: number[];
  reverb?: number;
  gain?: number;
}

/**
 * 1962 is two sine blips; 2026 is a pad with reverb. Same engine, different settings —
 * which is roughly how the industry did it too.
 */
const MUSIC: Record<ThemeId, EraMusic> = {
  oscilloscope: {
    bpm: 80,
    wave: 'sine',
    bassWave: 'sine',
    lead: [57, 0, 0, 0, 64, 0, 0, 0],
    bass: [0, 0, 0, 0, 0, 0, 0, 0],
    cutoff: 1800,
    decay: 0.1,
    gain: 0.5,
  },
  arcade: {
    bpm: 132,
    wave: 'square',
    bassWave: 'square',
    lead: [69, 0, 72, 0, 76, 0, 72, 0, 69, 0, 67, 0, 69, 0, 0, 0],
    bass: [45, 45, 0, 45, 40, 0, 40, 0, 43, 43, 0, 43, 38, 0, 38, 0],
    cutoff: 3000,
    decay: 0.12,
  },
  bit8: {
    bpm: 150,
    wave: 'square',
    bassWave: 'triangle',
    lead: [72, 76, 79, 76, 74, 71, 74, 71, 69, 72, 76, 72, 71, 67, 62, 67],
    bass: [48, 0, 55, 0, 50, 0, 57, 0, 45, 0, 52, 0, 43, 0, 50, 0],
    lead2: [0, 0, 84, 0, 0, 0, 83, 0, 0, 0, 81, 0, 0, 0, 79, 0],
    cutoff: 5000,
    decay: 0.14,
  },
  bit16: {
    bpm: 164,
    wave: 'sawtooth',
    bassWave: 'square',
    lead: [69, 71, 72, 76, 74, 72, 71, 69, 67, 69, 71, 74, 72, 71, 69, 67],
    bass: [45, 45, 52, 45, 41, 41, 48, 41, 43, 43, 50, 43, 38, 38, 45, 38],
    lead2: [88, 0, 0, 0, 86, 0, 0, 0, 84, 0, 0, 0, 83, 0, 0, 0],
    cutoff: 7000,
    decay: 0.16,
  },
  early3d: {
    bpm: 108,
    wave: 'sawtooth',
    bassWave: 'triangle',
    lead: [64, 0, 0, 67, 0, 0, 71, 0, 72, 0, 0, 71, 0, 0, 67, 0],
    bass: [40, 0, 0, 0, 43, 0, 0, 0, 36, 0, 0, 0, 38, 0, 0, 0],
    cutoff: 2600,
    decay: 0.5,
    reverb: 0.25,
  },
  web2: {
    bpm: 124,
    wave: 'sawtooth',
    bassWave: 'sawtooth',
    lead: [76, 0, 74, 72, 0, 74, 0, 69, 72, 0, 71, 69, 0, 67, 0, 0],
    bass: [41, 41, 0, 41, 48, 0, 36, 0, 43, 43, 0, 43, 50, 0, 38, 0],
    cutoff: 4200,
    decay: 0.2,
    reverb: 0.15,
  },
  flat: {
    bpm: 118,
    wave: 'triangle',
    bassWave: 'sine',
    lead: [79, 0, 76, 0, 72, 0, 76, 0, 77, 0, 74, 0, 71, 0, 74, 0],
    bass: [48, 0, 0, 55, 0, 0, 53, 0, 45, 0, 0, 52, 0, 0, 50, 0],
    cutoff: 6000,
    decay: 0.35,
    reverb: 0.2,
  },
  modern: {
    bpm: 96,
    wave: 'sine',
    bassWave: 'sine',
    lead: [72, 0, 0, 0, 76, 0, 0, 0, 79, 0, 0, 0, 74, 0, 0, 0],
    bass: [36, 0, 0, 0, 36, 0, 0, 0, 33, 0, 0, 0, 35, 0, 0, 0],
    lead2: [0, 0, 84, 0, 0, 0, 88, 0, 0, 0, 91, 0, 0, 0, 86, 0],
    cutoff: 9000,
    decay: 0.9,
    reverb: 0.45,
    gain: 0.8,
  },
};

export type MuteListener = (muted: boolean) => void;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private verb: ConvolverNode | null = null;
  private verbGain: GainNode | null = null;
  private timer: number | null = null;
  private step = 0;
  private nextTime = 0;
  private era: ThemeId = 'oscilloscope';
  private playing = false;
  private listeners: MuteListener[] = [];
  muted = false;

  /** Must run inside a user gesture. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return;
    const ctx: AudioContext = new Ctor();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(ctx.destination);

    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = 0.32;
    this.musicGain.connect(this.master);

    this.sfxGain = ctx.createGain();
    this.sfxGain.gain.value = 0.9;
    this.sfxGain.connect(this.master);

    this.verb = ctx.createConvolver();
    this.verb.buffer = makeImpulse(ctx, 1.8);
    this.verbGain = ctx.createGain();
    this.verbGain.gain.value = 0;
    this.verb.connect(this.verbGain);
    this.verbGain.connect(this.master);
  }

  onMuteChange(fn: MuteListener) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.02);
    }
    this.listeners.forEach((l) => l(m));
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /** Cross-fades into the given era's soundtrack. */
  setEra(era: ThemeId) {
    if (this.era === era && this.playing) return;
    this.era = era;
    this.step = 0;
    const cfg = MUSIC[era];
    if (this.verbGain && this.ctx) {
      this.verbGain.gain.setTargetAtTime(cfg.reverb ?? 0, this.ctx.currentTime, 0.4);
    }
    if (this.playing) return;
    this.startMusic();
  }

  startMusic() {
    this.unlock();
    if (!this.ctx || this.playing) return;
    this.playing = true;
    this.nextTime = this.ctx.currentTime + 0.08;
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  stopMusic() {
    this.playing = false;
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx) return;
    const cfg = MUSIC[this.era];
    const stepDur = 60 / cfg.bpm / 2;
    while (this.nextTime < ctx.currentTime + 0.15) {
      const i = this.step % cfg.lead.length;
      const lead = cfg.lead[i];
      if (lead) this.voice(lead, this.nextTime, cfg, cfg.wave, 0.22);
      const bass = cfg.bass[i % cfg.bass.length];
      if (bass) this.voice(bass, this.nextTime, cfg, cfg.bassWave, 0.3);
      const l2 = cfg.lead2?.[i % (cfg.lead2?.length ?? 1)];
      if (l2) this.voice(l2, this.nextTime, cfg, cfg.wave, 0.1);
      this.nextTime += stepDur;
      this.step++;
    }
  }

  private voice(note: number, at: number, cfg: EraMusic, wave: OscillatorType, vol: number) {
    const ctx = this.ctx;
    if (!ctx || !this.musicGain) return;
    const osc = ctx.createOscillator();
    osc.type = wave;
    osc.frequency.value = midi(note);
    const g = ctx.createGain();
    const peak = vol * (cfg.gain ?? 1);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, at + cfg.decay);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cfg.cutoff;
    osc.connect(g);
    g.connect(filter);
    filter.connect(this.musicGain);
    if (this.verb && cfg.reverb) filter.connect(this.verb);
    osc.start(at);
    osc.stop(at + cfg.decay + 0.05);
  }

  /** One-shot tone. Everything from a 1972 paddle tick to a 2026 UI chime. */
  blip(freq: number, dur = 0.08, wave: OscillatorType = 'square', vol = 0.3, slideTo?: number) {
    const ctx = this.ctx;
    if (!ctx || !this.sfxGain) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = wave;
    osc.frequency.setValueAtTime(Math.max(20, freq), t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  noise(dur = 0.2, vol = 0.25, cutoff = 1200) {
    const ctx = this.ctx;
    if (!ctx || !this.sfxGain) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxGain);
    src.start();
  }

  /** Little melodic stingers reused across eras. */
  jingle(notes: number[], gap = 0.09, wave: OscillatorType = 'square') {
    notes.forEach((n, i) => {
      window.setTimeout(() => this.blip(midi(n), gap * 1.6, wave, 0.26), i * gap * 1000);
    });
  }

  fanfare() {
    this.jingle([72, 76, 79, 84], 0.1);
  }
  thud() {
    this.noise(0.35, 0.3, 500);
    this.blip(90, 0.3, 'triangle', 0.3, 40);
  }
}

function makeImpulse(ctx: AudioContext, seconds: number) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
  }
  return buf;
}

export const audio = new AudioEngine();
