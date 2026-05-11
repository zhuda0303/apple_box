import { loadImage } from "./assets.js";
import { clamp, easeOutCubic, randInt } from "./math.js";
import { Particles } from "./Particles.js";
import { Sfx } from "./Sfx.js";

/**
 * @typedef {{sum:number,score:number,level:number,nextAt:number}} HudState
 */

export class Game {
  /**
   * @param {{canvas:HTMLCanvasElement,onHud?:(s:HudState)=>void}} opts
   */
  constructor(opts) {
    this.canvas = opts.canvas;
    this.ctx = /** @type {CanvasRenderingContext2D} */ (this.canvas.getContext("2d"));
    if (!this.ctx) throw new Error("2D context not available");

    this.onHud = opts.onHud ?? (() => {});

    this.worldW = 720;
    this.worldH = 960;

    this.dpr = 1;
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;

    this.state = /** @type {"loading"|"playing"|"paused"} */ ("loading");
    this.running = false;
    this.lastTs = 0;

    this.appleImg = null;
    this.particles = new Particles();
    this.sfx = new Sfx();

    this.score = 0;
    this.level = 1;
    this.nextAt = 120;

    /** @type {Array<{id:number,x:number,y:number,r:number,value:number,selected:boolean,state:"alive"|"vanishing",t:number,shake:number}>} */
    this.apples = [];
    this.nextId = 1;

    this.selectionSum = 0;

    this._bindEvents();
  }

  async start() {
    this.running = true;
    this._resize();
    window.addEventListener("resize", this._resize);

    this.appleImg = await loadImage("./assets/apple.png");
    this._initLevel();
    this.state = "playing";
    this._emitHud();
    requestAnimationFrame(this._frame);
  }

  restart() {
    this.score = 0;
    this.level = 1;
    this.nextAt = 120;
    this.selectionSum = 0;
    this.apples = [];
    this.nextId = 1;
    this.particles.items = [];
    this._initLevel();
    this._emitHud();
  }

  isPaused() {
    return this.state === "paused";
  }

  setPaused(paused) {
    if (this.state === "loading") return;
    this.state = paused ? "paused" : "playing";
  }

  togglePause() {
    this.setPaused(this.state !== "paused");
  }

  _bindEvents() {
    this._resize = this._resize.bind(this);
    this._frame = this._frame.bind(this);

    this.canvas.addEventListener("pointerdown", (e) => {
      if (this.state !== "playing") return;
      this.canvas.setPointerCapture(e.pointerId);
      const p = this._toWorld(e.clientX, e.clientY);
      this._handleClick(p.x, p.y);
    });
  }

  _emitHud() {
    this.onHud({ sum: this.selectionSum, score: this.score, level: this.level, nextAt: this.nextAt });
  }

  isMuted() {
    return this.sfx.isMuted();
  }

  setMuted(muted) {
    this.sfx.setMuted(muted);
  }

  _spawnValue() {
    // 레벨이 오를수록 6~9 비중이 조금씩 늘어 '체감 난이도'가 상승
    const t = clamp((this.level - 1) / 8, 0, 1);
    const r = Math.random();
    if (r < 0.18 - 0.06 * t) return randInt(1, 3);
    if (r < 0.62 - 0.12 * t) return randInt(4, 6);
    return randInt(7, 9);
  }

  _initLevel() {
    const cols = 4;
    const rows = 5;
    const padX = 70;
    const padY = 130;
    const gapX = (this.worldW - padX * 2) / (cols - 1);
    const gapY = (this.worldH - padY * 2) / (rows - 1);
    const r = 64;

    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        this.apples.push({
          id: this.nextId++,
          x: padX + x * gapX,
          y: padY + y * gapY,
          r,
          value: this._spawnValue(),
          selected: false,
          state: "alive",
          t: 0,
          shake: 0,
        });
      }
    }
  }

  _handleClick(wx, wy) {
    const hit = this._hitApple(wx, wy);
    if (!hit) return;

    if (hit.state !== "alive") return;

    if (hit.selected) {
      hit.selected = false;
      this.selectionSum -= hit.value;
      this.selectionSum = Math.max(0, this.selectionSum);
      this._emitHud();
      return;
    }

    const nextSum = this.selectionSum + hit.value;
    if (nextSum > 10) {
      hit.shake = 0.12;
      this.sfx.deny();
      return;
    }

    hit.selected = true;
    this.selectionSum = nextSum;
    this._emitHud();

    if (this.selectionSum === 10) {
      this._resolveTen();
    }
  }

  _resolveTen() {
    const selected = this.apples.filter((a) => a.selected && a.state === "alive");
    if (selected.length === 0) return;

    for (const a of selected) {
      a.state = "vanishing";
      a.t = 0;
      a.selected = false;
      this.particles.pop({ x: a.x, y: a.y, baseHue: 8 });
    }

    this.selectionSum = 0;
    this.score += 10 * selected.length;

    const nextLevel = 1 + Math.floor(this.score / 120);
    if (nextLevel !== this.level) this.level = nextLevel;
    this.nextAt = 120 * this.level - this.score > 0 ? 120 * this.level - this.score : 0;
    this.sfx.ok();

    this._emitHud();
  }

  _hitApple(wx, wy) {
    for (let i = this.apples.length - 1; i >= 0; i -= 1) {
      const a = this.apples[i];
      const dx = wx - a.x;
      const dy = wy - a.y;
      if (dx * dx + dy * dy <= a.r * a.r) return a;
    }
    return null;
  }

  _resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    this.canvas.width = Math.max(1, Math.floor(rect.width * this.dpr));
    this.canvas.height = Math.max(1, Math.floor(rect.height * this.dpr));

    const sx = this.canvas.width / this.worldW;
    const sy = this.canvas.height / this.worldH;
    this.scale = Math.min(sx, sy);
    this.offsetX = (this.canvas.width - this.worldW * this.scale) / 2;
    this.offsetY = (this.canvas.height - this.worldH * this.scale) / 2;
  }

  _toWorld(cx, cy) {
    const r = this.canvas.getBoundingClientRect();
    const px = (cx - r.left) * this.dpr;
    const py = (cy - r.top) * this.dpr;
    const x = (px - this.offsetX) / this.scale;
    const y = (py - this.offsetY) / this.scale;
    return { x, y };
  }

  _frame(ts) {
    if (!this.running) return;
    const dt = this.lastTs ? Math.min(0.033, (ts - this.lastTs) / 1000) : 0;
    this.lastTs = ts;

    if (this.state === "playing") {
      this._update(dt);
    }
    this._render();

    requestAnimationFrame(this._frame);
  }

  _update(dt) {
    this.particles.update(dt);

    for (const a of this.apples) {
      if (a.shake > 0) a.shake = Math.max(0, a.shake - dt);

      if (a.state === "vanishing") {
        a.t += dt;
        if (a.t >= 0.22) {
          // respawn at same slot
          a.state = "alive";
          a.t = 0;
          a.value = this._spawnValue();
          a.selected = false;
        }
      }
    }
  }

  _render() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // stage background
    ctx.fillStyle = "rgba(255,255,255,0.02)";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.setTransform(this.scale, 0, 0, this.scale, this.offsetX, this.offsetY);

    // subtle grid
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1 / this.scale;
    for (let y = 120; y < this.worldH; y += 120) {
      ctx.beginPath();
      ctx.moveTo(40, y);
      ctx.lineTo(this.worldW - 40, y);
      ctx.stroke();
    }
    ctx.restore();

    // apples
    for (const a of this.apples) {
      this._drawApple(ctx, a);
    }

    // particles over
    this.particles.render(ctx);
  }

  _drawApple(ctx, a) {
    const img = this.appleImg;
    const vanishT = a.state === "vanishing" ? clamp(a.t / 0.22, 0, 1) : 0;
    const k = vanishT ? easeOutCubic(vanishT) : 0;
    const alpha = a.state === "vanishing" ? 1 - k : 1;
    if (alpha <= 0.001) return;

    const shake = a.shake > 0 ? Math.sin((1 - a.shake / 0.12) * Math.PI * 10) * (5 * (a.shake / 0.12)) : 0;

    ctx.save();
    ctx.translate(a.x + shake, a.y);
    ctx.globalAlpha = alpha;

    const baseScale = a.state === "vanishing" ? 1 - 0.22 * k : 1;
    ctx.scale(baseScale, baseScale);

    // shadow
    ctx.save();
    ctx.globalAlpha *= 0.28;
    ctx.fillStyle = "rgba(0,0,0,0.8)";
    ctx.beginPath();
    ctx.ellipse(0, a.r * 0.72, a.r * 0.62, a.r * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // sprite
    if (img) {
      const s = a.r * 2.15;
      ctx.drawImage(img, -s / 2, -s / 2, s, s);
    } else {
      ctx.fillStyle = "#ff3b30";
      ctx.beginPath();
      ctx.arc(0, 0, a.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // selection ring
    if (a.selected) {
      ctx.save();
      ctx.lineWidth = 5;
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.shadowColor = "rgba(255,59,48,0.55)";
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(0, 0, a.r * 0.98, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // number badge
    ctx.save();
    const badgeR = 22;
    ctx.translate(0, -a.r * 0.06);
    ctx.fillStyle = "rgba(16,18,22,0.72)";
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, badgeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "700 20px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(a.value), 0, 1);
    ctx.restore();

    ctx.restore();
  }
}

