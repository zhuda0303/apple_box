export class Sfx {
  constructor() {
    this.muted = false;
    this.ctx = null;
    this._unlockBound = this._unlock.bind(this);
    window.addEventListener("pointerdown", this._unlockBound, { once: true });
  }

  setMuted(m) {
    this.muted = Boolean(m);
  }

  isMuted() {
    return this.muted;
  }

  _unlock() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      this.ctx = null;
    }
  }

  _beep({ type = "sine", freq = 440, dur = 0.08, gain = 0.045 }) {
    if (this.muted) return;
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  ok() {
    this._beep({ type: "triangle", freq: 740, dur: 0.07, gain: 0.05 });
    this._beep({ type: "triangle", freq: 980, dur: 0.06, gain: 0.035 });
  }

  deny() {
    this._beep({ type: "square", freq: 180, dur: 0.06, gain: 0.03 });
  }
}

