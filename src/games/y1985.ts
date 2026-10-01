import type { GameApi, MiniGame } from '../core/types';
import { Script, aabb, clamp, fill, text } from './helpers';

const WORLD_H = 600;
const GOAL_X = 5400;

interface Plat {
  x: number;
  y: number;
  w: number;
  h: number;
  amp: number;
  phase: number;
  vanished: number;
  base: number;
}

interface Coin {
  x: number;
  y: number;
  taken?: boolean;
}

interface Walker {
  x: number;
  y: number;
  dir: number;
  left: number;
  right: number;
  alive: boolean;
}

/** 1985 — a very easy platformer that gradually stops being one. */
export function create1985(api: GameApi): MiniGame {
  let t = 0;
  let lives = 3;
  let reached = 0;
  let camMin = 0;
  let autoScroll = 0;
  let moving = false;
  let vanishing = false;
  let gravity = 2000;
  let slippery = false;
  let jumpV = -720;
  const plats: Plat[] = [];
  const walkers: Walker[] = [];
  const coins: Coin[] = [];
  let picked = 0;
  const player = { x: 60, y: 300, vx: 0, vy: 0, w: 28, h: 36, onGround: false };
  let checkpoint = { x: 60, y: 300 };
  let coyote = 0;

  // Deterministic layout — everyone gets the same bad time.
  let seed = 1985;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  const build = () => {
    let x = 0;
    let y = 470;
    plats.push({ x: -40, y, w: 420, h: 40, amp: 0, phase: 0, vanished: 0, base: y });
    x = 420;
    while (x < GOAL_X) {
      const gap = 70 + rnd() * 90;
      const w = 130 + rnd() * 160;
      y = clamp(y + (rnd() - 0.5) * 170, 240, 500);
      plats.push({ x: x + gap, y, w, h: 30, amp: 24 + rnd() * 40, phase: rnd() * 6.3, vanished: 0, base: y });
      // a short arc of coins over most gaps, because that is what they are for
      if (rnd() < 0.8) {
        const n = 3 + Math.floor(rnd() * 3);
        for (let i = 0; i < n; i++) {
          coins.push({
            x: x + gap * (i + 1) / (n + 1) + 10,
            y: y - 90 - Math.sin(((i + 1) / (n + 1)) * Math.PI) * 46,
          });
        }
      }
      if (rnd() < 0.45) {
        walkers.push({
          x: x + gap + w * 0.5,
          y: y - 26,
          dir: rnd() < 0.5 ? -1 : 1,
          left: x + gap + 14,
          right: x + gap + w - 14,
          alive: true,
        });
      }
      x += gap + w;
    }
    plats.push({ x: GOAL_X, y: 430, w: 260, h: 40, amp: 0, phase: 0, vanished: 0, base: 430 });
  };

  const script = new Script(
    [
    {
      at: 9,
      when: () => reached > 700,
      warn: 'You have done this before.',
      run: () => { moving = true; api.shout('GAMES USED TO\nBE HARDER'); },
    },
    {
      at: 15,
      when: () => reached > 1600,
      warn: 'Watch the floor.',
      run: () => { vanishing = true; api.say('The floor is now optional.'); },
    },
    {
      at: 19,
      run: () => {
        gravity = 1150;
        jumpV = -620;
        api.say('Physics patch applied. Nobody tested it.');
      },
    },
    { at: 25, run: () => api.say('Enemies have arrived. They are not very good at it.') },
    {
      at: 31,
      run: () => {
        autoScroll = api.diff.pace(80);
        api.shout('KEEP UP');
        api.audio.blip(140, 0.4, 'square', 0.3, 320);
      },
    },
    {
      at: 40,
      run: () => {
        slippery = true;
        api.say('Someone has waxed the platforms.');
      },
    },
    {
      at: 50,
      warn: 'Keep moving.',
      run: () => {
        autoScroll = api.diff.pace(125);
        api.shout('FASTER');
        api.audio.blip(180, 0.4, 'square', 0.3, 420);
      },
    },
    ],
    { say: api.say, grace: api.diff.grace },
  );

  const die = (why: string) => {
    if (script.mercy) {
      player.y = Math.min(player.y, WORLD_H - 220);
      player.vy = 0;
      return;
    }
    lives--;
    api.audio.blip(300, 0.5, 'square', 0.3, 70);
    if (lives <= 0) {
      api.lose(why);
      return;
    }
    api.say(`${why} ${lives} left.`);
    player.x = Math.max(checkpoint.x, camMin + 60);
    player.y = checkpoint.y - 60;
    player.vx = 0;
    player.vy = 0;
  };

  return {
    start() {
      lives = api.diff.lives(3);
      build();
    },

    update(dt) {
      t += dt;
      reached = Math.max(reached, player.x);
      script.update(t);
      camMin += autoScroll * dt;

      for (const p of plats) {
        p.y = p.base + (moving && p.amp ? Math.sin(t * 1.6 + p.phase) * p.amp : 0);
      }

      const want = api.input.moveX * 300;
      player.vx = slippery ? player.vx + (want - player.vx) * dt * 1.8 : want;
      if (api.input.jumpPressed && (player.onGround || coyote > 0)) {
        player.vy = jumpV;
        player.onGround = false;
        coyote = 0;
        api.audio.blip(420, 0.1, 'square', 0.2, 760);
      }
      player.vy += gravity * dt;
      player.x += player.vx * dt;
      player.y += player.vy * dt;
      coyote -= dt;

      player.onGround = false;
      for (const p of plats) {
        if (p.vanished > 0) continue;
        const box = { x: p.x, y: p.y, w: p.w, h: p.h };
        const me = { x: player.x, y: player.y, w: player.w, h: player.h };
        if (aabb(me, box) && player.vy >= 0 && player.y + player.h - player.vy * dt <= p.y + 12) {
          player.y = p.y - player.h;
          player.vy = 0;
          player.onGround = true;
          coyote = 0.12;
          checkpoint = { x: p.x + 20, y: p.y };
          if (vanishing && p.x + p.w < player.x + 6 && p.x > 300) p.vanished = 0.01;
        }
      }
      if (vanishing) {
        for (const p of plats) {
          if (p.x + p.w < player.x - 40 && p.x > 300 && p.vanished === 0) p.vanished = 0.01;
          if (p.vanished > 0) p.vanished += dt;
        }
      }

      for (const wk of walkers) {
        if (!wk.alive || t < 25) continue;
        wk.x += wk.dir * 70 * dt;
        if (wk.x < wk.left || wk.x > wk.right) wk.dir *= -1;
        const hit = aabb(
          { x: player.x, y: player.y, w: player.w, h: player.h },
          { x: wk.x - 13, y: wk.y - 8, w: 26, h: 34 },
        );
        if (hit) {
          if (player.vy > 60) {
            wk.alive = false;
            player.vy = jumpV * 0.6;
            api.audio.blip(260, 0.12, 'square', 0.2, 120);
          } else {
            die('Walked into a square.');
            return;
          }
        }
      }

      for (const c of coins) {
        if (c.taken) continue;
        if (Math.abs(c.x - player.x - 14) < 26 && Math.abs(c.y - player.y - 18) < 30) {
          c.taken = true;
          picked++;
          api.audio.blip(980, 0.07, 'square', 0.16, 1500);
        }
      }

      if (player.y > WORLD_H + 80) {
        die('Fell off the world.');
        return;
      }
      if (player.x < camMin - 20) {
        die('The screen left without you.');
        return;
      }
      if (player.x > GOAL_X + 120) {
        api.win({ stat: `FLAG REACHED \u00b7 ${picked} COINS`, score: picked });
        return;
      }

      api.hud(
        `LIVES ${lives}    COINS ${picked}    ${Math.round(clamp((player.x / GOAL_X) * 100, 0, 100))}%`,
      );
    },

    draw() {
      const { ctx } = api;
      fill(api);
      const s = Math.min(api.h / WORLD_H, api.w / 560);
      const camX = clamp(player.x - api.w / s / 2.6, camMin, GOAL_X + 400);

      ctx.save();
      ctx.translate(0, api.h - WORLD_H * s);
      ctx.scale(s, s);
      ctx.translate(-camX, 0);
      ctx.fillStyle = api.colors.fg;

      // hills and clouds, drawn as blocks because 1985
      ctx.save();
      ctx.globalAlpha = 0.12;
      for (let i = 0; i < 40; i++) {
        const hx = i * 220 - (camX % 220) + camX - 220;
        ctx.fillRect(hx, 430, 120, 200);
        ctx.fillRect(hx + 30, 390, 60, 60);
      }
      ctx.globalAlpha = 0.18;
      for (let i = 0; i < 20; i++) {
        const cx2 = i * 420 - ((camX * 0.6) % 420) + camX - 420;
        const cy2 = 90 + (i % 3) * 46;
        ctx.fillRect(cx2, cy2, 86, 26);
        ctx.fillRect(cx2 + 18, cy2 - 18, 50, 24);
        ctx.fillRect(cx2 - 14, cy2 + 8, 28, 18);
        ctx.fillRect(cx2 + 72, cy2 + 8, 28, 18);
      }
      ctx.restore();

      plats.forEach((p) => {
        if (p.vanished > 0.45) return;
        ctx.save();
        ctx.globalAlpha = p.vanished > 0 ? clamp(1 - p.vanished * 2.2, 0, 1) : 1;
        ctx.fillRect(p.x, p.y, p.w, p.h);
        // brick courses
        ctx.fillStyle = api.colors.bg;
        ctx.globalAlpha *= 0.55;
        for (let by = p.y + 10; by < p.y + p.h; by += 14) ctx.fillRect(p.x, by, p.w, 2);
        for (let bx = p.x; bx < p.x + p.w; bx += 26) {
          ctx.fillRect(bx + ((Math.floor((bx - p.x) / 26) % 2) * 13), p.y, 2, p.h);
        }
        ctx.restore();
        ctx.fillStyle = api.colors.fg;
      });

      walkers.forEach((wk) => {
        if (!wk.alive || t < 25) return;
        ctx.fillStyle = api.colors.accent;
        ctx.fillRect(wk.x - 13, wk.y - 8, 26, 26);
        ctx.fillStyle = api.colors.bg;
        ctx.fillRect(wk.x - 8, wk.y - 2, 5, 5);
        ctx.fillRect(wk.x + 3, wk.y - 2, 5, 5);
      });

      // coins
      coins.forEach((c) => {
        if (c.taken || c.x < camX - 40 || c.x > camX + api.w / s + 40) return;
        const w = 10 + Math.abs(Math.sin(t * 5 + c.x * 0.01)) * 10;
        ctx.fillStyle = api.colors.warn;
        ctx.fillRect(c.x - w / 2, c.y - 13, w, 26);
        ctx.fillStyle = api.colors.bg;
        ctx.globalAlpha = 0.45;
        ctx.fillRect(c.x - w / 4, c.y - 7, Math.max(2, w / 2), 14);
        ctx.globalAlpha = 1;
      });

      // flagpole
      ctx.fillStyle = api.colors.fg;
      ctx.fillRect(GOAL_X + 150, 190, 8, 240);
      ctx.fillRect(GOAL_X + 142, 182, 24, 10);
      ctx.fillStyle = api.colors.accent;
      ctx.beginPath();
      ctx.moveTo(GOAL_X + 158, 198);
      ctx.lineTo(GOAL_X + 226, 216);
      ctx.lineTo(GOAL_X + 158, 234);
      ctx.closePath();
      ctx.fill();

      // the runner: cap, face, overall-ish body, two legs that actually move
      const facing = player.vx < 0 ? -1 : 1;
      const stride = player.onGround ? Math.sin(t * 16) * 5 : 4;
      ctx.save();
      ctx.translate(player.x + player.w / 2, player.y);
      ctx.scale(facing, 1);
      ctx.fillStyle = api.colors.accent;
      ctx.fillRect(-11, -2, 22, 8); // cap
      ctx.fillRect(1, 0, 12, 5); // peak
      ctx.fillStyle = api.colors.fg;
      ctx.fillRect(-9, 6, 18, 10); // head
      ctx.fillStyle = api.colors.bg;
      ctx.fillRect(2, 9, 4, 4); // eye
      ctx.fillStyle = api.colors.accent;
      ctx.fillRect(-11, 16, 22, 13); // torso
      ctx.fillStyle = api.colors.fg;
      ctx.fillRect(-15, 17, 5, 9); // arms
      ctx.fillRect(10, 17, 5, 9);
      ctx.fillRect(-9, 29, 7, 7 + stride); // legs
      ctx.fillRect(2, 29, 7, 7 - stride);
      ctx.restore();
      ctx.restore();

      text(api, '1985', 18, 22, 14, { align: 'left', kind: 'mono', alpha: 0.5 });
    },
  } satisfies MiniGame;
}
