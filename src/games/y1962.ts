import type { GameApi, MiniGame } from '../core/types';
import { Script, circle, clamp, dist, fill, rand, text, timerBar } from './helpers';

interface Dot {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/**
 * 1962 — two dots, a gravity well and a computer the size of a wardrobe.
 * Mechanically: turn, thrust, fire. Historically: a research machine being misused.
 */
export function create1962(api: GameApi): MiniGame {
  const ship = { x: 0, y: 0, vx: 0, vy: 0, a: -Math.PI / 2 };
  let rival: Dot = { x: 0, y: 0, vx: 0, vy: 0 };
  const shots: (Dot & { life: number })[] = [];
  let t = 0;
  let hits = 0;
  const NEEDED = 4;
  let lives = 3;
  let gravity = 1;
  let flicker = 0.04;
  let fade = 1;
  let cool = 0;
  let mercy = false;
  let shrink = false;

  const cx = () => api.w / 2;
  const cy = () => api.h / 2;

  const placeRival = () => {
    const ang = rand(0, Math.PI * 2);
    const r = Math.min(api.w, api.h) * 0.33;
    rival = {
      x: cx() + Math.cos(ang) * r,
      y: cy() + Math.sin(ang) * r,
      vx: -Math.sin(ang) * 70,
      vy: Math.cos(ang) * 70,
    };
  };

  const respawn = () => {
    ship.x = cx() - Math.min(api.w, api.h) * 0.34;
    ship.y = cy();
    ship.vx = 0;
    ship.vy = -40;
    ship.a = -Math.PI / 2;
  };

  const script = new Script([
    { at: 4, run: () => api.say('The computer this ran on cost about $120,000.') },
    {
      at: 10,
      run: () => {
        gravity = 2;
        api.say('The star has developed opinions.');
        api.audio.blip(120, 0.4, 'sine', 0.2, 60);
      },
    },
    {
      at: 16,
      run: () => {
        flicker = 0.16;
        fade = 0.75;
        api.say('The screen is a borrowed radar scope. It is doing its best.');
      },
    },
    {
      at: 23,
      run: () => {
        gravity = -1.3;
        api.shout('GRAVITY IS NOW\nA SUGGESTION');
        api.audio.blip(300, 0.6, 'sine', 0.25, 90);
      },
    },
    {
      at: 26,
      run: () => {
        shrink = true;
        api.say('The rival has decided to be smaller about this.');
      },
    },
    {
      at: 40,
      run: () => {
        mercy = true;
        api.say('Fine. Here. Take it.');
      },
    },
    {
      at: 52,
      run: () => api.say('Eight seconds. The night shift wants the computer back.'),
    },
  ]);

  return {
    start() {
      respawn();
      placeRival();
      api.audio.blip(440, 0.1, 'sine', 0.2);
    },

    update(dt) {
      t += dt;
      script.update(t);
      cool -= dt;

      // --- ship ---
      // Touch: the nose turns towards the finger and thrusts while it is held.
      let thrusting = api.input.up;
      if (api.input.pointerDown) {
        const want = Math.atan2(api.input.pointerY - ship.y, api.input.pointerX - ship.x);
        let diff = want - ship.a;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        ship.a += Math.max(-1, Math.min(1, diff * 3)) * 3.4 * dt;
        thrusting = Math.hypot(api.input.pointerX - ship.x, api.input.pointerY - ship.y) > 40;
      } else {
        ship.a += api.input.axisX * 3.2 * dt;
      }
      if (thrusting) {
        ship.vx += Math.cos(ship.a) * 180 * dt;
        ship.vy += Math.sin(ship.a) * 180 * dt;
        if (Math.random() < 0.3) api.audio.blip(rand(80, 110), 0.04, 'sine', 0.08);
      }

      const pull = (d: Dot, strength: number) => {
        const dx = cx() - d.x;
        const dy = cy() - d.y;
        const r = Math.max(26, Math.hypot(dx, dy));
        const f = ((strength * 26000) / (r * r)) * gravity;
        d.vx += (dx / r) * f * dt;
        d.vy += (dy / r) * f * dt;
      };
      pull(ship, 1);
      pull(rival, 0.6);

      const wrap = (d: Dot) => {
        if (d.x < 0) d.x += api.w;
        if (d.x > api.w) d.x -= api.w;
        if (d.y < 0) d.y += api.h;
        if (d.y > api.h) d.y -= api.h;
      };
      ship.x += ship.vx * dt;
      ship.y += ship.vy * dt;
      wrap(ship);

      // --- rival ---
      if (mercy) {
        rival.vx *= 0.97;
        rival.vy *= 0.97;
      } else if (t > 14) {
        const dx = ship.x - rival.x;
        const dy = ship.y - rival.y;
        const r = Math.max(1, Math.hypot(dx, dy));
        const chase = t > 30 ? 46 : 28;
        rival.vx += (dx / r) * chase * dt;
        rival.vy += (dy / r) * chase * dt;
      }
      rival.x += rival.vx * dt;
      rival.y += rival.vy * dt;
      wrap(rival);

      // --- shots ---
      const wantsShot = api.input.actionKeyPressed || api.input.tapped || api.input.pointerDown;
      if (wantsShot && cool <= 0) {
        cool = 0.28;
        shots.push({
          x: ship.x,
          y: ship.y,
          vx: ship.vx + Math.cos(ship.a) * 360,
          vy: ship.vy + Math.sin(ship.a) * 360,
          life: 1.8,
        });
        api.audio.blip(880, 0.06, 'sine', 0.22, 300);
      }
      for (let i = shots.length - 1; i >= 0; i--) {
        const s = shots[i];
        pull(s, 0.5);
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.life -= dt;
        wrap(s);
        const hitRadius = mercy ? 44 : shrink ? 11 : 17;
        if (dist(s.x, s.y, rival.x, rival.y) < hitRadius) {
          shots.splice(i, 1);
          hits++;
          api.audio.blip(220, 0.25, 'sine', 0.3, 60);
          if (hits >= NEEDED) {
            api.win({ stat: `${NEEDED} HITS IN ${t.toFixed(0)}s` });
            return;
          }
          placeRival();
          continue;
        }
        if (s.life <= 0) shots.splice(i, 1);
      }

      // --- the star eats things ---
      if (dist(ship.x, ship.y, cx(), cy()) < 22) {
        lives--;
        api.audio.noise(0.4, 0.3, 700);
        if (lives <= 0) {
          api.lose('The star won. The star usually wins.');
          return;
        }
        api.say(`Consumed by the star. ${lives} left.`);
        respawn();
      }

      if (t > 60) {
        api.lose('The night shift took the computer back.');
        return;
      }
      api.hud(`HITS ${hits}/${NEEDED}    SHIPS ${lives}    ${Math.max(0, 60 - t).toFixed(0)}s`);
    },

    draw() {
      const { ctx } = api;
      fill(api);
      ctx.save();
      ctx.globalAlpha = fade * (1 - Math.random() * flicker);
      ctx.strokeStyle = api.colors.fg;
      ctx.fillStyle = api.colors.fg;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';

      // gravity well
      ctx.save();
      ctx.translate(cx(), cy());
      ctx.rotate(t * (gravity < 0 ? -1 : 1) * 0.6);
      for (let i = 0; i < 6; i++) {
        ctx.rotate(Math.PI / 3);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, 16 + Math.sin(t * 6 + i) * 4);
        ctx.stroke();
      }
      ctx.restore();

      // ship
      ctx.save();
      ctx.translate(ship.x, ship.y);
      ctx.rotate(ship.a);
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(-9, 8);
      ctx.lineTo(-5, 0);
      ctx.lineTo(-9, -8);
      ctx.closePath();
      ctx.stroke();
      if (api.input.up || api.input.pointerDown) {
        ctx.beginPath();
        ctx.moveTo(-6, 0);
        ctx.lineTo(-14 - Math.random() * 7, 0);
        ctx.stroke();
      }
      ctx.restore();

      // rival
      const rs = mercy ? 34 : shrink ? 6 : 9;
      ctx.strokeRect(rival.x - rs, rival.y - rs, rs * 2, rs * 2);

      ctx.globalAlpha = fade;
      shots.forEach((s) => {
        circle(ctx, s.x, s.y, 2.5);
        ctx.fill();
      });
      ctx.restore();

      text(api, '1962', 18, 24, 16, { align: 'left', kind: 'mono', alpha: 0.5 });
      if (t < 3) {
        text(api, 'TWO DOTS. ONE STAR.', api.w / 2, api.h * 0.18, Math.min(34, api.w / 18), {
          alpha: clamp(3 - t, 0, 1),
        });
      }
      timerBar(api, t, 60);
    },
  } satisfies MiniGame;
}
