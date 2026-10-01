export type VirtualButton = 'left' | 'right' | 'up' | 'down' | 'action';
export type Dir = 'left' | 'right' | 'up' | 'down';

interface Finger {
  id: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  t0: number;
  moved: number;
}

/** How far the finger may stray from its anchor before the anchor follows it. */
const LEASH = 56;
/** Distance that counts as one swipe step. */
const SWIPE_STEP = 38;
const TAP_MS = 280;
const TAP_SLOP = 14;

/**
 * One keyboard/mouse/touch snapshot shared by every minigame.
 *
 * Touch is the interesting half. A finger pressed on the playfield becomes a
 * floating joystick whose anchor trails the finger, so a direction change costs
 * a flick rather than a trip back across the screen. The same gesture also
 * reports discrete swipe steps (for grid games) and quick taps (for firing),
 * and a second finger is always available as a plain button.
 */
export class Input {
  private held = new Set<string>();
  private edge = new Set<string>();
  private virtual = new Set<VirtualButton>();
  private virtualEdge = new Set<VirtualButton>();
  private fingers = new Map<number, Finger>();
  private primary: number | null = null;

  pointerX = 0;
  pointerY = 0;
  pointerDown = false;
  pointerEdge = false;
  /** Total presses ever, for the BUTTON MASHER achievement. */
  presses = 0;
  /** True where the main pointer is a finger. */
  coarse = false;

  private anchorX = 0;
  private anchorY = 0;
  private swipeX = 0;
  private swipeY = 0;
  private tapEdge = false;
  private swipeDir: Dir | null = null;
  private secondEdge = false;

  private el: HTMLElement | null = null;

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    this.held.add(e.code);
    this.edge.add(e.code);
    this.presses++;
  };
  private onKeyUp = (e: KeyboardEvent) => this.held.delete(e.code);
  private onBlur = () => {
    this.held.clear();
    this.virtual.clear();
    this.fingers.clear();
    this.primary = null;
    this.pointerDown = false;
  };

  attach(el: HTMLElement) {
    this.el = el;
    this.coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    el.addEventListener('pointerdown', this.handleDown);
    el.addEventListener('pointermove', this.handleMove);
    window.addEventListener('pointerup', this.handleUp);
    window.addEventListener('pointercancel', this.handleUp);
  }

  detach() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.el?.removeEventListener('pointerdown', this.handleDown);
    this.el?.removeEventListener('pointermove', this.handleMove);
    window.removeEventListener('pointerup', this.handleUp);
    window.removeEventListener('pointercancel', this.handleUp);
    this.el = null;
  }

  private local(e: PointerEvent) {
    const r = this.el?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  }

  private handleDown = (e: PointerEvent) => {
    const { x, y } = this.local(e);
    this.fingers.set(e.pointerId, { id: e.pointerId, x, y, startX: x, startY: y, t0: performance.now(), moved: 0 });
    this.presses++;
    if (this.primary === null) {
      this.primary = e.pointerId;
      this.pointerX = x;
      this.pointerY = y;
      this.anchorX = x;
      this.anchorY = y;
      this.swipeX = x;
      this.swipeY = y;
      this.pointerDown = true;
      this.pointerEdge = true;
      this.el?.setPointerCapture?.(e.pointerId);
    } else {
      // Any further finger is a button. That is the whole two-finger fallback.
      this.secondEdge = true;
    }
  };

  private handleMove = (e: PointerEvent) => {
    const f = this.fingers.get(e.pointerId);
    if (!f) return;
    const { x, y } = this.local(e);
    f.moved += Math.hypot(x - f.x, y - f.y);
    f.x = x;
    f.y = y;
    if (e.pointerId !== this.primary) return;

    this.pointerX = x;
    this.pointerY = y;

    // The anchor trails the finger, so reversing direction is immediate.
    const dx = x - this.anchorX;
    const dy = y - this.anchorY;
    const d = Math.hypot(dx, dy);
    if (d > LEASH) {
      const k = 1 - LEASH / d;
      this.anchorX += dx * k;
      this.anchorY += dy * k;
    }

    // Discrete swipe steps, one per SWIPE_STEP of travel on the dominant axis.
    const sx = x - this.swipeX;
    const sy = y - this.swipeY;
    if (Math.abs(sx) > SWIPE_STEP && Math.abs(sx) > Math.abs(sy)) {
      this.swipeDir = sx > 0 ? 'right' : 'left';
      this.swipeX = x;
      this.swipeY = y;
    } else if (Math.abs(sy) > SWIPE_STEP && Math.abs(sy) > Math.abs(sx)) {
      this.swipeDir = sy > 0 ? 'down' : 'up';
      this.swipeX = x;
      this.swipeY = y;
    }
  };

  private handleUp = (e: PointerEvent) => {
    const f = this.fingers.get(e.pointerId);
    this.fingers.delete(e.pointerId);
    if (e.pointerId !== this.primary) return;
    if (f && performance.now() - f.t0 < TAP_MS && f.moved < TAP_SLOP) this.tapEdge = true;
    this.pointerDown = false;
    this.primary = null;
    // Promote a finger that is still down, so lifting the first does not strand the game.
    const next = this.fingers.values().next().value;
    if (next) {
      this.primary = next.id;
      this.pointerX = next.x;
      this.pointerY = next.y;
      this.anchorX = next.x;
      this.anchorY = next.y;
      this.swipeX = next.x;
      this.swipeY = next.y;
      this.pointerDown = true;
    }
  };

  setVirtual(btn: VirtualButton, on: boolean) {
    if (on) {
      if (!this.virtual.has(btn)) {
        this.virtualEdge.add(btn);
        this.presses++;
      }
      this.virtual.add(btn);
    } else {
      this.virtual.delete(btn);
    }
  }

  down(...codes: string[]) {
    return codes.some((c) => this.held.has(c));
  }
  justPressed(...codes: string[]) {
    return codes.some((c) => this.edge.has(c));
  }

  get left() {
    return this.down('ArrowLeft', 'KeyA') || this.virtual.has('left');
  }
  get right() {
    return this.down('ArrowRight', 'KeyD') || this.virtual.has('right');
  }
  get up() {
    return this.down('ArrowUp', 'KeyW') || this.virtual.has('up');
  }
  get downKey() {
    return this.down('ArrowDown', 'KeyS') || this.virtual.has('down');
  }
  /** Keyboard only: -1, 0 or 1. */
  get axisX() {
    return (this.right ? 1 : 0) - (this.left ? 1 : 0);
  }
  get axisY() {
    return (this.downKey ? 1 : 0) - (this.up ? 1 : 0);
  }

  /** Joystick offset, -1 to 1, from the trailing anchor. */
  get joyX() {
    return this.pointerDown ? clamp((this.pointerX - this.anchorX) / LEASH, -1, 1) : 0;
  }
  get joyY() {
    return this.pointerDown ? clamp((this.pointerY - this.anchorY) / LEASH, -1, 1) : 0;
  }

  /** Keyboard axis, or the touch joystick. Analogue. */
  get moveX() {
    return this.axisX || deadzone(this.joyX);
  }
  get moveY() {
    return this.axisY || deadzone(this.joyY);
  }

  /** Same, but snapped to one dominant direction — for anything on a grid. */
  get dirX() {
    if (this.axisX) return this.axisX;
    const x = deadzone(this.joyX, 0.42);
    return Math.abs(this.joyX) >= Math.abs(this.joyY) ? Math.sign(x) : 0;
  }
  get dirY() {
    if (this.axisY) return this.axisY;
    const y = deadzone(this.joyY, 0.42);
    return Math.abs(this.joyY) > Math.abs(this.joyX) ? Math.sign(y) : 0;
  }

  /** A quick touch that did not drag. The universal "do the thing" gesture. */
  get tapped() {
    return this.tapEdge;
  }
  /** A finger put down while another was already steering. */
  get secondTap() {
    return this.secondEdge;
  }
  /** One step of a swipe, repeating while the finger keeps travelling. */
  get swipe(): Dir | null {
    return this.swipeDir;
  }

  get action() {
    return this.down('Space', 'KeyZ', 'Enter') || this.virtual.has('action') || this.pointerDown;
  }
  get actionPressed() {
    return (
      this.justPressed('Space', 'KeyZ', 'Enter') ||
      this.virtualEdge.has('action') ||
      this.pointerEdge
    );
  }
  /** Fire that ignores dragging: keys, a tap, or a second finger. */
  get firePressed() {
    return this.actionKeyPressed || this.tapEdge || this.secondEdge;
  }
  get actionKeyPressed() {
    return this.justPressed('Space', 'KeyZ', 'Enter') || this.virtualEdge.has('action');
  }
  get upPressed() {
    return this.justPressed('ArrowUp', 'KeyW', 'Space') || this.virtualEdge.has('up');
  }
  /** Jump: a key, a flick upwards, a tap, or a second finger while running. */
  get jumpPressed() {
    return this.upPressed || this.tapEdge || this.secondEdge || this.swipeDir === 'up';
  }

  endFrame() {
    this.edge.clear();
    this.virtualEdge.clear();
    this.pointerEdge = false;
    this.tapEdge = false;
    this.secondEdge = false;
    this.swipeDir = null;
  }
}

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const deadzone = (v: number, dz = 0.22) => (Math.abs(v) < dz ? 0 : v);

const GAME_KEYS = new Set([
  'Space',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
]);
