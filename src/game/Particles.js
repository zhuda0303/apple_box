import { easeOutCubic, rand } from "./math.js";

export class Particles {
  constructor() {
    /** @type {Array<{x:number,y:number,vx:number,vy:number,r:number,life:number,age:number,alpha:number,kind:"dot"|"spark",hue:number}>} */
    this.items = [];
  }

  pop({ x, y, baseHue = 8 }) {
    const count = 14 + Math.floor(Math.random() * 6);
    for (let i = 0; i < count; i += 1) {
      const a = (i / count) * Math.PI * 2 + rand(-0.18, 0.18);
      const sp = rand(220, 420);
      const kind = Math.random() < 0.25 ? "spark" : "dot";
      this.items.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        r: kind === "spark" ? rand(1.6, 2.4) : rand(2.2, 3.6),
        life: rand(0.18, 0.26),
        age: 0,
        alpha: 1,
        kind,
        hue: baseHue + rand(-6, 10),
      });
    }
  }

  update(dt) {
    for (const p of this.items) {
      p.age += dt;
      const t = Math.min(1, p.age / p.life);
      const k = easeOutCubic(t);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy = p.vy * 0.92 + 520 * dt;
      p.alpha = 1 - k;
      if (p.kind === "spark") p.r = Math.max(0.6, p.r * (0.985 - 0.02 * dt));
    }
    this.items = this.items.filter((p) => p.age < p.life);
  }

  render(ctx) {
    for (const p of this.items) {
      const a = Math.max(0, Math.min(1, p.alpha));
      if (a <= 0) continue;
      if (p.kind === "spark") {
        ctx.save();
        ctx.globalAlpha = a;
        ctx.strokeStyle = `hsla(${p.hue}, 95%, 70%, ${a})`;
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
      ctx.fillStyle = `hsla(${p.hue}, 95%, 66%, ${a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

