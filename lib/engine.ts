import type { Pt, Stroke } from "./types";

/** Base unit for stroke widths: widths are stored in 1/1000ths of the short edge. */
const REF = 1000;
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

export function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

type Anim = { stroke: Stroke; start: number; dur: number };

export type EngineEvents = {
  /** replay progressed (0..1), finished flag flips once */
  onReplay?: (progress: number, drawn: number, total: number, complete: boolean) => void;
};

type LiveBuffer = {
  color: string;
  width: number;
  points: Pt[];
  last: { x: number; y: number; t: number };
  taper: number;
};

/**
 * Everything visual about the painting lives here: committed ink is baked into an
 * offscreen buffer (so it is never re-drawn per frame), strokes arriving from other
 * people animate on top of it, and the replay replays the archive from the first mark.
 */
export class PaintingEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private tip: HTMLCanvasElement | null;
  private tipCtx: CanvasRenderingContext2D | null;
  private staticCanvas: HTMLCanvasElement;
  private sctx: CanvasRenderingContext2D;

  private dpr = 1;
  private W = 1;
  private H = 1;

  private committed: Stroke[] = [];
  private anims: Anim[] = [];
  private live: LiveBuffer | null = null;

  private replay = {
    active: false,
    drawn: 0,
    total: 0,
    duration: 20000,
    startedAt: 0,
    complete: false,
  };

  private raf = 0;
  private destroyed = false;
  private events: EngineEvents;

  constructor(canvas: HTMLCanvasElement, tip: HTMLCanvasElement | null, events: EngineEvents = {}) {
    this.canvas = canvas;
    this.tip = tip;
    this.events = events;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) throw new Error("Canvas 2D is not available in this browser.");
    this.ctx = ctx;

    this.tipCtx = tip ? tip.getContext("2d") : null;

    this.staticCanvas = document.createElement("canvas");
    const sctx = this.staticCanvas.getContext("2d", { alpha: true });
    if (!sctx) throw new Error("Canvas 2D is not available in this browser.");
    this.sctx = sctx;

    this.resize();
    this.raf = requestAnimationFrame(this.tick);
  }

  /* ------------------------------------------------------------------ geometry */

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const W = Math.max(1, Math.round(rect.width));
    const H = Math.max(1, Math.round(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);

    if (W === this.W && H === this.H && dpr === this.dpr) return;

    this.W = W;
    this.H = H;
    this.dpr = dpr;

    for (const c of [this.canvas, this.staticCanvas, this.tip]) {
      if (!c) continue;
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
    }

    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.tipCtx?.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (this.replay.active) {
      this.replay.drawn = 0;
      this.clearMain();
      this.drawReplayTo(this.replay.drawn);
    } else {
      this.rebuildStatic();
    }
  }

  get size() {
    return { W: this.W, H: this.H };
  }

  /* ------------------------------------------------------------------ rendering */

  private clearMain() {
    this.ctx.clearRect(0, 0, this.W, this.H);
  }

  private drawStroke(
    ctx: CanvasRenderingContext2D,
    s: Stroke,
    upto: number,
    opts: { glow?: boolean } = {},
  ) {
    const pts = s.points;
    const n = Math.min(upto, pts.length);
    if (n < 2) return;

    const { W, H } = this;
    const base = (s.width / REF) * Math.min(W, H);

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (opts.glow !== false && s.width >= 3) {
      ctx.strokeStyle = hexToRgba(s.color, s.alpha * 0.1);
      for (let i = 1; i < n; i++) {
        const a = pts[i - 1];
        const b = pts[i];
        ctx.lineWidth = base * ((a[2] + b[2]) * 0.5) * 2.7;
        ctx.beginPath();
        ctx.moveTo(a[0] * W, a[1] * H);
        ctx.lineTo(b[0] * W, b[1] * H);
        ctx.stroke();
      }
    }

    ctx.strokeStyle = hexToRgba(s.color, s.alpha);
    for (let i = 1; i < n; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      ctx.lineWidth = base * ((a[2] + b[2]) * 0.5);
      ctx.beginPath();
      ctx.moveTo(a[0] * W, a[1] * H);
      ctx.lineTo(b[0] * W, b[1] * H);
      ctx.stroke();
    }
  }

  private renderTip(x: number, y: number, radius: number, color: string) {
    if (!this.tipCtx) return;
    const t = this.tipCtx;
    t.clearRect(0, 0, this.W, this.H);

    const px = x * this.W;
    const py = y * this.H;
    const r = Math.max(radius, 4) * 3.2;

    const g = t.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, hexToRgba(color, 0.5));
    g.addColorStop(0.32, hexToRgba(color, 0.16));
    g.addColorStop(1, hexToRgba(color, 0));
    t.fillStyle = g;
    t.beginPath();
    t.arc(px, py, r, 0, Math.PI * 2);
    t.fill();
  }

  private clearTip() {
    this.tipCtx?.clearRect(0, 0, this.W, this.H);
  }

  private rebuildStatic() {
    this.sctx.clearRect(0, 0, this.W, this.H);
    for (const s of this.committed) this.drawStroke(this.sctx, s, s.points.length);

    if (!this.replay.active) {
      this.clearMain();
      this.ctx.drawImage(this.staticCanvas, 0, 0, this.W, this.H);
    }
  }

  private renderFrame(now: number) {
    const ctx = this.ctx;
    this.clearMain();
    ctx.drawImage(this.staticCanvas, 0, 0, this.W, this.H);

    for (const a of this.anims) {
      const p = clamp((now - a.start) / a.dur, 0, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const count = Math.max(2, Math.ceil(eased * a.stroke.points.length));
      this.drawStroke(ctx, a.stroke, count);
    }

    if (this.live) {
      const l = this.live;
      const virtual: Stroke = {
        id: "live",
        color: l.color,
        alpha: 0.97,
        width: l.width,
        points: l.points,
        source: "human",
        createdAt: "",
      };
      this.drawStroke(ctx, virtual, l.points.length);
      const last = l.points[l.points.length - 1];
      if (last) {
        const base = (l.width / REF) * Math.min(this.W, this.H);
        this.renderTip(last[0], last[1], base * last[2], l.color);
      }
    } else {
      this.clearTip();
    }
  }

  /* ------------------------------------------------------------------ data in */

  setStrokes(strokes: Stroke[]) {
    this.committed = strokes.slice();
    this.anims = [];
    this.rebuildStatic();
  }

  /** Bake a finished stroke straight into the painting. */
  commit(stroke: Stroke) {
    this.committed.push(stroke);
    this.drawStroke(this.sctx, stroke, stroke.points.length);
    if (!this.replay.active && this.anims.length === 0 && !this.live) {
      this.clearMain();
      this.ctx.drawImage(this.staticCanvas, 0, 0, this.W, this.H);
    }
  }

  /** Somebody else's stroke arrives — draw it in front of you, growing. */
  animateIn(stroke: Stroke) {
    const dur = clamp(280 + stroke.points.length * 5, 320, 1400);
    this.anims.push({ stroke, start: performance.now(), dur });
  }

  /* ------------------------------------------------------------------ live brush */

  liveBegin(color: string, width: number) {
    this.live = {
      color,
      width,
      points: [],
      last: { x: 0, y: 0, t: 0 },
      taper: 1.05,
    };
  }

  livePoint(x: number, y: number, t = performance.now()) {
    const l = this.live;
    if (!l) return;

    if (l.points.length === 0) {
      l.last = { x, y, t };
      l.points.push([x / this.W, y / this.H, l.taper]);
      return;
    }

    const dx = x - l.last.x;
    const dy = y - l.last.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1.1) return;

    const dt = Math.max(t - l.last.t, 4);
    const speed = dist / dt; // px per ms
    const target = clamp(1.32 - speed * 0.62, 0.55, 1.32);
    l.taper = l.taper * 0.68 + target * 0.32;

    const step = 2.6;
    const steps = Math.max(1, Math.min(28, Math.floor(dist / step)));
    for (let i = 1; i <= steps; i++) {
      const k = i / steps;
      const px = l.last.x + dx * k;
      const py = l.last.y + dy * k;
      l.points.push([px / this.W, py / this.H, l.taper]);
    }

    l.last = { x, y, t };
  }

  /** Ends the stroke and returns it, or null when nothing meaningful was drawn. */
  liveEnd(): Omit<Stroke, "id" | "createdAt" | "source"> | null {
    const l = this.live;
    this.live = null;
    this.clearTip();
    if (!l || l.points.length === 0) return null;

    let pts = l.points;

    if (pts.length < 2) {
      // a tap still leaves a mark: a small, perfectly round dot
      const [cx, cy] = pts[0];
      const r = (l.width / REF) * 0.9;
      const dot: Pt[] = [];
      for (let i = 0; i <= 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        dot.push([cx + Math.cos(a) * r * 0.35, cy + Math.sin(a) * r * 0.35 * 1.4, 1.1]);
      }
      pts = dot;
    } else {
      // gentle moving-average so the ink flows instead of twitching
      const smoothed: Pt[] = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[Math.max(0, i - 1)];
        const b = pts[i];
        const c = pts[Math.min(pts.length - 1, i + 1)];
        smoothed.push([
          (a[0] + b[0] * 2 + c[0]) / 4,
          (a[1] + b[1] * 2 + c[1]) / 4,
          (a[2] + b[2] * 2 + c[2]) / 4,
        ]);
      }
      pts = smoothed;
    }

    // keep payloads sane — thin out very long strokes
    const MAX = 480;
    if (pts.length > MAX) {
      const stride = pts.length / MAX;
      pts = Array.from({ length: MAX }, (_, i) => pts[Math.floor(i * stride)]);
    }

    return {
      color: l.color,
      alpha: 0.97,
      width: l.width,
      points: pts.map(([x, y, w]) => [
        Math.round(x * 10000) / 10000,
        Math.round(y * 10000) / 10000,
        Math.round(w * 1000) / 1000,
      ]) as Pt[],
    };
  }

  /* ------------------------------------------------------------------ replay */

  get replayState() {
    return { ...this.replay };
  }

  startReplay(duration = 21000) {
    const total = this.committed.length;
    this.replay = {
      active: true,
      drawn: 0,
      total,
      duration,
      startedAt: performance.now(),
      complete: total === 0,
    };
    this.anims = [];
    this.clearMain();
    this.clearTip();
    this.events.onReplay?.(0, 0, total, total === 0);
  }

  private drawReplayTo(target: number) {
    const capped = clamp(Math.round(target), 0, this.committed.length);
    if (capped < this.replay.drawn) {
      this.clearMain();
      this.replay.drawn = 0;
    }
    for (let i = this.replay.drawn; i < capped; i++) {
      this.drawStroke(this.ctx, this.committed[i], this.committed[i].points.length);
    }
    this.replay.drawn = capped;
  }

  seekReplay(progress: number) {
    if (!this.replay.active) return;
    const total = this.replay.total;
    const target = clamp(progress, 0, 1) * total;
    this.replay.startedAt = performance.now() - (clamp(progress, 0, 1) * this.replay.duration);
    this.replay.complete = target >= total;
    this.drawReplayTo(target);
    this.events.onReplay?.(progress, this.replay.drawn, total, this.replay.complete);
  }

  stopReplay() {
    this.replay.active = false;
    this.replay.drawn = 0;
    this.clearMain();
    this.ctx.drawImage(this.staticCanvas, 0, 0, this.W, this.H);
    this.clearTip();
  }

  /* ------------------------------------------------------------------ loop */

  private tick = (now: number) => {
    if (this.destroyed) return;

    if (this.replay.active) {
      if (!this.replay.complete) {
        const p = clamp((now - this.replay.startedAt) / this.replay.duration, 0, 1);
        this.drawReplayTo(p * this.replay.total);
        if (p >= 1) this.replay.complete = true;
        this.events.onReplay?.(p, this.replay.drawn, this.replay.total, this.replay.complete);

        const last = this.committed[Math.max(0, this.replay.drawn - 1)];
        const tip = last?.points[last.points.length - 1];
        if (tip && last) {
          const base = (last.width / REF) * Math.min(this.W, this.H);
          this.renderTip(tip[0], tip[1], base * 2.4, last.color);
        }
      }
    } else if (this.anims.length > 0 || this.live) {
      const still: Anim[] = [];
      let landed = false;
      for (const a of this.anims) {
        if (now - a.start >= a.dur) {
          this.committed.push(a.stroke);
          this.drawStroke(this.sctx, a.stroke, a.stroke.points.length);
          landed = true;
        } else {
          still.push(a);
        }
      }
      this.anims = still;
      if (landed || still.length > 0 || this.live) this.renderFrame(now);
    }

    this.raf = requestAnimationFrame(this.tick);
  };

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
  }
}
