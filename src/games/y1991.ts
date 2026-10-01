import type { GameApi, MiniGame } from '../core/types';
import { Script, circle, fill, text } from './helpers';

const WORLD_H = 560;
const GOAL = 7200;

interface Thing {
  x: number;
  y: number;
  kind: 'ring' | 'spike' | 'loop';
  taken?: boolean;
}

/** 1991 — the one about going fast. Mostly it goes fast at you. */
export function create1991(api: GameApi): MiniGame {
  let t = 0;
  let rings = 0;
  let speed = 0;
  let looping = 0;
  let rolling = false;
  let hurt = 0;
  const player = { x: 120, y: 380, vy: 0, onGround: true };
  const ground = 440;
  const things: Thing[] = [];

  let seed = 1991;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  const build = () => {
    for (let x = 500; x < GOAL; x += 90) {
      const r = rnd();
      // The opening stretch is rings only: a spike at zero rings is instant death.
      if (r < 0.14 && x > 1500) things.push({ x, y: ground - 24, kind: 'spike' });
      else if (r < 0.2) things.push({ x, y: ground - 120, kind: 'loop' });
      else if (r < 0.75) {
        const arc = rnd() < 0.4;
        for (let i = 0; i < 4; i++) {
          things.push({ x: x + i * 34, y: arc ? ground - 90 - Math.sin((i / 3) * Math.PI) * 70 : ground - 70, kind: 'ring' });
        }
      }
    }
  };

  const script = new Script(
    [
      { at: 9, when: () => rings >= 8, warn: 'Collecting, are we.', run: () => { speed = api.diff.pace(560); api.shout('FASTER'); } },
      { at: 18, when: () => rings >= 20, run: () => { speed = api.diff.pace(700); api.say('This is the part the adverts showed.'); } },
      { at: 27, when: () => rings >= 34, warn: 'Hold on.', run: () => { speed = api.diff.pace(880); api.shout('TOO FAST'); api.audio.blip(300, 0.4, 'sawtooth', 0.25, 900); } },
      { at: 36, run: () => api.say('You can let go now. It will not help.') },
    ],
    { say: api.say, grace: api.diff.grace },
  );

  return {
    start() {
      speed = api.diff.pace(430);
      build();
    },

    update(dt) {
      t += dt;
      script.update(t);
      hurt = Math.max(0, hurt - dt);
      if (looping > 0) looping -= dt;

      player.x += speed * dt * (looping > 0 ? 1.4 : 1);
      rolling = api.input.pointerDown && !player.onGround;

      if (api.input.jumpPressed && player.onGround) {
        player.vy = -720;
        player.onGround = false;
        api.audio.blip(620, 0.1, 'square', 0.2, 1100);
      }
      player.vy += 2100 * dt;
      player.y += player.vy * dt;
      if (player.y >= ground - 30) {
        player.y = ground - 30;
        player.vy = 0;
        player.onGround = true;
      }

      for (const o of things) {
        if (o.taken || Math.abs(o.x - player.x) > 40) continue;
        if (o.kind === 'ring' && Math.hypot(o.x - player.x - 12, o.y - player.y - 14) < 32) {
          o.taken = true;
          rings++;
          api.audio.blip(900 + (rings % 5) * 60, 0.07, 'triangle', 0.18, 1500);
        }
        if (o.kind === 'loop' && Math.abs(o.x - player.x) < 20 && looping <= 0) {
          looping = 0.9;
          api.audio.blip(300, 0.5, 'square', 0.2, 1400);
        }
        if (
          o.kind === 'spike' &&
          !hurt &&
          looping <= 0 &&
          Math.abs(o.x - player.x - 12) < 24 &&
          player.y + 30 > o.y
        ) {
          if (script.mercy) continue;
          hurt = 1.4;
          api.audio.noise(0.3, 0.3, 900);
          if (rings === 0) {
            api.lose('No rings left to scatter.');
            return;
          }
          rings = Math.max(0, rings - api.diff.goal(12));
          api.shout('RINGS EVERYWHERE');
        }
      }

      if (player.x > GOAL) {
        api.win({ stat: `${rings} RINGS AT ${speed} PX/S`, score: rings });
        return;
      }
      api.hud(`RINGS ${rings}    ${Math.round((player.x / GOAL) * 100)}%`);
    },

    draw() {
      const { ctx } = api;
      fill(api);
      const s = Math.min(api.h / WORLD_H, api.w / 620);
      const camX = player.x - api.w / s / 3;
      ctx.save();
      ctx.translate(0, api.h - WORLD_H * s);
      ctx.scale(s, s);
      ctx.translate(-camX, 0);

      // checkered ground, the signature of the era
      ctx.fillStyle = api.colors.fg;
      const cell = 28;
      const startX = Math.floor(camX / cell) * cell;
      for (let x = startX; x < camX + api.w / s + cell; x += cell) {
        for (let r = 0; r < 3; r++) {
          if ((Math.floor(x / cell) + r) % 2 === 0) continue;
          ctx.globalAlpha = 0.25 - r * 0.06;
          ctx.fillRect(x, ground + r * cell, cell, cell);
        }
      }
      ctx.globalAlpha = 1;
      ctx.fillRect(camX, ground, api.w / s + 10, 5);

      things.forEach((o) => {
        if (o.x < camX - 60 || o.x > camX + api.w / s + 60) return;
        if (o.kind === 'ring') {
          if (o.taken) return;
          ctx.strokeStyle = api.colors.warn;
          ctx.lineWidth = 5;
          circle(ctx, o.x, o.y, 13);
          ctx.stroke();
        } else if (o.kind === 'spike') {
          ctx.fillStyle = api.colors.accent;
          ctx.beginPath();
          ctx.moveTo(o.x - 16, ground);
          ctx.lineTo(o.x, ground - 34);
          ctx.lineTo(o.x + 16, ground);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.strokeStyle = api.colors.fg;
          ctx.lineWidth = 8;
          ctx.globalAlpha = 0.35;
          circle(ctx, o.x, ground - 96, 92);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      });

      // the runner: a ball with legs, as the era demanded
      ctx.save();
      ctx.translate(player.x + 12, player.y + 14);
      ctx.globalAlpha = hurt > 0 && Math.floor(hurt * 20) % 2 ? 0.3 : 1;
      ctx.fillStyle = api.colors.accent;
      if (rolling || looping > 0) {
        ctx.rotate(player.x * 0.08);
        circle(ctx, 0, 0, 17);
        ctx.fill();
        ctx.fillStyle = api.colors.bg;
        ctx.fillRect(-17, -3, 34, 3);
      } else {
        circle(ctx, 0, -2, 16);
        ctx.fill();
        ctx.fillStyle = api.colors.bg;
        circle(ctx, 5, -6, 5);
        ctx.fill();
        ctx.fillStyle = api.colors.fg;
        const leg = Math.sin(t * 26) * 7;
        ctx.fillRect(-9, 12, 7, 12 + leg);
        ctx.fillRect(3, 12, 7, 12 - leg);
      }
      ctx.restore();
      ctx.restore();

      text(api, `${rings}`, 20, 30, Math.min(34, api.w / 12), { align: 'left', color: api.colors.warn });
    },
  } satisfies MiniGame;
}
