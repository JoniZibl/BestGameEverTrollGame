import type { GameApi } from '../core/types';

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const randInt = (a: number, b: number) => Math.floor(rand(a, b + 1));
export const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function fill(api: GameApi, color?: string) {
  const { ctx } = api;
  ctx.fillStyle = color ?? api.colors.bg;
  ctx.fillRect(0, 0, api.w, api.h);
}

export function text(
  api: GameApi,
  str: string,
  x: number,
  y: number,
  size: number,
  opts: {
    color?: string;
    align?: CanvasTextAlign;
    kind?: 'display' | 'pixel' | 'mono' | 'ui';
    baseline?: CanvasTextBaseline;
    alpha?: number;
  } = {},
) {
  const { ctx } = api;
  ctx.save();
  ctx.globalAlpha = opts.alpha ?? 1;
  ctx.fillStyle = opts.color ?? api.colors.fg;
  ctx.font = api.font(size, opts.kind ?? 'display');
  ctx.textAlign = opts.align ?? 'center';
  ctx.textBaseline = opts.baseline ?? 'middle';
  ctx.fillText(str, x, y);
  ctx.restore();
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.closePath();
}

/** Thin progress strip used by most eras to show how long is left. */
export function timerBar(api: GameApi, t: number, total: number) {
  const { ctx } = api;
  const pad = Math.max(12, api.w * 0.04);
  const w = api.w - pad * 2;
  const y = api.h - 16;
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = api.colors.fg;
  ctx.fillRect(pad, y, w, 4);
  ctx.globalAlpha = 1;
  ctx.fillRect(pad, y, w * clamp(t / total, 0, 1), 4);
  ctx.restore();
}

export interface Beat {
  at: number;
  run: () => void;
}

/** Fires scheduled twists once each, in order. Every game is built on one of these. */
export class Script {
  private i = 0;
  constructor(private beats: Beat[]) {
    this.beats.sort((a, b) => a.at - b.at);
  }
  update(t: number) {
    while (this.i < this.beats.length && t >= this.beats[this.i].at) {
      this.beats[this.i].run();
      this.i++;
    }
  }
  get finished() {
    return this.i >= this.beats.length;
  }
}

export function aabb(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function dist(x1: number, y1: number, x2: number, y2: number) {
  return Math.hypot(x2 - x1, y2 - y1);
}

/** Scales a game laid out for a 1000x600 reference into whatever space it got. */
export function unit(api: GameApi) {
  return Math.min(api.w / 1000, api.h / 600);
}
