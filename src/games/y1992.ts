import type { GameApi, MiniGame } from '../core/types';
import { clamp, fill, text } from './helpers';

interface Fighter {
  x: number;
  hp: number;
  maxHp: number;
  attack: number;
  recover: number;
  windup: number;
  hurt: number;
  down: number;
  facing: number;
}

/** 1992 — round one is a formality. Round two is a lesson. */
export function create1992(api: GameApi): MiniGame {
  let t = 0;
  let round = 1;
  let phase: 'announce' | 'fight' | 'between' | 'done' = 'announce';
  let phaseT = 0;
  let banner = 'ROUND 1';
  const you: Fighter = { x: 0.3, hp: 100, maxHp: 100, attack: 0, recover: 0, windup: 0, hurt: 0, down: 0, facing: 1 };
  const foe: Fighter = { x: 0.7, hp: 1, maxHp: 1, attack: 0, recover: 0, windup: 0, hurt: 0, down: 0, facing: -1 };

  const groundY = () => api.h * 0.78;
  // Fighters are sized off the stage height: on a phone the screen is tall, not wide.
  const scale = () => (api.h / 600) * 1.25;

  const hit = (target: Fighter, dmg: number, from: number) => {
    target.hp = Math.max(0, target.hp - dmg);
    target.hurt = 0.22;
    target.x = clamp(target.x + from * 0.03, 0.08, 0.92);
    api.audio.noise(0.12, 0.25, 900);
    api.audio.blip(180, 0.1, 'square', 0.25, 90);
  };

  const startRound = (n: number) => {
    round = n;
    phase = 'announce';
    phaseT = 0;
    banner = `ROUND ${n}`;
    you.x = 0.3;
    foe.x = 0.7;
    you.hp = you.maxHp = api.diff.lives(n === 1 ? 100 : n === 2 ? 130 : 150);
    foe.hp = foe.maxHp = n === 1 ? 1 : api.diff.goal(n === 2 ? 100 : 190);
    foe.down = 0;
    you.down = 0;
    api.audio.jingle(n === 1 ? [60, 64, 67] : [48, 50, 51, 52], 0.1, 'sawtooth');
  };

  return {
    start() {
      startRound(1);
    },

    update(dt) {
      t += dt;
      phaseT += dt;

      if (phase === 'announce') {
        if (phaseT > 1.1 && banner.startsWith('ROUND')) {
          banner = 'FIGHT';
          api.audio.blip(520, 0.3, 'sawtooth', 0.3, 160);
        }
        if (phaseT > 1.9) {
          banner = '';
          phase = 'fight';
          phaseT = 0;
        }
        return;
      }

      if (phase === 'between') {
        if (phaseT > 2.4) startRound(round + 1);
        return;
      }
      if (phase === 'done') return;

      // player
      you.attack = Math.max(0, you.attack - dt);
      you.recover = Math.max(0, you.recover - dt);
      you.hurt = Math.max(0, you.hurt - dt);
      if (!you.recover) {
        you.x = clamp(you.x + api.input.moveX * 0.34 * dt, 0.08, 0.92);
        if (api.input.firePressed) {
          you.attack = 0.18;
          you.recover = 0.3;
          api.audio.blip(300, 0.05, 'square', 0.14, 500);
          if (Math.abs(you.x - foe.x) < 0.17 && !foe.down) {
            hit(foe, round === 1 ? 5 : round === 2 ? 11 : 9, 1);
            if (foe.hp <= 0) {
              foe.down = 0.01;
              banner = 'K.O.';
              if (round === 1) {
                phase = 'between';
                phaseT = 0;
                api.say("Balancing hadn't been invented yet.");
                api.audio.jingle([72, 67, 60], 0.12, 'sawtooth');
              } else if (round === 2) {
                phase = 'between';
                phaseT = 0;
                api.say('Round three. They brought a bigger one.');
                api.audio.jingle([60, 59, 57, 55], 0.12, 'sawtooth');
              } else {
                phase = 'done';
                api.audio.fanfare();
                window.setTimeout(
                  () => api.win({ stat: `THREE ROUNDS, ${Math.round(you.hp)} HP LEFT` }),
                  1100,
                );
              }
            }
          }
        }
      }

      // opponent
      foe.hurt = Math.max(0, foe.hurt - dt);
      foe.attack = Math.max(0, foe.attack - dt);
      foe.recover = Math.max(0, foe.recover - dt);
      foe.windup = Math.max(0, foe.windup - dt);
      if (foe.down) {
        foe.down += dt;
      } else if (round >= 2) {
        const gap = you.x - foe.x;
        const dir = Math.sign(gap) || 1;
        const speed = api.diff.pace(round === 2 ? 0.42 : 0.3);
        if (Math.abs(gap) > 0.14) {
          foe.x = clamp(foe.x + dir * speed * dt, 0.08, 0.92);
        } else if (!foe.recover && !foe.windup && foe.attack <= 0) {
          foe.windup = round === 2 ? 0.34 : 0.5;
        }
        if (foe.windup > 0 && foe.windup < 0.02) {
          foe.attack = 0.16;
          foe.recover = 0.5;
          if (Math.abs(you.x - foe.x) < (round === 3 ? 0.26 : 0.19)) {
            hit(you, api.diff.pace(round === 3 ? 17 : 9), -1);
            if (you.hp <= 0) {
              phase = 'done';
              banner = 'K.O.';
              window.setTimeout(() => api.lose('The difficulty curve was a wall.'), 900);
            }
          }
        }
        foe.facing = -dir;
      }

      api.hud(
        round === 1
          ? 'ROUND 1'
          : `ROUND ${round}    YOU ${Math.round(you.hp)}    THEM ${Math.round(foe.hp)}`,
      );
    },

    draw() {
      const { ctx } = api;
      fill(api);
      const s = scale();
      const gy = groundY();

      // stage: floor, a back wall, and a crowd that never reacts
      ctx.fillStyle = api.colors.fg;
      ctx.globalAlpha = 0.16;
      ctx.fillRect(0, gy, api.w, api.h - gy);
      ctx.globalAlpha = 0.08;
      ctx.fillRect(0, gy - 150 * s, api.w, 150 * s);
      ctx.globalAlpha = 0.22;
      for (let i = 0; i < 26; i++) {
        const hx = (i / 26) * api.w + Math.sin(i * 2.3) * 6;
        const hy = gy - 100 * s - (i % 3) * 16 * s + Math.sin(t * 2 + i) * 2;
        ctx.beginPath();
        ctx.arc(hx, hy, 9 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(hx - 9 * s, hy + 6 * s, 18 * s, 26 * s);
      }
      ctx.globalAlpha = 0.1;
      for (let i = 0; i < 14; i++) ctx.fillRect((i / 14) * api.w, gy, 3, api.h - gy);
      ctx.globalAlpha = 1;

      const drawFighter = (f: Fighter, color: string) => {
        const x = f.x * api.w;
        ctx.save();
        ctx.translate(x, gy);
        if (f.down) ctx.rotate((Math.min(1, f.down * 3) * Math.PI) / 2 * f.facing * -1);
        ctx.globalAlpha = f.hurt > 0 && Math.floor(f.hurt * 40) % 2 ? 0.35 : 1;
        ctx.fillStyle = color;
        const big = f === foe && round === 3 ? 1.5 : 1;
        ctx.scale(big * f.facing, big);
        const punch = f.attack > 0;
        const wind = f.windup > 0;
        const bob = Math.sin(t * 4 + (f === foe ? 1 : 0)) * 2 * s;

        // back leg, planted; front leg, forward: a stance, not a pair of sticks
        ctx.fillRect(-22 * s, -34 * s, 12 * s, 34 * s);
        ctx.fillRect(8 * s, -30 * s, 12 * s, 30 * s);
        ctx.fillRect(-24 * s, -4 * s, 20 * s, 6 * s);
        ctx.fillRect(6 * s, -4 * s, 22 * s, 6 * s);

        // torso, leaning into the punch
        ctx.save();
        ctx.rotate(punch ? -0.12 : wind ? 0.1 : 0);
        ctx.fillRect(-15 * s, (-92 + bob) * s, 30 * s, 60 * s);
        // belt
        ctx.fillStyle = api.colors.bg;
        ctx.fillRect(-15 * s, (-44 + bob) * s, 30 * s, 7 * s);
        ctx.fillStyle = color;

        // head and hair
        ctx.fillRect(-11 * s, (-120 + bob) * s, 22 * s, 26 * s);
        ctx.fillRect(-13 * s, (-124 + bob) * s, 26 * s, 8 * s);
        ctx.fillStyle = api.colors.bg;
        ctx.fillRect(2 * s, (-112 + bob) * s, 6 * s, 5 * s);
        ctx.fillStyle = color;

        // rear arm, then the one doing the work
        ctx.fillRect(-26 * s, (-86 + bob) * s, 12 * s, 11 * s);
        const reach = punch ? 46 * s : wind ? 6 * s : 18 * s;
        ctx.fillRect(13 * s, (-84 + bob) * s, reach, 11 * s);
        ctx.fillRect(13 * s + reach, (-88 + bob) * s, 15 * s, 18 * s); // fist
        ctx.restore();
        ctx.restore();
      };

      const bar = (f: Fighter, left: boolean) => {
        const w = api.w * 0.36;
        const x = left ? api.w * 0.06 : api.w * 0.58;
        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = api.colors.fg;
        ctx.fillRect(x, api.h * 0.07, w, 16);
        ctx.globalAlpha = 1;
        ctx.fillStyle = f.hp / f.maxHp < 0.3 ? api.colors.accent : api.colors.fg;
        const fw = w * (f.hp / f.maxHp);
        ctx.fillRect(left ? x + w - fw : x, api.h * 0.07, fw, 16);
        ctx.restore();
      };

      drawFighter(you, api.colors.fg);
      drawFighter(foe, api.colors.accent);
      bar(you, true);
      bar(foe, false);
      text(api, 'YOU', api.w * 0.06, api.h * 0.07 - 18, 16, { align: 'left', alpha: 0.6 });
      text(api, 'THEM', api.w * 0.94, api.h * 0.07 - 18, 16, { align: 'right', alpha: 0.6 });

      if (banner) {
        text(api, banner, api.w / 2, api.h * 0.4, Math.min(92, api.w / 7), {
          color: banner === 'FIGHT' ? api.colors.accent : api.colors.fg,
        });
      }
    },
  } satisfies MiniGame;
}
