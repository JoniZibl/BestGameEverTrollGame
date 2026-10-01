import type { GameApi, MiniGame } from '../core/types';
import { Script, aabb, clamp, fill, rand, text } from './helpers';

const WORLD_W = 420;
const WORLD_H = 620;
const ROWS = 5;

interface Barrel {
  x: number;
  y: number;
  row: number;
  vx: number;
  falling: boolean;
}

/** 1981 — climb the girders, do not meet the barrels. The ape is not negotiable. */
export function create1981(api: GameApi): MiniGame {
  let t = 0;
  let lives = api.diff.lives(3);
  let climbed = 0;
  let spawn = 1.2;
  let speed = 1;
  let ladderJoke = false;
  const barrels: Barrel[] = [];
  const player = { x: 40, y: 0, vy: 0, onGround: false, climbing: false };

  // Girders slope alternately, so barrels drift left and right as they fall.
  const rowY = (r: number) => WORLD_H - 70 - r * 110;
  const slope = (r: number) => (r % 2 === 0 ? 1 : -1);
  const girderY = (r: number, x: number) => rowY(r) + slope(r) * (x / WORLD_W - 0.5) * 22;
  const ladders = [
    { r: 0, x: 330 },
    { r: 1, x: 90 },
    { r: 2, x: 300 },
    { r: 3, x: 120 },
  ];

  const script = new Script(
    [
      {
        at: 10,
        when: () => climbed >= 1,
        warn: 'One girder up. He noticed.',
        run: () => { spawn = api.diff.pace(0.85); api.say('He has more barrels.'); },
      },
      {
        at: 20,
        when: () => climbed >= 2,
        warn: 'Still climbing, then.',
        run: () => { speed = api.diff.pace(1.4); api.shout('FASTER BARRELS'); },
      },
      {
        at: 30,
        when: () => climbed >= 3,
        warn: 'Fine.',
        run: () => {
          ladderJoke = true;
          api.say('The ladders are now also moving. Nobody authorised this.');
        },
      },
    ],
    { say: api.say, grace: api.diff.grace },
  );

  const die = (why: string) => {
    if (script.mercy) return;
    lives--;
    api.audio.blip(260, 0.5, 'square', 0.3, 70);
    if (lives <= 0) {
      api.lose(why);
      return;
    }
    api.say(`${why} ${lives} left.`);
    player.x = 40;
    player.y = girderY(0, 40) - 30;
    player.vy = 0;
    barrels.length = 0;
  };

  const ladderX = (l: { r: number; x: number }) =>
    ladderJoke ? l.x + Math.sin(t * 1.3 + l.r) * 40 : l.x;

  return {
    start() {
      player.y = girderY(0, 40) - 30;
    },

    update(dt) {
      t += dt;
      script.update(t);

      // --- barrels ---
      spawn -= dt;
      if (spawn <= 0) {
        spawn = rand(0.9, 1.6) / speed / api.diff.pace(1);
        barrels.push({ x: 60, y: girderY(ROWS - 1, 60) - 12, row: ROWS - 1, vx: 70 * speed, falling: false });
        api.audio.blip(150, 0.12, 'square', 0.18, 90);
      }
      for (let i = barrels.length - 1; i >= 0; i--) {
        const b = barrels[i];
        b.x += b.vx * dt;
        b.y = girderY(b.row, b.x) - 12;
        if (b.x > WORLD_W - 10 || b.x < 10) {
          b.row--;
          b.vx *= -1;
          if (b.row < 0) {
            barrels.splice(i, 1);
            continue;
          }
        }
        if (
          aabb({ x: player.x, y: player.y, w: 22, h: 30 }, { x: b.x - 12, y: b.y - 12, w: 24, h: 24 })
        ) {
          barrels.splice(i, 1);
          die('A barrel found you.');
          return;
        }
      }

      // --- player ---
      const nearLadder = ladders.find(
        (l) =>
          Math.abs(player.x + 11 - ladderX(l)) < 22 &&
          player.y + 30 > girderY(l.r + 1, ladderX(l)) - 10 &&
          player.y < girderY(l.r, ladderX(l)) + 10,
      );
      player.climbing = !!nearLadder && Math.abs(api.input.moveY) > 0.3;

      if (player.climbing && nearLadder) {
        player.x = ladderX(nearLadder) - 11;
        player.y += api.input.moveY * 130 * dt;
        player.vy = 0;
      } else {
        player.x = clamp(player.x + api.input.moveX * 150 * dt, 6, WORLD_W - 28);
        player.vy += 1500 * dt;
        player.y += player.vy * dt;
        player.onGround = false;
        for (let r = 0; r < ROWS; r++) {
          const gy = girderY(r, player.x + 11);
          if (player.y + 30 > gy && player.y + 30 < gy + 26 && player.vy >= 0) {
            player.y = gy - 30;
            player.vy = 0;
            player.onGround = true;
          }
        }
        if (api.input.jumpPressed && player.onGround) {
          player.vy = -520;
          api.audio.blip(500, 0.1, 'square', 0.18, 820);
        }
      }

      if (player.y > WORLD_H + 40) {
        die('Fell off the scaffolding.');
        return;
      }
      if (player.y < girderY(ROWS - 1, player.x) - 24) {
        api.win({ stat: `CLIMBED IT IN ${t.toFixed(0)}s` });
        return;
      }

      climbed = Math.max(climbed, Math.floor((WORLD_H - player.y) / 110));
      api.hud(`LIVES ${lives}    HEIGHT ${Math.round(clamp(1 - player.y / WORLD_H, 0, 1) * 100)}%`);
    },

    draw() {
      const { ctx } = api;
      fill(api);
      const s = Math.min(api.w / WORLD_W, api.h / WORLD_H);
      ctx.save();
      ctx.translate((api.w - WORLD_W * s) / 2, (api.h - WORLD_H * s) / 2);
      ctx.scale(s, s);

      // girders
      ctx.fillStyle = api.colors.accent;
      for (let r = 0; r < ROWS; r++) {
        for (let x = 0; x < WORLD_W; x += 20) {
          ctx.fillRect(x, girderY(r, x + 10), 18, 10);
        }
      }
      // ladders
      ctx.fillStyle = api.colors.fg;
      ladders.forEach((l) => {
        const lx = ladderX(l);
        const top = girderY(l.r + 1, lx);
        const bottom = girderY(l.r, lx);
        ctx.fillRect(lx - 14, top, 4, bottom - top);
        ctx.fillRect(lx + 10, top, 4, bottom - top);
        for (let y = top + 8; y < bottom; y += 14) ctx.fillRect(lx - 14, y, 28, 3);
      });

      // the one at the top
      const apeY = girderY(ROWS - 1, 90) - 74;
      ctx.fillStyle = api.colors.fg;
      ctx.fillRect(60, apeY, 62, 60);
      ctx.fillRect(48, apeY + 14, 12, 34);
      ctx.fillRect(122, apeY + 14, 12, 34);
      ctx.fillStyle = api.colors.bg;
      ctx.fillRect(74, apeY + 16, 12, 10);
      ctx.fillRect(96, apeY + 16, 12, 10);
      ctx.fillRect(76, apeY + 38, 30, 8);

      // barrels
      barrels.forEach((b) => {
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.x * 0.06);
        ctx.fillStyle = api.colors.fg;
        ctx.fillRect(-12, -11, 24, 22);
        ctx.fillStyle = api.colors.bg;
        ctx.fillRect(-12, -5, 24, 3);
        ctx.fillRect(-12, 3, 24, 3);
        ctx.restore();
      });

      // climber
      ctx.fillStyle = api.colors.fg;
      ctx.fillRect(player.x, player.y + 8, 22, 22);
      ctx.fillRect(player.x + 3, player.y, 16, 10);
      ctx.fillStyle = api.colors.accent;
      ctx.fillRect(player.x, player.y + 6, 22, 5);
      ctx.restore();

      text(api, '1981', 16, api.h - 16, 13, { align: 'left', kind: 'mono', alpha: 0.4 });
    },
  } satisfies MiniGame;
}
