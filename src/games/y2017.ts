import type { GameApi, MiniGame } from '../core/types';
import { Script, circle, clamp, dist, fill, rand, text } from './helpers';

interface Dot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alive: boolean;
}

/** 2017 — ninety-nine other people, most of whom resolve themselves. */
export function create2017(api: GameApi): MiniGame {
  let t = 0;
  let alive = 100;
  let hp = 100;
  let looted = false;
  let finalPhase = false;
  let rivalWalking = false;
  let rivalHunting = false;
  let won = false;
  const player = { x: 0, y: 0 };
  const rival: Dot = { x: 0, y: 0, vx: 0, vy: 0, alive: false };
  const crowd: Dot[] = [];
  let zoneR = 1;
  const loot = { x: 0, y: 0 };

  const arena = () => Math.min(api.w, api.h) * 0.46;
  const cx = () => api.w / 2;
  const cy = () => api.h / 2;

  const drop = (n: number, line?: string) => {
    alive = n;
    api.audio.blip(200 + n, 0.12, 'triangle', 0.22, 120);
    if (line) api.say(line);
  };

  const script = new Script([
    { at: 0.6, run: () => api.shout('100 PLAYERS') },
    { at: 4, run: () => drop(50, '50 remaining. You did nothing.') },
    { at: 8, run: () => drop(20, '20 remaining. Still nothing.') },
    { at: 12, run: () => drop(8, '8 remaining. The circle disagrees with most of them.') },
    { at: 16, run: () => drop(4, 'Four. One of them is you.') },
    {
      at: 20,
      run: () => {
        drop(2);
        finalPhase = true;
        rival.alive = true;
        rival.x = cx() + arena() * 0.5;
        rival.y = cy();
        api.shout('FINAL TWO');
        api.audio.jingle([36, 43, 48, 55], 0.22, 'sawtooth');
      },
    },
    { at: 24, run: () => { rivalHunting = true; api.say('Your opponent has spotted you.'); } },
    { at: 31, run: () => { rivalHunting = false; rivalWalking = true; api.say('Your opponent is doing something.'); } },
  ]);

  return {
    start() {
      player.x = cx();
      player.y = cy() + arena() * 0.3;
      loot.x = cx() + rand(-arena() * 0.4, arena() * 0.4);
      loot.y = cy() + rand(-arena() * 0.4, arena() * 0.4);
      for (let i = 0; i < 60; i++) {
        const a = rand(0, Math.PI * 2);
        const r = rand(0, arena());
        crowd.push({ x: cx() + Math.cos(a) * r, y: cy() + Math.sin(a) * r, vx: rand(-40, 40), vy: rand(-40, 40), alive: true });
      }
      api.say('MOVE: ARROW KEYS    STAY IN THE CIRCLE');
    },

    update(dt) {
      if (won) return;
      t += dt;
      script.update(t);
      zoneR = clamp(1 - t * 0.024, 0.28, 1);

      const sp = 270;
      player.x += api.input.axisX * sp * dt;
      player.y += api.input.axisY * sp * dt;
      player.x = clamp(player.x, 10, api.w - 10);
      player.y = clamp(player.y, 10, api.h - 10);

      const r = arena() * zoneR;
      const out = dist(player.x, player.y, cx(), cy()) > r;
      if (out) {
        hp -= 26 * dt;
        if (Math.random() < 0.08) api.audio.blip(120, 0.1, 'sawtooth', 0.12);
        if (hp <= 0) {
          api.lose('Eliminated by weather.');
          return;
        }
      } else if (hp < 100) {
        hp = Math.min(100, hp + 7 * dt);
      }

      // the other 98, resolving themselves
      const quota = Math.max(0, Math.min(crowd.length, alive - 2));
      let seen = 0;
      for (const d of crowd) {
        if (!d.alive) continue;
        seen++;
        if (seen > quota) {
          d.alive = false;
          continue;
        }
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        if (dist(d.x, d.y, cx(), cy()) > r) {
          d.vx += (cx() - d.x) * 0.5 * dt;
          d.vy += (cy() - d.y) * 0.5 * dt;
        }
        if (Math.random() < 0.3 * dt) {
          d.vx = rand(-60, 60);
          d.vy = rand(-60, 60);
        }
      }

      if (!looted && dist(player.x, player.y, loot.x, loot.y) < 26) {
        looted = true;
        api.audio.jingle([72, 79, 84], 0.07, 'triangle');
        api.shout('YOU FOUND:\nA SLIGHTLY LARGER\nRECTANGLE');
      }

      if (rival.alive) {
        if (rivalWalking) {
          rival.x += 150 * dt;
          if (rival.x > api.w + 60) {
            rival.alive = false;
            alive = 1;
            won = true;
            api.shout('VICTORY');
            api.audio.jingle([60, 64, 67, 72, 76], 0.13, 'sawtooth');
            window.setTimeout(
              () => api.win({ stat: looted ? 'WON. LOOTED. UNTOUCHED.' : 'WON WITHOUT FIRING' }),
              1600,
            );
          }
        } else if (rivalHunting) {
          const d = Math.max(1, dist(rival.x, rival.y, player.x, player.y));
          rival.x += ((player.x - rival.x) / d) * 180 * dt;
          rival.y += ((player.y - rival.y) / d) * 180 * dt;
          if (d < 24) {
            hp -= 42 * dt;
            if (Math.random() < 0.1) api.audio.blip(90, 0.12, 'sawtooth', 0.18);
            if (hp <= 0) {
              api.lose('Second place. Out of two.');
              return;
            }
          }
        } else {
          rival.x += Math.sin(t * 2) * 40 * dt;
          rival.y += Math.cos(t * 1.7) * 40 * dt;
        }
      }

      api.hud(`ALIVE ${alive}    HP ${Math.max(0, Math.round(hp))}`);
    },

    draw() {
      const { ctx } = api;
      fill(api);
      const r = arena() * zoneR;

      ctx.save();
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = api.colors.accent;
      ctx.fillRect(0, 0, api.w, api.h);
      ctx.restore();

      ctx.save();
      ctx.fillStyle = api.colors.bg;
      circle(ctx, cx(), cy(), r);
      ctx.fill();
      ctx.strokeStyle = api.colors.accent;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();

      if (!looted) {
        ctx.fillStyle = api.colors.warn;
        ctx.fillRect(loot.x - 11, loot.y - 11, 22, 22);
        ctx.fillStyle = api.colors.fg;
        ctx.fillRect(loot.x - 11, loot.y - 3, 22, 6);
      }

      ctx.fillStyle = api.colors.dim;
      crowd.forEach((d) => {
        if (!d.alive) return;
        ctx.fillRect(d.x - 5, d.y - 5, 10, 10);
      });

      if (rival.alive) {
        ctx.fillStyle = api.colors.accent;
        ctx.fillRect(rival.x - 9, rival.y - 14, 18, 28);
      }

      ctx.fillStyle = api.colors.fg;
      ctx.fillRect(player.x - 9 - (looted ? 3 : 0), player.y - 14, 18 + (looted ? 6 : 0), 28);

      // hp bar
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.fillRect(api.w * 0.3, api.h - 34, api.w * 0.4, 10);
      ctx.globalAlpha = 1;
      ctx.fillStyle = hp < 40 ? api.colors.accent : api.colors.fg;
      ctx.fillRect(api.w * 0.3, api.h - 34, api.w * 0.4 * clamp(hp / 100, 0, 1), 10);
      ctx.restore();

      text(api, `${alive} ALIVE`, 20, 34, Math.min(36, api.w / 14), {
        align: 'left',
        alpha: finalPhase ? 1 : 0.75,
        color: finalPhase ? api.colors.accent : api.colors.fg,
      });
    },
  } satisfies MiniGame;
}
