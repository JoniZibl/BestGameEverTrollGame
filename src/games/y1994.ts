import type { GameApi, MiniGame } from '../core/types';
import { clamp, fill, rand, roundRect, text } from './helpers';

const MENU = ['FIGHT', 'MAGIC', 'ITEM', 'RUN'];

interface Float {
  x: number;
  y: number;
  text: string;
  life: number;
}

/** 1994 — four words in a box, and the entire emotional range of a decade. */
export function create1994(api: GameApi): MiniGame {
  let t = 0;
  let atb = 0;
  let cursor = 0;
  let hp = 120;
  let maxHp = 120;
  let mp = 18;
  let foeHp = 90;
  let foeMax = 90;
  let battle = 1;
  let busy = 0;
  let message = 'A WILD SHAPE APPEARS.';
  let foeTimer = 3.4;
  let over = false;
  const floats: Float[] = [];

  const box = () => ({ x: api.w * 0.05, y: api.h * 0.62, w: api.w * 0.9, h: api.h * 0.33 });
  const menuRect = (i: number) => {
    const b = box();
    const w = b.w / 2 - 18;
    return { x: b.x + 14 + (i % 2) * (w + 12), y: b.y + 56 + Math.floor(i / 2) * 44, w, h: 36 };
  };

  const say = (m: string) => {
    message = m;
    busy = 0.9;
  };

  const float = (text: string, enemy: boolean) => {
    floats.push({ x: enemy ? api.w * 0.6 : api.w * 0.25, y: api.h * 0.35, text, life: 1.2 });
  };

  const nextBattle = () => {
    battle++;
    if (battle > api.diff.goal(3)) {
      over = true;
      api.shout('NO MORE ENCOUNTERS');
      window.setTimeout(() => api.win({ stat: `3 RANDOM ENCOUNTERS SURVIVED` }), 1600);
      return;
    }
    foeMax = api.diff.goal(90 + Math.min(battle, 2) * 24);
    foeHp = foeMax;
    foeTimer = 3.2;
    atb = 0;
    // The party rests between encounters. Without it, three fights in a row are
    // decided by how much health battle one happened to leave you.
    hp = maxHp;
    mp = Math.min(24, mp + 8);
    api.shout('ANOTHER RANDOM\nENCOUNTER');
    api.say('The party rests. Briefly.');
    say(battle === 3 ? 'YOU HAVE TAKEN FOUR STEPS.' : 'A WILD SHAPE APPEARS. AGAIN.');
    api.audio.jingle([57, 60, 64], 0.1, 'square');
  };

  const choose = (i: number) => {
    if (atb < 1 || busy > 0 || over) return;
    atb = 0;
    api.audio.blip(660, 0.06, 'square', 0.18);
    if (i === 0) {
      const dmg = Math.round(rand(14, 24));
      foeHp -= dmg;
      float(`${dmg}`, true);
      say('YOU ATTACK.');
    } else if (i === 1) {
      if (mp < 6) {
        say('NOT ENOUGH MP.');
        return;
      }
      mp -= 6;
      const dmg = Math.round(rand(30, 44));
      foeHp -= dmg;
      float(`${dmg}`, true);
      say('SOMETHING EXPENSIVE HAPPENS.');
    } else if (i === 2) {
      hp = Math.min(maxHp, hp + 55);
      float('+40', false);
      say('YOU DRINK THE GREEN ONE.');
    } else {
      if (battle >= 2) {
        over = true;
        api.shout('YOU RAN AWAY');
        say('A SENSIBLE DECISION.');
        window.setTimeout(() => api.win({ stat: 'ESCAPED. HONOURABLY.' }), 1700);
      } else {
        say("COULDN'T ESCAPE.");
      }
    }
    if (foeHp <= 0) {
      foeHp = 0;
      say('THE SHAPE IS DEFEATED.');
      window.setTimeout(nextBattle, 1400);
    }
  };

  return {
    start() {
      hp = maxHp = api.diff.lives(120);
      foeMax = foeHp = api.diff.goal(90);
      api.hud('BATTLE 1');
    },

    update(dt) {
      t += dt;
      if (over) return;
      busy = Math.max(0, busy - dt);
      floats.forEach((f) => (f.life -= dt));
      for (let i = floats.length - 1; i >= 0; i--) if (floats[i].life <= 0) floats.splice(i, 1);

      if (foeHp > 0) {
        atb = clamp(atb + dt / 2.2, 0, 1);
        foeTimer -= dt;
        if (foeTimer <= 0) {
          foeTimer = (rand(3.2, 4.6) - battle * 0.3) / api.diff.pace(1);
          const dmg = Math.round(api.diff.pace(rand(7, 12) + battle * 3.5));
          hp -= dmg;
          float(`${dmg}`, false);
          say('THE SHAPE RETALIATES.');
          api.audio.noise(0.2, 0.25, 700);
          if (hp <= 0) {
            over = true;
            api.lose('Your party has fallen. The last save was a while ago.');
            return;
          }
        }
      }

      // keyboard
      if (api.input.justPressed('ArrowDown', 'KeyS')) cursor = (cursor + 2) % 4;
      if (api.input.justPressed('ArrowUp', 'KeyW')) cursor = (cursor + 2) % 4;
      if (api.input.justPressed('ArrowRight', 'KeyD')) cursor = (cursor + 1) % 4;
      if (api.input.justPressed('ArrowLeft', 'KeyA')) cursor = (cursor + 3) % 4;
      if (api.input.actionKeyPressed) choose(cursor);

      // touch / mouse
      if (api.input.pointerEdge || api.input.tapped) {
        for (let i = 0; i < 4; i++) {
          const r = menuRect(i);
          if (
            api.input.pointerX > r.x &&
            api.input.pointerX < r.x + r.w &&
            api.input.pointerY > r.y &&
            api.input.pointerY < r.y + r.h
          ) {
            cursor = i;
            choose(i);
          }
        }
      }

      api.hud(`BATTLE ${Math.min(battle, 3)}/3    HP ${Math.max(0, hp)}    MP ${mp}`);
    },

    draw() {
      const { ctx } = api;
      fill(api);

      // the enemy
      const fx = api.w * 0.6;
      const fy = api.h * 0.3;
      const wob = Math.sin(t * 2) * 6;
      ctx.save();
      ctx.translate(fx, fy + wob);
      ctx.fillStyle = api.colors.accent;
      const r = Math.min(api.w, api.h) * (0.1 + battle * 0.02);
      ctx.beginPath();
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const rr = r * (0.8 + (i % 2) * 0.35);
        ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = api.colors.bg;
      ctx.fillRect(-r * 0.4, -r * 0.2, r * 0.25, r * 0.12);
      ctx.fillRect(r * 0.15, -r * 0.2, r * 0.25, r * 0.12);
      ctx.restore();

      // enemy hp bar
      const bw = api.w * 0.3;
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = api.colors.fg;
      ctx.fillRect(fx - bw / 2, fy - r - 26, bw, 8);
      ctx.globalAlpha = 1;
      ctx.fillRect(fx - bw / 2, fy - r - 26, bw * clamp(foeHp / foeMax, 0, 1), 8);

      floats.forEach((f) => {
        text(api, f.text, f.x, f.y - (1.2 - f.life) * 50, 26, {
          alpha: clamp(f.life, 0, 1),
          color: api.colors.accent,
        });
      });

      // the box
      const b = box();
      ctx.fillStyle = api.colors.bg;
      ctx.strokeStyle = api.colors.fg;
      ctx.lineWidth = 3;
      roundRect(ctx, b.x, b.y, b.w, b.h, 6);
      ctx.fill();
      ctx.stroke();
      text(api, message, b.x + 14, b.y + 26, Math.min(17, api.w / 23), {
        align: 'left',
        kind: 'mono',
      });

      MENU.forEach((m, i) => {
        const rct = menuRect(i);
        const ready = atb >= 1;
        ctx.globalAlpha = ready ? 1 : 0.35;
        if (i === cursor) {
          ctx.fillStyle = api.colors.fg;
          roundRect(ctx, rct.x, rct.y, rct.w, rct.h, 4);
          ctx.fill();
        }
        text(api, m, rct.x + rct.w / 2, rct.y + rct.h / 2, Math.min(19, api.w / 20), {
          color: i === cursor ? api.colors.bg : api.colors.fg,
        });
        ctx.globalAlpha = 1;
      });

      // ATB
      const ab = { x: b.x + 14, y: b.y + b.h - 18, w: b.w - 28 };
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = api.colors.fg;
      ctx.fillRect(ab.x, ab.y, ab.w, 7);
      ctx.globalAlpha = 1;
      ctx.fillStyle = atb >= 1 ? api.colors.accent : api.colors.fg;
      ctx.fillRect(ab.x, ab.y, ab.w * atb, 7);
      text(api, atb >= 1 ? 'READY' : 'WAITING', ab.x + ab.w, ab.y - 10, 11, {
        align: 'right',
        kind: 'mono',
        alpha: 0.6,
      });
    },
  } satisfies MiniGame;
}
