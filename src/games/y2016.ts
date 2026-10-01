import type { GameApi, MiniGame } from '../core/types';
import { Script, circle, clamp, fill, rand, text } from './helpers';

/** 2016 — the one that made everyone walk into traffic, indoors. */
export function create2016(api: GameApi): MiniGame {
  let t = 0;
  let caught = 0;
  let misses = 0;
  let ar = false;
  let fleeing = 0;
  let serverDone = false;
  let paused = false;
  const creature = { x: 0.5, y: 0.38, hop: 0, vx: 0 };
  const ball = { x: 0, y: 0, vx: 0, vy: 0, flying: false };
  let aim: { x: number; y: number } | null = null;

  const script = new Script([
    { at: 6, run: () => api.say('It is a sphere with a face. Nobody questioned it.') },
    {
      at: 14,
      run: () => {
        ar = true;
        api.shout('AR MODE ON');
        api.say('Now it is in your living room, and much harder to hit.');
      },
    },
    {
      at: 26,
      run: () => {
        if (serverDone) return;
        serverDone = true;
        paused = true;
        api.popup({
          title: 'SERVERS BUSY',
          lines: ['Fourteen million people had the same idea.', 'Please try again shortly.'],
          buttons: [{ label: 'TRY AGAIN', value: 'ok', primary: true }],
          onPick: () => {
            paused = false;
            api.say('You are back. It waited for you. It is not very bright.');
          },
        });
      },
    },
  ]);

  return {
    start() {
      ball.x = api.w / 2;
      ball.y = api.h * 0.86;
    },

    update(dt) {
      if (paused) return;
      t += dt;
      script.update(t);

      // the creature hops about
      creature.hop += dt * (ar ? 3.4 : 2.2);
      creature.x += creature.vx * dt;
      if (creature.x < 0.15 || creature.x > 0.85) creature.vx *= -1;
      if (Math.random() < (ar ? 1.4 : 0.6) * dt) creature.vx = rand(-0.3, 0.3);
      if (fleeing > 0) {
        fleeing -= dt;
        creature.y = 0.38 - Math.sin(clamp(fleeing, 0, 1) * Math.PI) * 0.1;
      }

      // aim with a drag, release to throw
      if (api.input.pointerDown && !ball.flying) {
        aim = { x: api.input.pointerX, y: api.input.pointerY };
      } else if (aim && !api.input.pointerDown && !ball.flying) {
        const dx = aim.x - ball.x;
        const dy = aim.y - ball.y;
        ball.vx = dx * 2.1;
        ball.vy = dy * 2.1;
        ball.flying = true;
        aim = null;
        api.audio.blip(500, 0.08, 'sine', 0.18, 900);
      }

      if (ball.flying) {
        ball.vy += api.h * 0.9 * dt;
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;
        const cx = creature.x * api.w;
        const cy = creature.y * api.h + Math.abs(Math.sin(creature.hop)) * -18;
        if (Math.hypot(ball.x - cx, ball.y - cy) < Math.min(api.w, api.h) * 0.09) {
          caught++;
          fleeing = 1;
          api.audio.jingle([72, 76, 79], 0.07, 'sine');
          api.shout(caught >= 3 ? 'CAUGHT' : 'GOTCHA');
          ball.flying = false;
          ball.x = api.w / 2;
          ball.y = api.h * 0.86;
          ball.vx = ball.vy = 0;
          if (caught >= 3) {
            window.setTimeout(() => api.win({ stat: `3 CAUGHT, ${misses} THROWN AWAY` }), 1200);
            return;
          }
        } else if (ball.y > api.h + 40 || ball.x < -40 || ball.x > api.w + 40) {
          misses++;
          ball.flying = false;
          ball.x = api.w / 2;
          ball.y = api.h * 0.86;
          ball.vx = ball.vy = 0;
          if (misses >= 14) {
            api.lose('Out of spheres. It is still there, judging you.');
            return;
          }
        }
      }

      api.hud(`CAUGHT ${caught}/3    THROWN ${misses + caught}`);
    },

    draw() {
      const { ctx } = api;
      fill(api);

      // a map, or a camera view pretending to be one
      ctx.globalAlpha = ar ? 0.08 : 0.16;
      ctx.fillStyle = api.colors.fg;
      const jitter = ar ? Math.sin(t * 30) * 2 : 0;
      for (let i = 0; i < 9; i++) {
        ctx.fillRect(api.w * 0.05 + jitter, api.h * (0.12 + i * 0.09), api.w * 0.9, 2);
      }
      for (let i = 0; i < 6; i++) {
        ctx.fillRect(api.w * (0.08 + i * 0.17) + jitter, api.h * 0.12, 2, api.h * 0.76);
      }
      ctx.globalAlpha = 1;
      if (ar) {
        text(api, 'AR', api.w - 26, 24, 14, { kind: 'mono', alpha: 0.5, align: 'right' });
      }

      // creature
      const cx = creature.x * api.w;
      const cy = creature.y * api.h + Math.abs(Math.sin(creature.hop)) * -18;
      const r = Math.min(api.w, api.h) * 0.085;
      ctx.save();
      ctx.globalAlpha = fleeing > 0 ? 0.4 : 1;
      ctx.fillStyle = api.colors.accent;
      circle(ctx, cx, cy, r);
      ctx.fill();
      ctx.fillStyle = api.colors.bg;
      circle(ctx, cx - r * 0.33, cy - r * 0.18, r * 0.17);
      ctx.fill();
      circle(ctx, cx + r * 0.33, cy - r * 0.18, r * 0.17);
      ctx.fill();
      ctx.fillRect(cx - r * 0.26, cy + r * 0.28, r * 0.52, r * 0.1);
      // ears, because everything in this genre has ears
      ctx.fillStyle = api.colors.accent;
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.7, cy - r * 0.55);
      ctx.lineTo(cx - r * 0.2, cy - r * 0.95);
      ctx.lineTo(cx - r * 0.15, cy - r * 0.35);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx + r * 0.7, cy - r * 0.55);
      ctx.lineTo(cx + r * 0.2, cy - r * 0.95);
      ctx.lineTo(cx + r * 0.15, cy - r * 0.35);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // aim line
      if (aim) {
        ctx.strokeStyle = api.colors.fg;
        ctx.globalAlpha = 0.4;
        ctx.setLineDash([6, 8]);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(ball.x, ball.y);
        ctx.lineTo(aim.x, aim.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }

      // the sphere
      const br = Math.min(api.w, api.h) * 0.042;
      ctx.fillStyle = api.colors.fg;
      circle(ctx, ball.x, ball.y, br);
      ctx.fill();
      ctx.fillStyle = api.colors.bg;
      ctx.fillRect(ball.x - br, ball.y - br * 0.18, br * 2, br * 0.36);
      circle(ctx, ball.x, ball.y, br * 0.3);
      ctx.fill();

      if (!ball.flying && !aim && t < 6) {
        text(api, 'DRAG FROM THE BALL AND LET GO', api.w / 2, api.h * 0.94, Math.min(14, api.w / 26), {
          alpha: 0.5,
          kind: 'ui',
        });
      }
    },
  } satisfies MiniGame;
}
