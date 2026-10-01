import type { GameApi, MiniGame } from '../core/types';
import { aabb, clamp, fill, text } from './helpers';

const WORLD_H = 600;
const GOAL = 3400;

interface Plat {
  x: number;
  y: number;
  w: number;
}

/** 2013 — the mechanics are fine. The business model is the obstacle. */
export function create2013(api: GameApi): MiniGame {
  let t = 0;
  let jumpUnlocked = false;
  let doubleUnlocked = false;
  let gravityPaid = true;
  let askedDouble = false;
  let askedGravity = false;
  let askedCheckpoint = false;
  let checkpointX = 40;
  let paused = false;
  let jumpsUsed = 0;
  let purchases = 0;
  const player = { x: 40, y: 380, vx: 0, vy: 0, w: 28, h: 36, onGround: false };
  const plats: Plat[] = [
    { x: -40, y: 460, w: 420 },
    { x: 470, y: 460, w: 240 },
    { x: 800, y: 400, w: 200 },
    { x: 1090, y: 460, w: 180 },
    { x: 1360, y: 330, w: 220 },
    { x: 1680, y: 460, w: 200 },
    { x: 1960, y: 430, w: 220 },
    { x: 2270, y: 350, w: 180 },
    { x: 2540, y: 440, w: 160 },
    { x: 2800, y: 320, w: 200 },
    { x: 3100, y: 430, w: 420 },
  ];

  const ask = (title: string, price: string, lines: string[], unlock: () => void) => {
    paused = true;
    api.audio.blip(900, 0.12, 'sine', 0.2);
    api.popup({
      title,
      price,
      lines,
      buttons: [
        { label: `BUY ${price}`, value: 'buy', primary: true },
        { label: 'NO THANKS', value: 'no' },
      ],
      onPick: (v) => {
        paused = false;
        if (v === 'buy') purchases++;
        unlock();
        api.say("Relax. We're not actually charging you.");
      },
    });
  };

  return {
    start() {
      api.say('MOVE: ← →   JUMP: SPACE');
    },

    update(dt) {
      if (paused) return;
      t += dt;

      player.vx = api.input.axisX * 270;
      const wantsJump = api.input.upPressed || api.input.actionPressed;

      if (wantsJump && !jumpUnlocked) {
        ask('JUMP PACK', '€2.99', ['Unlock the ability to jump.', 'A core feature, now with ownership.'], () => {
          jumpUnlocked = true;
          player.vy = -690;
        });
        return;
      }

      if (wantsJump && jumpUnlocked) {
        if (player.onGround) {
          player.vy = -690;
          jumpsUsed++;
          api.audio.blip(430, 0.09, 'square', 0.18, 780);
        } else if (!doubleUnlocked && !askedDouble && player.vy > -200) {
          askedDouble = true;
          ask('DOUBLE JUMP', '€4.99', ['Jump again, mid-air.', 'Physically impossible. Commercially essential.'], () => {
            doubleUnlocked = true;
            player.vy = -620;
          });
          return;
        } else if (doubleUnlocked && jumpsUsed % 2 === 1) {
          player.vy = -620;
          jumpsUsed++;
          api.audio.blip(520, 0.09, 'square', 0.18, 880);
        }
      }

      if (!askedCheckpoint && player.x > 1900) {
        askedCheckpoint = true;
        ask('CHECKPOINT PACK', '\u20ac1.99', ['Save your progress here.', 'Progress is a premium feature.'], () => {
          checkpointX = player.x;
        });
        return;
      }

      if (!askedGravity && t > 14) {
        askedGravity = true;
        gravityPaid = false;
        ask('GRAVITY', '€0.99 / MONTH', ['Your gravity subscription has lapsed.', 'Renew to continue falling normally.'], () => {
          gravityPaid = true;
        });
        return;
      }

      player.vy += (gravityPaid ? 1900 : 280) * dt;
      player.x += player.vx * dt;
      player.y += player.vy * dt;
      player.onGround = false;
      for (const p of plats) {
        if (
          aabb({ x: player.x, y: player.y, w: player.w, h: player.h }, { x: p.x, y: p.y, w: p.w, h: 40 }) &&
          player.vy >= 0 &&
          player.y + player.h - player.vy * dt <= p.y + 14
        ) {
          player.y = p.y - player.h;
          player.vy = 0;
          player.onGround = true;
          jumpsUsed = 0;
        }
      }

      if (player.y > WORLD_H + 100) {
        player.x = Math.max(checkpointX, player.x - 320);
        player.y = 200;
        player.vy = 0;
        api.say('Respawn is free. For now.');
      }

      if (player.x > GOAL) {
        api.win({
          stat: purchases === 0 ? 'ZERO PURCHASES MADE' : `${purchases} IMAGINARY PURCHASES`,
        });
        return;
      }

      api.hud(
        `${Math.round(clamp((player.x / GOAL) * 100, 0, 100))}%    OWNED: ${[
          jumpUnlocked && 'JUMP',
          doubleUnlocked && 'DOUBLE JUMP',
          gravityPaid && 'GRAVITY',
        ]
          .filter(Boolean)
          .join(', ') || 'NOTHING'}`,
      );
    },

    draw() {
      const { ctx } = api;
      fill(api);
      const s = api.h / WORLD_H;
      const camX = clamp(player.x - api.w / s / 2.6, 0, GOAL);
      ctx.save();
      ctx.scale(s, s);
      ctx.translate(-camX, 0);

      ctx.fillStyle = api.colors.fg;
      plats.forEach((p) => {
        ctx.globalAlpha = 0.9;
        ctx.fillRect(p.x, p.y, p.w, 40);
        ctx.globalAlpha = 0.2;
        ctx.fillRect(p.x, p.y + 40, p.w, 160);
      });
      ctx.globalAlpha = 1;

      ctx.fillRect(GOAL + 40, 250, 8, 210);
      ctx.fillRect(GOAL + 48, 250, 70, 44);

      ctx.fillStyle = api.colors.accent;
      ctx.fillRect(player.x, player.y, player.w, player.h);
      ctx.fillStyle = api.colors.bg;
      ctx.fillRect(player.x + (player.vx < 0 ? 4 : 14), player.y + 9, 8, 7);
      ctx.restore();

      text(api, '2013', 18, 22, 14, { align: 'left', kind: 'ui', alpha: 0.5 });
      if (!jumpUnlocked) {
        text(api, 'TRY JUMPING', api.w / 2, api.h * 0.22, Math.min(34, api.w / 16), { alpha: 0.5 });
      }
    },
  } satisfies MiniGame;
}
