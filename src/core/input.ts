export type VirtualButton = 'left' | 'right' | 'up' | 'down' | 'action';

/**
 * One keyboard/mouse/touch snapshot shared by every minigame.
 * Edge state ("just pressed") is cleared by the host at the end of each frame.
 */
export class Input {
  private held = new Set<string>();
  private edge = new Set<string>();
  private virtual = new Set<VirtualButton>();
  private virtualEdge = new Set<VirtualButton>();

  pointerX = 0;
  pointerY = 0;
  pointerDown = false;
  pointerEdge = false;
  /** Total presses ever, for the BUTTON MASHER achievement. */
  presses = 0;

  private el: HTMLElement | null = null;
  private onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    this.held.add(e.code);
    this.edge.add(e.code);
    this.presses++;
  };
  private onKeyUp = (e: KeyboardEvent) => {
    this.held.delete(e.code);
  };
  private onBlur = () => {
    this.held.clear();
    this.virtual.clear();
    this.pointerDown = false;
  };

  attach(el: HTMLElement) {
    this.el = el;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    el.addEventListener('pointerdown', this.handlePointerDown);
    el.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
  }

  detach() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.el?.removeEventListener('pointerdown', this.handlePointerDown);
    this.el?.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
    this.el = null;
  }

  private mapPointer(e: PointerEvent) {
    if (!this.el) return;
    const r = this.el.getBoundingClientRect();
    this.pointerX = e.clientX - r.left;
    this.pointerY = e.clientY - r.top;
  }

  private handlePointerDown = (e: PointerEvent) => {
    this.mapPointer(e);
    this.pointerDown = true;
    this.pointerEdge = true;
    this.presses++;
  };
  private handlePointerMove = (e: PointerEvent) => this.mapPointer(e);
  private handlePointerUp = () => {
    this.pointerDown = false;
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
  /** -1, 0 or 1. */
  get axisX() {
    return (this.right ? 1 : 0) - (this.left ? 1 : 0);
  }
  get axisY() {
    return (this.downKey ? 1 : 0) - (this.up ? 1 : 0);
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
  /** Fire that ignores the pointer, for games where dragging means "look around". */
  get actionKeyPressed() {
    return this.justPressed('Space', 'KeyZ', 'Enter') || this.virtualEdge.has('action');
  }

  get upPressed() {
    return this.justPressed('ArrowUp', 'KeyW', 'Space') || this.virtualEdge.has('up');
  }

  endFrame() {
    this.edge.clear();
    this.virtualEdge.clear();
    this.pointerEdge = false;
  }
}

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
