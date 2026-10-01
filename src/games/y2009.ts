import type { GameApi, MiniGame } from '../core/types';
import { circle, clamp, fill, rand, roundRect, text } from './helpers';

interface Bubble {
  x: number;
  y: number;
  r: number;
  vy: number;
  popped: number;
}

/** 2009 — the phone era. Tap things. Run out of energy. Be told to come back tomorrow. */
export function create2009(api: GameApi): MiniGame {
  let t = 0;
  let taps = 0;
  let missed = 0;
  let energy = 10;
  let energyGagDone = false;
  let adDone = false;
  let paused = false;
  let spawn = 0;
  const bubbles: Bubble[] = [];

  const phone = () => {
    const h = api.h * 0.92;
    const w = Math.min(api.w * 0.92, h * 0.52);
    return { x: (api.w - w) / 2, y: (api.h - h) / 2, w, h };
  };

  const screen = () => {
    const p = phone();
    const m = p.w * 0.06;
    return { x: p.x + m, y: p.y + m * 1.6, w: p.w - m * 2, h: p.h - m * 3.4 };
  };

  return {
    start() {
      api.say('TAP THE BUBBLES');
    },

    update(dt) {
      if (paused) return;
      t += dt;
      const s = screen();

      spawn -= dt;
      if (spawn <= 0) {
        spawn = clamp(0.58 - t * 0.011, 0.18, 0.7);
        const r = rand(s.w * 0.08, s.w * 0.14);
        bubbles.push({ x: rand(s.x + r, s.x + s.w - r), y: s.y + s.h + r, r, vy: -rand(60, 110), popped: 0 });
      }

      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        if (b.popped) {
          b.popped += dt;
          if (b.popped > 0.3) bubbles.splice(i, 1);
          continue;
        }
        b.y += b.vy * dt;
        b.x += Math.sin(t * 2 + b.r) * 14 * dt;
        if (b.y + b.r < s.y) {
          bubbles.splice(i, 1);
          missed++;
          if (missed >= 12) {
            api.lose('Too many bubbles escaped. They are free now.');
            return;
          }
        }
      }

      if (api.input.pointerEdge) {
        const hit = bubbles.find(
          (b) => !b.popped && Math.hypot(b.x - api.input.pointerX, b.y - api.input.pointerY) < b.r * 1.15,
        );
        if (hit) {
          hit.popped = 0.01;
          taps++;
          energy -= 1;
          api.audio.blip(600 + taps * 18, 0.07, 'sine', 0.22, 900);

          if (energy <= 0 && !energyGagDone) {
            energyGagDone = true;
            paused = true;
            api.popup({
              title: 'ENERGY EMPTY',
              lines: ['Your lives will refill over time.', 'Or you can wait.'],
              buttons: [
                { label: 'WAIT 7 HOURS', value: 'wait', primary: true },
                { label: 'BUY 5 LIVES', value: 'buy' },
              ],
              onPick: () => {
                energy = 30;
                paused = false;
                api.shout('JUST KIDDING');
                api.say('Keep playing. We would not actually do that to you.');
                api.audio.jingle([72, 76, 79], 0.07, 'sine');
              },
            });
          }
          if (taps === 14) {
            paused = true;
            api.popup({
              title: 'ENJOYING THE GAME?',
              lines: ['Rate us five stars.', 'There is no other option. We checked.'],
              buttons: [{ label: '★★★★★', value: 'yes', primary: true }],
              onPick: () => {
                paused = false;
                api.say('Thank you. Your review has been pre-written.');
              },
            });
          }
          if (taps === 22 && !adDone) {
            adDone = true;
            paused = true;
            api.popup({
              title: 'AD',
              lines: ['A different game would like your attention.', 'It is the same game.'],
              buttons: [
                { label: 'CLOSE \u2715', value: 'x', primary: true },
                { label: 'INSTALL', value: 'i' },
              ],
              onPick: () => {
                paused = false;
                api.say('That was 4 seconds of your life. Monetised.');
              },
            });
          }
          if (taps >= 30) {
            api.win({ stat: `${taps} TAPS, ${missed} ESCAPED`, score: taps });
            return;
          }
        }
      }

      api.hud(`POPPED ${taps}/30    ENERGY ${Math.max(0, energy)}`);
    },

    draw() {
      const { ctx } = api;
      fill(api);
      const p = phone();
      const s = screen();

      ctx.save();
      ctx.fillStyle = api.colors.fg;
      roundRect(ctx, p.x, p.y, p.w, p.h, p.w * 0.1);
      ctx.fill();
      ctx.fillStyle = api.colors.bg;
      roundRect(ctx, s.x, s.y, s.w, s.h, p.w * 0.03);
      ctx.fill();
      ctx.restore();

      ctx.save();
      roundRect(ctx, s.x, s.y, s.w, s.h, p.w * 0.03);
      ctx.clip();

      bubbles.forEach((b) => {
        ctx.save();
        if (b.popped) {
          ctx.globalAlpha = clamp(1 - b.popped * 3.4, 0, 1);
          ctx.strokeStyle = api.colors.accent;
          ctx.lineWidth = 3;
          circle(ctx, b.x, b.y, b.r * (1 + b.popped * 2.6));
          ctx.stroke();
        } else {
          ctx.fillStyle = api.colors.accent;
          circle(ctx, b.x, b.y, b.r);
          ctx.fill();
          ctx.globalAlpha = 0.35;
          ctx.fillStyle = api.colors.bg;
          circle(ctx, b.x - b.r * 0.3, b.y - b.r * 0.32, b.r * 0.28);
          ctx.fill();
        }
        ctx.restore();
      });
      ctx.restore();

      // status bar inside the phone
      text(api, '●●●○○  9:41  ■ 14%', s.x + s.w / 2, s.y + 14, 12, {
        kind: 'ui',
        alpha: 0.5,
      });

      // energy pips
      const pips = Math.max(0, Math.min(10, energy));
      for (let i = 0; i < 10; i++) {
        ctx.globalAlpha = i < pips ? 0.9 : 0.15;
        ctx.fillStyle = api.colors.fg;
        ctx.fillRect(s.x + 10 + i * (s.w - 20) / 10, s.y + s.h - 16, (s.w - 20) / 10 - 4, 6);
      }
      ctx.globalAlpha = 1;

      // home button
      ctx.strokeStyle = api.colors.bg;
      ctx.lineWidth = 2;
      circle(ctx, p.x + p.w / 2, p.y + p.h - p.w * 0.07, p.w * 0.045);
      ctx.stroke();
    },
  } satisfies MiniGame;
}
