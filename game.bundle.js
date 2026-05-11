/* Fruit Box - 단일 번들 (file:// 호환). 게임 로직 소스 오브 트루스는 이 파일. */

(function () {
  "use strict";

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function randInt(a, bInclusive) {
    return Math.floor(rand(a, bInclusive + 1));
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function formatTimeMmSs(seconds) {
    var s = Math.max(0, Math.floor(seconds + 1e-6));
    var m = Math.floor(s / 60);
    var r = s % 60;
    return (m < 10 ? "0" : "") + m + ":" + (r < 10 ? "0" : "") + r;
  }

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.decoding = "async";
      img.loading = "eager";
      img.onload = function () {
        resolve(img);
      };
      img.onerror = function () {
        reject(new Error("Failed to load image: " + src));
      };
      img.src = src;
    });
  }

  function Particles() {
    this.items = [];
  }

  Particles.prototype.pop = function (opts) {
    var x = opts.x;
    var y = opts.y;
    var baseHue = opts.baseHue != null ? opts.baseHue : 8;
    var count = 14 + Math.floor(Math.random() * 6);
    for (var i = 0; i < count; i += 1) {
      var a = (i / count) * Math.PI * 2 + rand(-0.18, 0.18);
      var sp = rand(220, 420);
      var kind = Math.random() < 0.25 ? "spark" : "dot";
      this.items.push({
        x: x,
        y: y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        r: kind === "spark" ? rand(1.6, 2.4) : rand(2.2, 3.6),
        life: rand(0.18, 0.26),
        age: 0,
        alpha: 1,
        kind: kind,
        hue: baseHue + rand(-6, 10),
      });
    }
  };

  Particles.prototype.update = function (dt) {
    for (var i = 0; i < this.items.length; i += 1) {
      var p = this.items[i];
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy = p.vy * 0.92 + 520 * dt;
      var k = easeOutCubic(Math.min(1, p.age / p.life));
      p.alpha = 1 - k;
      if (p.kind === "spark") {
        p.r = Math.max(0.6, p.r * (0.985 - 0.02 * dt));
      }
    }
    this.items = this.items.filter(function (p) {
      return p.age < p.life;
    });
  };

  Particles.prototype.render = function (ctx) {
    for (var i = 0; i < this.items.length; i += 1) {
      var p = this.items[i];
      var a = Math.max(0, Math.min(1, p.alpha));
      if (a <= 0) continue;
      if (p.kind === "spark") {
        ctx.save();
        ctx.globalAlpha = a;
        ctx.strokeStyle = "hsla(" + p.hue + ", 95%, 70%, " + a + ")";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.02, p.y - p.vy * 0.02);
        ctx.stroke();
        ctx.restore();
        continue;
      }
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = "hsla(" + p.hue + ", 95%, 66%, " + a + ")";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  };

  function Sfx() {
    this.muted = false;
    this.ctx = null;
    var self = this;
    window.addEventListener(
      "pointerdown",
      function () {
        self._unlock();
      },
      { once: true }
    );
  }

  Sfx.prototype._unlock = function () {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    } catch (e) {
      this.ctx = null;
    }
  };

  Sfx.prototype.setMuted = function (m) {
    this.muted = Boolean(m);
  };

  Sfx.prototype.isMuted = function () {
    return this.muted;
  };

  Sfx.prototype._beep = function (opts) {
    if (this.muted) return;
    var ctx = this.ctx;
    if (!ctx) return;
    var type = opts.type || "sine";
    var freq = opts.freq != null ? opts.freq : 440;
    var dur = opts.dur != null ? opts.dur : 0.08;
    var gain = opts.gain != null ? opts.gain : 0.045;
    var t0 = ctx.currentTime;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  };

  Sfx.prototype.ok = function () {
    this._beep({ type: "triangle", freq: 740, dur: 0.07, gain: 0.05 });
    this._beep({ type: "triangle", freq: 980, dur: 0.06, gain: 0.035 });
  };

  /** @typedef {'loading'|'playing'|'paused'|'ended'} GamePhase */

  /**
   * @param {{ canvas: HTMLCanvasElement, onHud?: Function, onEnd?: Function }} opts
   */
  function Game(opts) {
    this.canvas = opts.canvas;
    this.ctx = this.canvas.getContext("2d");
    if (!this.ctx) throw new Error("2D context not available");
    this.onHud = opts.onHud || function () {};
    this.onEnd = opts.onEnd || function () {};

    this.cols = 17;
    this.rows = 10;
    this.worldW = 1024;
    this.worldH = 640;

    this.dpr = 1;
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;

    /** @type {GamePhase} */
    this.phase = "loading";
    this.running = false;
    this.lastTs = 0;

    this.appleImg = null;
    this.particles = new Particles();
    this.sfx = new Sfx();

    this.score = 0;
    /** 남은 시간(초) */
    this.timeLeft = 60;

    /** @type {(null | { cx: number, cy: number, r: number })[][]} */
    this.grid = [];
    this.padX = 10;
    this.padY = 6;
    this.cellW = 1;
    this.cellH = 1;

    /** @type {(null | { value: number, phase: string, t: number })[][]} */
    this.cells = [];

    this.marquee = {
      active: false,
      x0: 0,
      y0: 0,
      x1: 0,
      y1: 0,
    };

    /** @type {Array<{ r: number, c: number }>} */
    this.marqueePreview = [];

    /** 타이머 HUD 스로틀 */
    this._hudThrottle = 0;

    var self = this;
    this._resize = function () {
      Game.prototype._resize.call(self);
    };
    this._frame = function (ts) {
      Game.prototype._frame.call(self, ts);
    };

    this._bindEvents();
  }

  Game.prototype._bindEvents = function () {
    var self = this;
    this.canvas.addEventListener("pointerdown", function (e) {
      self._pointerDown(e);
    });
    this.canvas.addEventListener("pointermove", function (e) {
      self._pointerMove(e);
    });
    this.canvas.addEventListener("pointerup", function (e) {
      self._pointerUp(e);
    });
    this.canvas.addEventListener("pointercancel", function (e) {
      self._pointerCancel(e);
    });
  };

  Game.prototype._emitHud = function () {
    var previewSum = 0;
    var i;
    for (i = 0; i < this.marqueePreview.length; i += 1) {
      var ref = this.marqueePreview[i];
      var cell = this.cells[ref.r][ref.c];
      if (cell && cell.phase === "ok") previewSum += cell.value;
    }
    this.onHud({
      sum: previewSum,
      score: this.score,
      timeLeft: this.timeLeft,
      phase: this.phase,
    });
  };

  Game.prototype.isMuted = function () {
    return this.sfx.isMuted();
  };

  Game.prototype.setMuted = function (muted) {
    this.sfx.setMuted(muted);
  };

  Game.prototype._allocateGridArrays = function () {
    var r;
    var c;
    this.grid = [];
    this.cells = [];
    for (r = 0; r < this.rows; r += 1) {
      this.grid[r] = [];
      this.cells[r] = [];
      for (c = 0; c < this.cols; c += 1) {
        this.cells[r][c] = null;
        this.grid[r][c] = null;
      }
    }
  };

  Game.prototype._layoutGeometry = function () {
    var r;
    var c;
    var innerW = this.worldW - this.padX * 2;
    var innerH = this.worldH - this.padY * 2;
    this.cellW = innerW / this.cols;
    this.cellH = innerH / this.rows;
    for (r = 0; r < this.rows; r += 1) {
      for (c = 0; c < this.cols; c += 1) {
        var cx = this.padX + c * this.cellW + this.cellW / 2;
        var cy = this.padY + r * this.cellH + this.cellH / 2;
        var rad = Math.min(this.cellW, this.cellH) * 0.34;
        this.grid[r][c] = { cx: cx, cy: cy, r: rad };
      }
    }
  };

  Game.prototype._fillLivingCells = function () {
    var r;
    var c;
    for (r = 0; r < this.rows; r += 1) {
      for (c = 0; c < this.cols; c += 1) {
        this.cells[r][c] = {
          value: randInt(1, 9),
          phase: "ok",
          t: 0,
        };
      }
    }
  };

  Game.prototype._initRound = function () {
    this._allocateGridArrays();
    this._layoutGeometry();
    this._fillLivingCells();
  };

  Game.prototype.start = function () {
    var self = this;
    this.running = true;
    this._resize();
    window.addEventListener("resize", this._resize);
    return loadImage("./assets/apple.png").then(function (img) {
      self.appleImg = img;
      self.score = 0;
      self.timeLeft = 60;
      self.phase = "playing";
      self._initRound();
      self.marquee.active = false;
      self.marqueePreview = [];
      self.lastTs = 0;
      self._emitHud();
      requestAnimationFrame(self._frame);
    });
  };

  Game.prototype.restart = function () {
    this.score = 0;
    this.timeLeft = 60;
    if (this.phase !== "loading") this.phase = "playing";
    this.particles.items = [];
    this.marquee.active = false;
    this.marqueePreview = [];
    this.lastTs = 0;
    this._initRound();
    this._emitHud();
  };

  Game.prototype.isPaused = function () {
    return this.phase === "paused";
  };

  Game.prototype.setPaused = function (paused) {
    if (this.phase === "loading" || this.phase === "ended") return;
    this.phase = paused ? "paused" : "playing";
    if (!paused) {
      this.lastTs = 0;
    }
    this._emitHud();
  };

  Game.prototype.togglePause = function () {
    if (this.phase === "ended") return;
    this.setPaused(this.phase !== "paused");
  };

  Game.prototype._normRect = function () {
    var x0 = this.marquee.x0;
    var y0 = this.marquee.y0;
    var x1 = this.marquee.x1;
    var y1 = this.marquee.y1;
    return {
      l: Math.min(x0, x1),
      r: Math.max(x0, x1),
      t: Math.min(y0, y1),
      b: Math.max(y0, y1),
    };
  };

  Game.prototype._updateMarqueePreview = function () {
    var nm = this._normRect();
    var hits = [];
    var ri;
    var ci;
    for (ri = 0; ri < this.rows; ri += 1) {
      for (ci = 0; ci < this.cols; ci += 1) {
        var cellData = this.cells[ri][ci];
        if (!cellData || cellData.phase !== "ok") continue;
        var g = this.grid[ri][ci];
        if (!g) continue;
        if (g.cx >= nm.l && g.cx <= nm.r && g.cy >= nm.t && g.cy <= nm.b) {
          hits.push({ r: ri, c: ci });
        }
      }
    }
    this.marqueePreview = hits;
  };

  Game.prototype._pointerDown = function (e) {
    if (this.phase !== "playing") return;
    e.preventDefault();
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch (eCap) {
      /* noop */
    }
    var p = this._toWorld(e.clientX, e.clientY);
    this.marquee.active = true;
    this.marquee.x0 = p.x;
    this.marquee.y0 = p.y;
    this.marquee.x1 = p.x;
    this.marquee.y1 = p.y;
    this._updateMarqueePreview();
    this._emitHud();
  };

  Game.prototype._pointerMove = function (e) {
    if (!this.marquee.active || this.phase !== "playing") return;
    e.preventDefault();
    var p = this._toWorld(e.clientX, e.clientY);
    this.marquee.x1 = p.x;
    this.marquee.y1 = p.y;
    this._updateMarqueePreview();
    this._emitHud();
  };

  Game.prototype._pointerUp = function (e) {
    if (!this.marquee.active) return;
    e.preventDefault();
    try {
      this.canvas.releasePointerCapture(e.pointerId);
    } catch (err) {
      /* noop */
    }
    this.marquee.active = false;
    if (this.phase !== "playing") {
      this.marqueePreview = [];
      this._emitHud();
      return;
    }
    var p = this._toWorld(e.clientX, e.clientY);
    this.marquee.x1 = p.x;
    this.marquee.y1 = p.y;
    this._updateMarqueePreview();

    var list = this.marqueePreview.slice();
    this.marqueePreview = [];
    this._emitHud();

    var sum = 0;
    var vals = [];
    var i;
    for (i = 0; i < list.length; i += 1) {
      var ref = list[i];
      var cel = this.cells[ref.r][ref.c];
      if (cel && cel.phase === "ok") {
        sum += cel.value;
        vals.push(ref);
      }
    }

    if (sum !== 10) {
      return;
    }

    var removedSum = 0;
    for (i = 0; i < vals.length; i += 1) {
      ref = vals[i];
      cel = this.cells[ref.r][ref.c];
      if (!cel || cel.phase !== "ok") continue;
      removedSum += cel.value;
      cel.phase = "poof";
      cel.t = 0;
      var gx = this.grid[ref.r][ref.c];
      if (gx) this.particles.pop({ x: gx.cx, y: gx.cy, baseHue: 8 });
    }
    this.score += removedSum;
    this.sfx.ok();
    this._emitHud();
  };

  Game.prototype._pointerCancel = function (e) {
    if (!this.marquee.active) return;
    try {
      this.canvas.releasePointerCapture(e.pointerId);
    } catch (err2) {
      /* noop */
    }
    this.marquee.active = false;
    this.marqueePreview = [];
    this._emitHud();
  };

  Game.prototype._endGame = function () {
    if (this.phase === "ended") return;
    this.phase = "ended";
    this.marquee.active = false;
    this.marqueePreview = [];
    this.onEnd({ score: this.score });
    this._emitHud();
  };

  Game.prototype._resize = function () {
    var rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    this.canvas.width = Math.max(1, Math.floor(rect.width * this.dpr));
    this.canvas.height = Math.max(1, Math.floor(rect.height * this.dpr));

    var sx = this.canvas.width / this.worldW;
    var sy = this.canvas.height / this.worldH;
    this.scale = Math.min(sx, sy);
    this.offsetX = (this.canvas.width - this.worldW * this.scale) / 2;
    this.offsetY = (this.canvas.height - this.worldH * this.scale) / 2;
  };

  Game.prototype._toWorld = function (cx, cy) {
    var rect = this.canvas.getBoundingClientRect();
    var px = (cx - rect.left) * this.dpr;
    var py = (cy - rect.top) * this.dpr;
    return {
      x: (px - this.offsetX) / this.scale,
      y: (py - this.offsetY) / this.scale,
    };
  };

  Game.prototype._frame = function (ts) {
    if (!this.running) return;
    var dt = this.lastTs ? Math.min(0.033, (ts - this.lastTs) / 1000) : 0;
    this.lastTs = ts;

    if (this.phase === "playing") {
      this._update(dt);
    }
    this._render();
    requestAnimationFrame(this._frame);
  };

  Game.prototype._update = function (dt) {
    this.particles.update(dt);

    var r;
    var c;
    for (r = 0; r < this.rows; r += 1) {
      for (c = 0; c < this.cols; c += 1) {
        var cel = this.cells[r][c];
        if (!cel || cel.phase !== "poof") continue;
        cel.t += dt;
        if (cel.t >= 0.22) {
          this.cells[r][c] = null;
        }
      }
    }

    if (this.phase === "playing") {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this._endGame();
      }
    }

    this._hudThrottle += dt;
    if (this._hudThrottle >= 0.1 || this.phase === "ended") {
      this._hudThrottle = 0;
      this._emitHud();
    }
  };

  Game.prototype._render = function () {
    var ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    /* 회색 페이지와 구분되는 연한 세이지(사과 레드와 보색 관계로 대비·조화) */
    ctx.fillStyle = "#d2e5da";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.setTransform(this.scale, 0, 0, this.scale, this.offsetX, this.offsetY);

    ctx.save();
    ctx.strokeStyle = "rgba(75,85,99,0.45)";
    ctx.lineWidth = 1 / this.scale;
    var r;
    var c;
    for (r = 0; r < this.rows; r += 1) {
      for (c = 0; c < this.cols; c += 1) {
        var gx0 = this.padX + c * this.cellW;
        var gy0 = this.padY + r * this.cellH;
        ctx.strokeRect(gx0, gy0, this.cellW, this.cellH);
      }
    }
    ctx.restore();

    for (r = 0; r < this.rows; r += 1) {
      for (c = 0; c < this.cols; c += 1) {
        this._drawCell(ctx, r, c);
      }
    }

    if (this.marquee.active && this.phase === "playing") {
      var nm = this._normRect();
      ctx.save();
      ctx.fillStyle = "rgba(14,165,233,0.18)";
      ctx.strokeStyle = "rgba(14,165,233,0.65)";
      ctx.lineWidth = 2 / this.scale;
      ctx.fillRect(nm.l, nm.t, nm.r - nm.l, nm.b - nm.t);
      ctx.strokeRect(nm.l, nm.t, nm.r - nm.l, nm.b - nm.t);
      ctx.restore();
    }

    if (this.phase === "ended") {
      ctx.save();
      ctx.fillStyle = "rgba(107,114,128,0.35)";
      ctx.fillRect(0, 0, this.worldW, this.worldH);
      ctx.restore();
    }

    this.particles.render(ctx);
  };

  Game.prototype._drawCell = function (ctx, rr, cc) {
    var cel = this.cells[rr][cc];
    var gpos = this.grid[rr][cc];
    if (!gpos) return;
    if (!cel) return;

    if (cel.phase === "poof") {
      var vanishT = clamp(cel.t / 0.22, 0, 1);
      var kk = easeOutCubic(vanishT);
      var alpha = 1 - kk;
      if (alpha <= 0.001) return;
      ctx.save();
      ctx.translate(gpos.cx, gpos.cy);
      ctx.globalAlpha = alpha;
      ctx.scale(1 - 0.22 * kk, 1 - 0.22 * kk);
      this._drawAppleBody(ctx, gpos.r, cel.value);
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.translate(gpos.cx, gpos.cy);
    this._drawAppleBody(ctx, gpos.r, cel.value);

    var inPreview = false;
    var pi;
    for (pi = 0; pi < this.marqueePreview.length; pi += 1) {
      var pv = this.marqueePreview[pi];
      if (pv.r === rr && pv.c === cc) {
        inPreview = true;
        break;
      }
    }
    if (inPreview) {
      ctx.save();
      ctx.strokeStyle = "rgba(14,165,233,0.9)";
      ctx.shadowColor = "rgba(56,189,248,0.35)";
      ctx.shadowBlur = 14;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, gpos.r * 0.96, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  };

  Game.prototype._drawAppleBody = function (ctx, rad, val) {
    var img = this.appleImg;

    ctx.save();
    ctx.globalAlpha *= 0.24;
    ctx.fillStyle = "rgba(0,0,0,0.85)";
    ctx.beginPath();
    ctx.ellipse(0, rad * 0.72, rad * 0.62, rad * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (img) {
      var sd = rad * 2.05;
      ctx.drawImage(img, -sd / 2, -sd / 2, sd, sd);
    } else {
      ctx.fillStyle = "#ff3b30";
      ctx.beginPath();
      ctx.arc(0, 0, rad, 0, Math.PI * 2);
      ctx.fill();
    }

    /* 원형 배지 없이 숫자만 (이전 크기 대비 약 70%) */
    ctx.save();
    ctx.translate(0, -rad * 0.06);
    var fz = Math.max(14, rad * 0.588);
    ctx.font =
      "700 " + fz + "px system-ui,-apple-system,Segoe UI,Roboto,sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;
    var lw = Math.max(2, fz * 0.14);
    ctx.lineWidth = lw;
    ctx.strokeStyle = "rgba(255,255,255,0.92)";
    ctx.strokeText(String(val), 0, 1);
    ctx.fillStyle = "#111827";
    ctx.fillText(String(val), 0, 1);
    ctx.restore();
  };

  window.FruitBoxGame = Game;

  function boot() {
    var canvas = document.querySelector("[data-canvas]");
    var elScore = document.querySelector("[data-score]");
    var elTimer = document.querySelector("[data-timer]");
    var btnMute = document.querySelector("[data-mute]");
    var btnPause = document.querySelector("[data-pause]");
    var overlay = document.querySelector("[data-overlay]");
    var overlayResult = document.querySelector("[data-result]");
    var btnResume = document.querySelector("[data-resume]");
    var btnRestart = document.querySelector("[data-restart]");
    var btnPlayAgain = document.querySelector("[data-play-again]");
    var elFinalScore = document.querySelector("[data-final-score]");

    if (!(canvas instanceof HTMLCanvasElement)) {
      console.error("[FruitBox] Canvas 없음");
      return;
    }

    function setPauseOverlay(open) {
      if (!overlay) return;
      overlay.hidden = !open;
    }

    function setResultOverlay(open, scoreStr) {
      if (!overlayResult) return;
      overlayResult.hidden = !open;
      if (open && elFinalScore && scoreStr != null) {
        elFinalScore.textContent = scoreStr;
      }
    }

    var game = new Game({
      canvas: canvas,
      onHud: function (state) {
        if (elScore) elScore.textContent = String(state.score);
        if (elTimer) elTimer.textContent = formatTimeMmSs(state.timeLeft);
      },
      onEnd: function (payload) {
        setPauseOverlay(false);
        setResultOverlay(true, String(payload.score));
      },
    });

    setPauseOverlay(false);
    setResultOverlay(false);

    btnPause &&
      btnPause.addEventListener("click", function () {
        if (game.phase === "ended") return;
        game.togglePause();
        setPauseOverlay(game.isPaused());
      });

    btnResume &&
      btnResume.addEventListener("click", function () {
        if (game.phase === "ended") return;
        game.setPaused(false);
        setPauseOverlay(false);
      });

    btnRestart &&
      btnRestart.addEventListener("click", function () {
        game.restart();
        game.setPaused(false);
        setPauseOverlay(false);
        setResultOverlay(false);
      });

    btnPlayAgain &&
      btnPlayAgain.addEventListener("click", function () {
        game.restart();
        setResultOverlay(false);
      });

    window.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        if (game.phase === "ended") return;
        game.togglePause();
        setPauseOverlay(game.isPaused());
      }
    });

    btnMute &&
      btnMute.addEventListener("click", function () {
        var nx = !game.isMuted();
        game.setMuted(nx);
        btnMute.setAttribute("aria-label", nx ? "사운드 켜기" : "사운드 끄기");
        btnMute.dataset.muted = String(nx);
        btnMute.innerHTML = nx
          ? '<span aria-hidden="true">🔇</span>'
          : '<span aria-hidden="true">🔈</span>';
      });

    game.start().catch(function (err) {
      console.error("[FruitBox]", err);
      var hint = document.querySelector("[data-hint]");
      if (hint) {
        hint.textContent =
          "그림을 불러오지 못했습니다. 이 폴더에 assets/apple.png가 있는지 확인하세요.";
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
