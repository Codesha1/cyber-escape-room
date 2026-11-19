'use client';
// محرك صوت مولّد بالكامل بالكود (Web Audio API) — لا توجد أي ملفات صوتية خارجية.

type MusicName = 'mystery' | 'lab' | 'final' | 'victory' | 'ceremony';
export type SfxName =
  | 'click' | 'boot' | 'gate' | 'question' | 'success' | 'wrong' | 'transition'
  | 'alarm' | 'type' | 'unlock' | 'fanfare' | 'drumroll' | 'reveal' | 'glitch';

const NOTE = (n: number) => 440 * Math.pow(2, (n - 69) / 12); // MIDI → Hz

class SoundEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  musicBus!: GainNode;
  sfxBus!: GainNode;
  volume = 0.7;
  muted = false;
  private musicName: MusicName | null = null;
  private musicStop: (() => void) | null = null;
  private sources = new Set<AudioScheduledSourceNode>();
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private noiseBuf: AudioBuffer | null = null;
  private listeners = new Set<() => void>();

  constructor() {
    try {
      const v = localStorage.getItem('cer_volume');
      const m = localStorage.getItem('cer_muted');
      if (v !== null) this.volume = Math.min(1, Math.max(0, Number(v)));
      if (m !== null) this.muted = m === '1';
    } catch {}
  }

  subscribe(fn: () => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  private emit() { this.listeners.forEach((f) => f()); }

  /** يجب استدعاؤها من نقرة المستخدم الأولى (سياسة المتصفحات) */
  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || (window as any).webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        const c = this.ctx!;
        const comp = c.createDynamicsCompressor();
        comp.threshold.value = -18; comp.ratio.value = 4;
        this.master = c.createGain();
        this.master.gain.value = this.effectiveVolume();
        this.musicBus = c.createGain(); this.musicBus.gain.value = 0.55;
        this.sfxBus = c.createGain(); this.sfxBus.gain.value = 0.9;
        this.musicBus.connect(this.master); this.sfxBus.connect(this.master);
        this.master.connect(comp); comp.connect(c.destination);
        const len = c.sampleRate * 1.5;
        this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    } catch {}
  }
  get ready() { return !!this.ctx; }

  private effectiveVolume() { return this.muted ? 0 : this.volume * 0.85; }
  private applyVolume() {
    if (this.ctx) this.master.gain.setTargetAtTime(this.effectiveVolume(), this.ctx.currentTime, 0.05);
    try { localStorage.setItem('cer_volume', String(this.volume)); localStorage.setItem('cer_muted', this.muted ? '1' : '0'); } catch {}
    this.emit();
  }
  setVolume(v: number) { this.volume = Math.min(1, Math.max(0, v)); if (this.volume > 0) this.muted = false; this.applyVolume(); }
  toggleMute() { this.muted = !this.muted; this.applyVolume(); }

  // ---------- أدوات بناء الأصوات ----------
  private track<T extends AudioScheduledSourceNode>(n: T) {
    this.sources.add(n);
    n.onended = () => this.sources.delete(n);
    return n;
  }
  private tone(freq: number, dur: number, o: {
    type?: OscillatorType; vol?: number; at?: number; attack?: number; slideTo?: number; bus?: AudioNode; detune?: number; filter?: number;
  } = {}) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + (o.at ?? 0);
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (o.detune) osc.detune.value = o.detune;
    if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, t + dur);
    const vol = o.vol ?? 0.2; const a = o.attack ?? 0.008;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node: AudioNode = g;
    if (o.filter) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.filter; g.connect(f); node = f; }
    osc.connect(g); node.connect(o.bus ?? this.sfxBus);
    osc.start(t); osc.stop(t + dur + 0.05);
    this.track(osc);
  }
  private noise(dur: number, o: { vol?: number; at?: number; type?: BiquadFilterType; freq?: number; slideTo?: number; q?: number; bus?: AudioNode; attack?: number } = {}) {
    const c = this.ctx; if (!c || !this.noiseBuf) return;
    const t = c.currentTime + (o.at ?? 0);
    const src = c.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const f = c.createBiquadFilter(); f.type = o.type ?? 'bandpass'; f.frequency.setValueAtTime(o.freq ?? 1200, t); f.Q.value = o.q ?? 1;
    if (o.slideTo) f.frequency.exponentialRampToValueAtTime(o.slideTo, t + dur);
    const g = c.createGain(); const vol = o.vol ?? 0.15;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + (o.attack ?? 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(o.bus ?? this.sfxBus);
    src.start(t); src.stop(t + dur + 0.05);
    this.track(src);
  }
  private later(ms: number, fn: () => void) {
    const id = setTimeout(() => { this.timers.delete(id); fn(); }, ms);
    this.timers.add(id);
  }

  /** إيقاف كل المؤثرات الجارية (عند الانتقال بين المشاهد) */
  stopSfx() {
    this.timers.forEach((t) => clearTimeout(t)); this.timers.clear();
    this.sources.forEach((s) => { try { s.stop(); } catch {} }); this.sources.clear();
  }

  sfx(name: SfxName) {
    if (!this.ctx) return;
    switch (name) {
      case 'click': this.tone(1400, 0.05, { type: 'sine', vol: 0.08 }); break;
      case 'type': this.tone(2200 + Math.random() * 400, 0.025, { type: 'square', vol: 0.018, filter: 3000 }); break;
      case 'question':
        this.tone(880, 0.09, { type: 'triangle', vol: 0.12 });
        this.tone(1320, 0.14, { type: 'triangle', vol: 0.1, at: 0.08 });
        break;
      case 'boot':
        this.tone(110, 1.1, { type: 'sawtooth', vol: 0.08, slideTo: 880, filter: 1800 });
        this.noise(0.6, { vol: 0.06, freq: 300, slideTo: 4000 });
        [69, 72, 76, 81, 84].forEach((n, i) => this.tone(NOTE(n), 0.18, { type: 'square', vol: 0.05, at: 0.6 + i * 0.08, filter: 2600 }));
        this.tone(NOTE(93), 0.6, { type: 'sine', vol: 0.08, at: 1.05 });
        break;
      case 'gate':
        this.tone(90, 0.6, { type: 'sine', vol: 0.25, slideTo: 38 });
        this.noise(1.4, { vol: 0.12, freq: 300, slideTo: 2600, q: 0.8, attack: 0.25 });
        [0.15, 0.35, 0.55, 0.75].forEach((a) => this.noise(0.04, { vol: 0.08, type: 'highpass', freq: 3000, at: a }));
        this.tone(NOTE(76), 0.5, { type: 'sine', vol: 0.06, at: 1.0 });
        this.tone(NOTE(83), 0.7, { type: 'sine', vol: 0.06, at: 1.12 });
        break;
      case 'success':
        [84, 88, 91].forEach((n, i) => this.tone(NOTE(n), 0.35, { type: 'triangle', vol: 0.12, at: i * 0.09 }));
        this.tone(NOTE(96), 0.6, { type: 'sine', vol: 0.09, at: 0.27 });
        this.noise(0.05, { vol: 0.12, type: 'highpass', freq: 2500, at: 0.02 });
        this.noise(0.06, { vol: 0.1, type: 'highpass', freq: 1800, at: 0.14 });
        break;
      case 'wrong':
        this.tone(330, 0.16, { type: 'triangle', vol: 0.09 });
        this.tone(262, 0.24, { type: 'triangle', vol: 0.08, at: 0.15 });
        break;
      case 'transition':
        this.noise(0.9, { vol: 0.08, freq: 3000, slideTo: 200, q: 2 });
        this.tone(1200, 0.8, { type: 'sine', vol: 0.06, slideTo: 150 });
        break;
      case 'glitch':
        for (let i = 0; i < 6; i++) this.noise(0.05, { vol: 0.06, freq: 500 + Math.random() * 3000, q: 4, at: i * 0.06 + Math.random() * 0.03 });
        break;
      case 'alarm':
        for (let i = 0; i < 3; i++) {
          this.tone(520, 0.32, { type: 'triangle', vol: 0.07, at: i * 0.7, slideTo: 700 });
          this.tone(700, 0.32, { type: 'triangle', vol: 0.06, at: i * 0.7 + 0.35, slideTo: 520 });
        }
        this.tone(55, 2.0, { type: 'sawtooth', vol: 0.05, filter: 300 });
        break;
      case 'unlock':
        for (let i = 0; i < 8; i++) {
          this.noise(0.035, { vol: 0.09, type: 'highpass', freq: 2500 + i * 200, at: i * 0.12 });
          this.tone(NOTE(60 + i * 3), 0.12, { type: 'square', vol: 0.035, at: i * 0.12, filter: 2400 });
        }
        this.tone(200, 1.2, { type: 'sawtooth', vol: 0.06, slideTo: 1600, filter: 2000, at: 0.9 });
        break;
      case 'fanfare': {
        const chords = [[60, 64, 67], [67, 71, 74], [72, 76, 79, 84]];
        chords.forEach((ch, i) => ch.forEach((n) => this.tone(NOTE(n), i === 2 ? 1.4 : 0.34, { type: 'sawtooth', vol: 0.045, at: i * 0.32, filter: 2200, attack: 0.03 })));
        this.noise(1.2, { vol: 0.05, type: 'highpass', freq: 6000, at: 0.64, attack: 0.02 });
        break;
      }
      case 'drumroll':
        for (let i = 0; i < 28; i++) this.noise(0.06, { vol: 0.03 + i * 0.0025, freq: 900, q: 0.7, at: i * 0.07 });
        break;
      case 'reveal':
        this.noise(1.4, { vol: 0.1, type: 'highpass', freq: 5000, attack: 0.01 });
        this.tone(55, 0.5, { type: 'sine', vol: 0.3, slideTo: 40 });
        [72, 76, 79, 84].forEach((n) => this.tone(NOTE(n), 1.2, { type: 'triangle', vol: 0.06, attack: 0.02 }));
        break;
    }
  }

  // ---------- الموسيقى (حلقات مولّدة) ----------
  music(name: MusicName | null) {
    if (name === this.musicName) return;
    this.stopMusic();
    this.musicName = name;
    if (!name || !this.ctx) return;
    const c = this.ctx;
    const bus = c.createGain(); bus.gain.value = 0.0001; bus.connect(this.musicBus);
    bus.gain.exponentialRampToValueAtTime(1, c.currentTime + 1.2);
    const nodes: AudioScheduledSourceNode[] = [];

    const drone = (freq: number, type: OscillatorType, vol: number, cutoff: number) => {
      const o = c.createOscillator(); o.type = type; o.frequency.value = freq;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff;
      const lfo = c.createOscillator(); lfo.frequency.value = 0.07 + Math.random() * 0.05;
      const lg = c.createGain(); lg.gain.value = cutoff * 0.5; lfo.connect(lg); lg.connect(f.frequency);
      const g = c.createGain(); g.gain.value = vol;
      o.connect(f); f.connect(g); g.connect(bus); o.start(); lfo.start(); nodes.push(o, lfo);
    };
    const note = (n: number, t: number, dur: number, type: OscillatorType, vol: number, cutoff = 2400) => {
      const o = c.createOscillator(); o.type = type; o.frequency.value = NOTE(n);
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(f); f.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.05);
    };
    const hat = (t: number, vol: number) => {
      if (!this.noiseBuf) return;
      const s = c.createBufferSource(); s.buffer = this.noiseBuf;
      const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
      const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      s.connect(f); f.connect(g); g.connect(bus); s.start(t, Math.random()); s.stop(t + 0.06);
    };
    const kick = (t: number, vol: number) => {
      const o = c.createOscillator(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
      const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.3);
    };

    let bpm = 90;
    let stepFn: (i: number, t: number, s16: number) => void = () => {};
    if (name === 'mystery') {
      bpm = 66;
      drone(NOTE(33), 'sawtooth', 0.05, 380); drone(NOTE(40), 'sawtooth', 0.035, 500); drone(NOTE(57), 'sine', 0.025, 900);
      const bells = [69, 72, 74, 76, 79, 81, 84];
      stepFn = (i, t, s) => {
        if (i % 8 === 0 && Math.random() < 0.7) note(bells[Math.floor(Math.random() * bells.length)], t, s * 10, 'sine', 0.05, 5000);
        if (i % 16 === 12 && Math.random() < 0.5) note(bells[Math.floor(Math.random() * 4)] + 12, t, s * 6, 'triangle', 0.025, 6000);
      };
    } else if (name === 'lab') {
      bpm = 100;
      drone(NOTE(45), 'sawtooth', 0.03, 420);
      const arp = [57, 60, 64, 67, 64, 60, 57, 55];
      const bass = [45, 45, 41, 43];
      stepFn = (i, t, s) => {
        note(arp[i % 8] + (Math.floor(i / 32) % 2 ? 12 : 0), t, s * 0.9, 'square', 0.022, 1600);
        if (i % 8 === 0) note(bass[Math.floor(i / 16) % 4] - 12, t, s * 7, 'triangle', 0.09, 600);
        if (i % 4 === 2) hat(t, 0.025);
      };
    } else if (name === 'final') {
      bpm = 116;
      drone(NOTE(38), 'sawtooth', 0.04, 500); drone(NOTE(50), 'sawtooth', 0.02, 800);
      const arp = [62, 65, 69, 72, 74, 72, 69, 65];
      const bass = [38, 38, 34, 36];
      stepFn = (i, t, s) => {
        note(arp[(i * 3) % 8] + 12, t, s * 0.8, 'square', 0.02, 2200);
        if (i % 2 === 0) note(bass[Math.floor(i / 16) % 4], t, s * 1.6, 'sawtooth', 0.05, 520);
        if (i % 8 === 0) kick(t, 0.22);
        if (i % 4 === 2) hat(t, 0.03);
      };
    } else if (name === 'victory' || name === 'ceremony') {
      bpm = name === 'victory' ? 124 : 112;
      // تأليف أصلي بسيط: I – V – vi – IV في دو الكبير
      const chords = [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]];
      const melody = [76, 79, 81, 79, 76, 74, 72, 74, 74, 76, 79, 76, 74, 72, 71, 74, 72, 76, 79, 84, 81, 79, 76, 79, 77, 76, 74, 72, 74, 76, 72, -1];
      stepFn = (i, t, s) => {
        const bar = Math.floor(i / 16) % 4; const ch = chords[bar];
        if (i % 16 === 0) ch.forEach((n) => note(n, t, s * 15, 'triangle', 0.035, 1800));
        note(ch[(i % 4 === 0 ? 0 : i % 4 === 2 ? 2 : 1)] + 12, t, s * 0.7, 'square', 0.014, 2400);
        if (i % 2 === 0) { const m = melody[(i / 2) % 32]; if (m > 0) note(m, t, s * 1.8, 'sine', 0.07, 6000); }
        if (i % 8 === 0) note(ch[0] - 24, t, s * 6, 'triangle', 0.1, 500);
        if (i % 4 === 0) kick(t, 0.2);
        if (i % 2 === 1) hat(t, 0.025);
      };
    }

    const s16 = 60 / bpm / 4;
    let i = 0;
    let next = c.currentTime + 0.1;
    const timer = setInterval(() => {
      while (next < c.currentTime + 0.25) { stepFn(i, next, s16); i++; next += s16; }
    }, 60);
    this.musicStop = () => {
      clearInterval(timer);
      const t = c.currentTime;
      bus.gain.cancelScheduledValues(t); bus.gain.setValueAtTime(bus.gain.value, t); bus.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      setTimeout(() => { nodes.forEach((n) => { try { n.stop(); } catch {} }); bus.disconnect(); }, 700);
    };
  }
  stopMusic() { if (this.musicStop) this.musicStop(); this.musicStop = null; this.musicName = null; }
}

let engine: SoundEngine | null = null;
export function sound(): SoundEngine {
  if (!engine) engine = new SoundEngine();
  return engine;
}
