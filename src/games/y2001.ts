import type { GameApi, MiniGame } from '../core/types';
import { Script, clamp, fill, roundRect, text } from './helpers';

interface Need {
  key: string;
  label: string;
  value: number;
  drain: number;
}

interface Thing {
  key: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  gone?: boolean;
}

const BASE_ROUND = 50;

/** 2001 — a simulation of having a life, which turns out to be admin. */
export function create2001(api: GameApi): MiniGame {
  let t = 0;
  let using = 0;
  const ROUND = api.diff.time(BASE_ROUND);
  let target: Thing | null = null;
  const needs: Need[] = [
    { key: 'hunger', label: 'HUNGER', value: 0.8, drain: 0.035 },
    { key: 'bladder', label: 'BLADDER', value: 0.9, drain: 0.045 },
    { key: 'fun', label: 'FUN', value: 0.7, drain: 0.03 },
  ];
  const things: Thing[] = [
    { key: 'hunger', label: 'FRIDGE', x: 0.08, y: 0.18, w: 0.2, h: 0.3 },
    { key: 'bladder', label: 'BATHROOM', x: 0.72, y: 0.18, w: 0.2, h: 0.3 },
    { key: 'fun', label: 'TELEVISION', x: 0.08, y: 0.58, w: 0.26, h: 0.22 },
  ];
  const person = { x: 0.5, y: 0.52 };

  const rect = (th: Thing) => ({
    x: th.x * api.w,
    y: th.y * api.h,
    w: th.w * api.w,
    h: th.h * api.h,
  });

  const script = new Script(
    [
    {
      at: 14,
      warn: 'You seem to be coping.',
      run: () => {
        needs.push({ key: 'social', label: 'VALIDATION', value: 0.9, drain: 0.05 });
        things.push({ key: 'social', label: 'PHONE', x: 0.66, y: 0.6, w: 0.22, h: 0.2 });
        api.shout('NEW NEED\nUNLOCKED');
      },
    },
    {
      at: 26,
      run: () => {
        const fridge = things.find((x) => x.key === 'hunger');
        if (fridge) fridge.gone = true;
        api.say('The fridge is part of the expansion pack. Sorry.');
      },
    },
    {
      at: 34,
      run: () => {
        needs.forEach((n) => (n.drain *= 1.7));
        api.shout('EVERYTHING AT ONCE');
      },
    },
    {
      at: 42,
      run: () => {
        const fridge = things.find((x) => x.key === 'hunger');
        if (fridge) fridge.gone = false;
        api.say('The fridge is back. We are not going to explain.');
      },
    },
    ],
    { say: api.say, grace: api.diff.grace },
  );

  return {
    start() {
      api.hud('KEEP EVERY BAR ABOVE ZERO');
    },

    update(dt) {
      t += dt;
      script.update(t);

      if (api.input.pointerEdge || api.input.tapped) {
        const hit = things.find((th) => {
          if (th.gone) return false;
          const r = rect(th);
          return (
            api.input.pointerX > r.x &&
            api.input.pointerX < r.x + r.w &&
            api.input.pointerY > r.y &&
            api.input.pointerY < r.y + r.h
          );
        });
        if (hit) {
          target = hit;
          api.audio.blip(700, 0.06, 'sine', 0.16, 980);
        }
      }

      if (target) {
        const r = rect(target);
        const tx = (r.x + r.w / 2) / api.w;
        const ty = (r.y + r.h) / api.h;
        const dx = tx - person.x;
        const dy = ty - person.y;
        const d = Math.hypot(dx, dy);
        if (d > 0.04) {
          person.x += (dx / d) * 0.32 * dt;
          person.y += (dy / d) * 0.32 * dt;
        } else {
          const need = needs.find((n) => n.key === target!.key);
          if (need) {
            need.value = clamp(need.value + 0.75 * dt, 0, 1);
            using = 0.2;
            if (need.value >= 1) target = null;
          } else target = null;
        }
      }
      using = Math.max(0, using - dt);

      for (const n of needs) {
        n.value -= api.diff.pace(n.drain) * dt;
        if (n.value <= 0) {
          api.lose(`${n.label} reached zero. The neighbours are talking.`);
          return;
        }
      }

      if (t >= ROUND) {
        api.win({ stat: `${Math.round(ROUND)}s OF BASIC MAINTENANCE` });
        return;
      }
      api.hud(`${Math.max(0, ROUND - t).toFixed(0)}s LEFT`);
    },

    draw() {
      const { ctx } = api;
      fill(api);

      // the room
      ctx.strokeStyle = api.colors.fg;
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.35;
      ctx.strokeRect(api.w * 0.04, api.h * 0.12, api.w * 0.92, api.h * 0.74);
      ctx.globalAlpha = 1;

      things.forEach((th) => {
        if (th.gone) return;
        const r = rect(th);
        ctx.fillStyle = api.colors.fg;
        roundRect(ctx, r.x, r.y, r.w, r.h, 6);
        ctx.fill();
        ctx.fillStyle = api.colors.bg;
        ctx.fillRect(r.x + r.w * 0.15, r.y + r.h * 0.12, r.w * 0.7, r.h * 0.3);
        text(api, th.label, r.x + r.w / 2, r.y + r.h + 14, Math.min(13, api.w / 28), {
          alpha: 0.6,
          kind: 'ui',
        });
      });

      // the person
      const px = person.x * api.w;
      const py = person.y * api.h;
      ctx.fillStyle = api.colors.accent;
      ctx.fillRect(px - 11, py - 36, 22, 30);
      ctx.beginPath();
      ctx.arc(px, py - 44, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(px - 9, py - 8, 7, 12);
      ctx.fillRect(px + 2, py - 8, 7, 12);
      if (using > 0) text(api, '✦', px, py - 66, 20, { color: api.colors.warn });

      // need bars
      const bw = api.w * 0.86;
      needs.forEach((n, i) => {
        const y = api.h * 0.9 + i * 0 + (i - (needs.length - 1) / 2) * 0;
        const bx = api.w * 0.07;
        const by = api.h * 0.88 - (needs.length - 1 - i) * 22;
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = api.colors.fg;
        ctx.fillRect(bx, by, bw, 12);
        ctx.globalAlpha = 1;
        ctx.fillStyle = n.value < 0.3 ? api.colors.accent : api.colors.fg;
        ctx.fillRect(bx, by, bw * clamp(n.value, 0, 1), 12);
        text(api, n.label, bx, by - 8, 11, { align: 'left', kind: 'ui', alpha: 0.6 });
        void y;
      });
    },
  } satisfies MiniGame;
}
