/**
 * Headless playability harness.
 *
 * Runs a minigame's update loop with no canvas and a scripted player, so we can
 * answer the only question that matters: can a competent player actually win
 * this year? Draw is never called; nothing here ships with the game.
 */
import type { GameApi, MiniGame, PopupRequest, WinPayload } from '../src/core/types';
import { tuning, type DifficultyId } from '../src/core/difficulty';

export interface SimResult {
  outcome: 'win' | 'lose' | 'timeout';
  reason?: string;
  stat?: string;
  seconds: number;
  hud: string;
}

export interface Bot {
  /** Called every frame, before the game updates. Drive `input` here. */
  (input: FakeInput, t: number, api: GameApi, seen: Recorder): void;
}

/**
 * A stand-in for Input with writable state.
 *
 * It deliberately does NOT extend Input: the real class keeps pointer state in
 * class fields, and a subclass accessor would be shadowed by them — which is
 * exactly the kind of silently-does-nothing test rig that reports a fine game
 * as broken.
 */
export class FakeInput {
  keys = new Set<string>();
  edges = new Set<string>();
  pointerX = 0;
  pointerY = 0;
  pointerDown = false;
  pointerEdge = false;
  presses = 0;
  coarse = false;
  tapEdge = false;
  secondEdge = false;
  swipeDir: 'left' | 'right' | 'up' | 'down' | null = null;
  joyX = 0;
  joyY = 0;

  attach() {}
  detach() {}
  setVirtual() {}

  down(...codes: string[]) {
    return codes.some((c) => this.keys.has(c));
  }
  justPressed(...codes: string[]) {
    return codes.some((c) => this.edges.has(c));
  }
  press(code: string) {
    this.keys.add(code);
    this.edges.add(code);
    this.presses++;
  }
  release(code: string) {
    this.keys.delete(code);
  }
  tap() {
    this.tapEdge = true;
    this.presses++;
  }

  get left() {
    return this.down('ArrowLeft', 'KeyA');
  }
  get right() {
    return this.down('ArrowRight', 'KeyD');
  }
  get up() {
    return this.down('ArrowUp', 'KeyW');
  }
  get downKey() {
    return this.down('ArrowDown', 'KeyS');
  }
  get axisX() {
    return (this.right ? 1 : 0) - (this.left ? 1 : 0);
  }
  get axisY() {
    return (this.downKey ? 1 : 0) - (this.up ? 1 : 0);
  }
  get moveX() {
    return this.axisX || dz(this.joyX);
  }
  get moveY() {
    return this.axisY || dz(this.joyY);
  }
  get dirX() {
    if (this.axisX) return this.axisX;
    return Math.abs(this.joyX) >= Math.abs(this.joyY) ? Math.sign(dz(this.joyX, 0.42)) : 0;
  }
  get dirY() {
    if (this.axisY) return this.axisY;
    return Math.abs(this.joyY) > Math.abs(this.joyX) ? Math.sign(dz(this.joyY, 0.42)) : 0;
  }
  get tapped() {
    return this.tapEdge;
  }
  get secondTap() {
    return this.secondEdge;
  }
  get swipe() {
    return this.swipeDir;
  }
  get action() {
    return this.down('Space', 'KeyZ', 'Enter') || this.pointerDown;
  }
  get actionPressed() {
    return this.justPressed('Space', 'KeyZ', 'Enter') || this.pointerEdge;
  }
  get actionKeyPressed() {
    return this.justPressed('Space', 'KeyZ', 'Enter');
  }
  get firePressed() {
    return this.actionKeyPressed || this.tapEdge || this.secondEdge;
  }
  get upPressed() {
    return this.justPressed('ArrowUp', 'KeyW', 'Space');
  }
  get jumpPressed() {
    return this.upPressed || this.tapEdge || this.secondEdge || this.swipeDir === 'up';
  }

  endFrame() {
    this.edges.clear();
    this.pointerEdge = false;
    this.tapEdge = false;
    this.secondEdge = false;
    this.swipeDir = null;
  }
}

const dz = (v: number, t = 0.22) => (Math.abs(v) < t ? 0 : v);

export interface DrawOp {
  op: string;
  args: number[];
}

/**
 * A canvas context that records what the game drew. The bots read this instead
 * of the game's private state, so no game needs a debug hook to be testable.
 */
export class Recorder {
  ops: DrawOp[] = [];
  readonly ctx: CanvasRenderingContext2D;

  constructor() {
    const self = this;
    this.ctx = new Proxy(
      {},
      {
        get(_t, prop: string) {
          if (prop === 'measureText') return () => ({ width: 10 });
          if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
            return () => ({ addColorStop: () => {} });
          }
          if (prop === 'canvas') return { width: 0, height: 0 };
          return (...args: unknown[]) => {
            self.ops.push({ op: prop, args: args.filter((a) => typeof a === 'number') as number[] });
            return undefined;
          };
        },
        set: () => true,
      },
    ) as unknown as CanvasRenderingContext2D;
  }

  clear() {
    this.ops = [];
  }
  /** Circles drawn this frame, as [x, y, r]. */
  arcs() {
    return this.ops.filter((o) => o.op === 'arc' && o.args.length >= 3).map((o) => o.args);
  }
  rects(op = 'fillRect') {
    return this.ops.filter((o) => o.op === op && o.args.length >= 4).map((o) => o.args);
  }
}

/**
 * Games schedule follow-ups with window.setTimeout. The simulation loop is
 * synchronous, so real timers would never fire and a finished battle would look
 * like a hung game. This drives them from simulated time instead.
 */
class FakeClock {
  private queue: { at: number; fn: () => void }[] = [];
  private now = 0;
  install() {
    const g = globalThis as unknown as { window?: unknown; setTimeout: unknown };
    const shim = (fn: () => void, ms = 0) => {
      this.queue.push({ at: this.now + ms / 1000, fn });
      return 0;
    };
    g.window = { setTimeout: shim, clearTimeout: () => {}, setInterval: shim, clearInterval: () => {} };
  }
  advance(t: number) {
    this.now = t;
    const due = this.queue.filter((q) => q.at <= t);
    this.queue = this.queue.filter((q) => q.at > t);
    due.forEach((q) => q.fn());
  }
}

export function simulate(
  create: (api: GameApi) => MiniGame,
  bot: Bot,
  opts: { difficulty?: DifficultyId; w?: number; h?: number; maxSeconds?: number; dt?: number } = {},
): SimResult {
  const w = opts.w ?? 420;
  const h = opts.h ?? 760;
  const maxSeconds = opts.maxSeconds ?? 180;
  const dt = opts.dt ?? 1 / 60;
  const input = new FakeInput();
  const rec = new Recorder();
  let done: SimResult | null = null;
  let hud = '';
  let t = 0;

  const api: GameApi = {
    ctx: rec.ctx,
    w,
    h,
    input: input as unknown as GameApi['input'],
    audio: {
      blip: () => {},
      noise: () => {},
      jingle: () => {},
      fanfare: () => {},
      thud: () => {},
      setEra: () => {},
      startMusic: () => {},
      stopMusic: () => {},
      unlock: () => {},
      toggleMute: () => false,
      setMuted: () => {},
      onMuteChange: () => () => {},
      muted: true,
    } as unknown as GameApi['audio'],
    colors: { bg: '#fff', fg: '#000', dim: '#888', accent: '#f00', warn: '#fa0' },
    font: () => '10px sans-serif',
    isTouch: false,
    diff: tuning(opts.difficulty ?? 'player'),
    say: () => {},
    shout: () => {},
    hud: (text: string) => {
      hud = text;
    },
    // Popups pause the real game. Answer synchronously: a microtask would not run
    // until the simulation loop finished, which looks exactly like a frozen game.
    popup: (req: PopupRequest) => req.onPick(req.buttons[0].value),
    win: (p?: WinPayload) => {
      if (!done) done = { outcome: 'win', stat: p?.stat, seconds: t, hud };
    },
    lose: (reason?: string) => {
      if (!done) done = { outcome: 'lose', reason, seconds: t, hud };
    },
  };

  const clock = new FakeClock();
  clock.install();
  const game = create(api);
  game.start?.();

  while (t < maxSeconds && !done) {
    rec.clear();
    game.draw();
    bot(input, t, api, rec);
    game.update(dt);
    input.endFrame();
    t += dt;
    clock.advance(t);
  }
  return done ?? { outcome: 'timeout', seconds: t, hud };
}

export function runs(
  n: number,
  fn: () => SimResult,
): { win: number; lose: number; timeout: number; samples: SimResult[] } {
  const samples: SimResult[] = [];
  let win = 0;
  let lose = 0;
  let timeout = 0;
  for (let i = 0; i < n; i++) {
    const r = fn();
    samples.push(r);
    if (r.outcome === 'win') win++;
    else if (r.outcome === 'lose') lose++;
    else timeout++;
  }
  return { win, lose, timeout, samples };
}
