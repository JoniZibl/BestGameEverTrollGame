import type { ComponentType } from 'react';
import type { Input } from './input';
import type { AudioEngine } from './audio';

/** Visual eras the whole website steps through, not just the games. */
export type ThemeId =
  | 'oscilloscope' // 1962 — monochrome vectors, flicker
  | 'arcade'       // 1972-1980 — coarse pixels, cabinet glow
  | 'bit8'         // 1984-1985 — 8-bit palette
  | 'bit16'        // 1992-1993 — 16-bit, gradients, bevels
  | 'early3d'      // 1996 — fog, low-poly, dithering
  | 'lcd'          // 1997 — a phone screen with four shades
  | 'web2'         // 2000-2004 — glossy gradients, loading bars
  | 'flat'         // 2009-2013 — flat mobile UI
  | 'modern';      // 2017-2026 — clean, blurred, high fidelity

export interface PopupButton {
  label: string;
  value: string;
  primary?: boolean;
}

export interface PopupRequest {
  title: string;
  lines?: string[];
  price?: string;
  buttons: PopupButton[];
  onPick: (value: string) => void;
}

export interface WinPayload {
  /** One short line shown on the YEAR COMPLETE card, e.g. "SURVIVED 28s". */
  stat?: string;
  score?: number;
}

/** Everything a canvas minigame is allowed to touch. */
export interface GameApi {
  ctx: CanvasRenderingContext2D;
  /** Logical canvas size in css pixels. Re-read every frame: it changes on resize. */
  readonly w: number;
  readonly h: number;
  input: Input;
  audio: AudioEngine;
  /** Small dry caption near the top. */
  say(text: string, ms?: number): void;
  /** Huge centred statement. */
  shout(text: string, ms?: number): void;
  /** Persistent status line (score, timer, objective). */
  hud(text: string): void;
  /** Opens a DOM popup and pauses the game loop until a button is picked. */
  popup(req: PopupRequest): void;
  win(payload?: WinPayload): void;
  lose(reason?: string): void;
  /** Theme palette, already resolved from CSS. */
  colors: { bg: string; fg: string; dim: string; accent: string; warn: string };
  font(px: number, kind?: FontKind): string;
  /** True when the player is using a finger, not a mouse. */
  readonly isTouch: boolean;
}

export type FontKind = 'display' | 'pixel' | 'mono' | 'ui';

export interface MiniGame {
  /** Called once, after the canvas exists. */
  start?(): void;
  /** dt is seconds, clamped. */
  update(dt: number): void;
  draw(): void;
  /** Cleanup. Optional. */
  stop?(): void;
}

export interface ReactGameProps {
  onWin: (payload?: WinPayload) => void;
  onLose: (reason?: string) => void;
  say: (text: string, ms?: number) => void;
  shout: (text: string, ms?: number) => void;
  audio: AudioEngine;
  /** Unlocks an achievement by id. */
  grant?: (id: string) => void;
}

export type EraPlay =
  | { kind: 'canvas'; create: (api: GameApi) => MiniGame }
  | { kind: 'react'; Component: ComponentType<ReactGameProps> };

export interface EraDeepDive {
  developer: string;
  release: string;
  platform: string;
  innovation: string;
  why: string;
  funFact: string;
}

export interface Era {
  id: string;
  year: number;
  /** Shown instead of the raw year where a range reads better, e.g. "2020s". */
  label: string;
  title: string;
  /** One dry line shown before the game starts. */
  tagline: string[];
  controls: string;
  /** The same thing, said as a gesture, for phones. */
  touchControls: string;
  /** The win condition, in four or five words, shown before you start. */
  goal: string;
  theme: ThemeId;
  /** Rough length in seconds, shown on the timeline. */
  duration: number;
  fact: string;
  deepDive: EraDeepDive;
  play: EraPlay;
}
