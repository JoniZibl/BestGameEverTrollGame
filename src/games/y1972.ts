import type { GameApi, MiniGame } from '../core/types';
import { Script, circle, clamp, fill, rand, roundRect, text, timerBar } from './helpers';

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

const ROUND = 46;

/**
 * 1972 — two rectangles and a square, played the way a phone wants to hold it:
 * paddles top and bottom, thumb on the bottom one.
 */
export function create1972(api: GameApi): MiniGame {
  let t = 0;
  let lives = 4;
  let rallies = 0;
  let speed = 1;
  let paddleW = 0.26;
  let aiW = 0.22;
  let tilt = 0;
  let tiltTarget = 0;
  let playerX = 0.5;
  let aiX = 0.5;
  let titleFade = 1;
  let mirror = false;
  let ghost = false;
  const balls: Ball[] = [];

  const ballR = () => Math.max(6, Math.min(api.w, api.h) * 0.022);
  const padH = () => Math.max(10, Math.min(api.w, api.h) * 0.022);
  const playerY = () => api.h * 0.93;
  const aiY = () => api.h * 0.07;

  const spawnBall = (dir = Math.random() < 0.5 ? -1 : 1) => {
    const base = Math.min(api.w, api.h);
    balls.push({
      x: api.w / 2 + rand(-api.w * 0.25, api.w * 0.25),
      y: api.h / 2,
      vx: rand(-0.35, 0.35) * base * speed,
      vy: dir * base * 0.62 * speed,
      r: ballR(),
    });
  };

  const script = new Script([
    { at: 5, run: () => api.say('Players in 1972 thought THIS was exciting.') },
    {
      at: 9,
      run: () => {
        speed = 1.35;
        balls.forEach((b) => {
          b.vx *= 1.35;
          b.vy *= 1.35;
        });
        api.say('Faster, then.');
      },
    },
    {
      at: 13,
      run: () => {
        spawnBall();
        api.shout('SECOND BALL');
        api.audio.blip(300, 0.2, 'square', 0.3, 600);
      },
    },
    {
      at: 17,
      run: () => {
        paddleW = 0.14;
        api.say('Your paddle has been downsized. Budget cuts.');
      },
    },
    {
      at: 21,
      run: () => {
        tiltTarget = 0.06;
        api.say('The cabinet is also tilting. Nobody knows why.');
      },
    },
    {
      at: 25,
      run: () => {
        for (let i = 0; i < 6; i++) spawnBall();
        api.shout('EIGHT BALLS');
        api.audio.jingle([60, 62, 64, 65], 0.05, 'square');
      },
    },
    {
      at: 28,
      run: () => {
        aiW = 0.85;
        api.say('The opponent has grown. Historians are unsure how.');
      },
    },
    {
      at: 33,
      run: () => {
        mirror = true;
        api.shout('CONTROLS\nREVERSED');
        api.audio.blip(520, 0.3, 'square', 0.3, 140);
      },
    },
    {
      at: 38,
      run: () => {
        mirror = false;
        ghost = true;
        api.say('Returned to normal. The ball, however, is now shy.');
      },
    },
    {
      at: 43,
      run: () => {
        aiW = 0.2;
        speed = 1.9;
        balls.forEach((b) => {
          b.vx *= 1.3;
          b.vy *= 1.3;
        });
        api.shout('LAST TEN SECONDS');
      },
    },
  ]);

  return {
    start() {
      spawnBall(-1);
    },

    update(dt) {
      t += dt;
      script.update(t);
      titleFade = clamp(1 - (t - 2) / 1.6, 0.12, 1);
      tilt += (tiltTarget * Math.sin(t * 1.4) - tilt) * dt * 3;

      const pw = paddleW * api.w;
      if (api.input.left || api.input.right) {
        playerX += api.input.axisX * (mirror ? -1 : 1) * 1.25 * dt;
      } else if (api.input.pointerDown || !api.input.coarse) {
        const want = mirror ? 1 - api.input.pointerX / api.w : api.input.pointerX / api.w;
        playerX += (want - playerX) * clamp(dt * 12, 0, 1);
      }
      playerX = clamp(playerX, pw / 2 / api.w, 1 - pw / 2 / api.w);

      const aw = aiW * api.w;
      const target = balls.length
        ? balls.reduce((a, b) => (b.vy < 0 && b.y < a.y ? b : a), balls[0])
        : null;
      if (target) {
        aiX += clamp(target.x / api.w - aiX, -1, 1) * (0.9 + speed * 0.5) * dt;
      }
      aiX = clamp(aiX, aw / 2 / api.w, 1 - aw / 2 / api.w);

      const ph = padH();
      for (let i = balls.length - 1; i >= 0; i--) {
        const b = balls[i];
        b.r = ballR();
        b.x += b.vx * dt;
        b.y += b.vy * dt;

        if (b.x < b.r) {
          b.x = b.r;
          b.vx = Math.abs(b.vx);
          api.audio.blip(220, 0.04, 'square', 0.18);
        }
        if (b.x > api.w - b.r) {
          b.x = api.w - b.r;
          b.vx = -Math.abs(b.vx);
          api.audio.blip(220, 0.04, 'square', 0.18);
        }

        // player paddle (bottom)
        if (b.vy > 0 && b.y + b.r > playerY() - ph / 2 && b.y < playerY() + ph * 2) {
          const left = playerX * api.w - pw / 2;
          if (b.x > left && b.x < left + pw) {
            b.y = playerY() - ph / 2 - b.r;
            b.vy = -Math.abs(b.vy) * 1.03;
            b.vx += ((b.x - (left + pw / 2)) / (pw / 2)) * 190;
            rallies++;
            api.audio.blip(520, 0.05, 'square', 0.25);
          }
        }
        // opponent paddle (top)
        if (b.vy < 0 && b.y - b.r < aiY() + ph / 2 && b.y > aiY() - ph * 2) {
          const left = aiX * api.w - aw / 2;
          if (b.x > left && b.x < left + aw) {
            b.y = aiY() + ph / 2 + b.r;
            b.vy = Math.abs(b.vy) * 1.03;
            b.vx += ((b.x - (left + aw / 2)) / (aw / 2)) * 190;
            api.audio.blip(380, 0.05, 'square', 0.22);
          }
        }

        if (b.y > api.h + 60) {
          balls.splice(i, 1);
          lives--;
          api.audio.blip(140, 0.3, 'square', 0.3, 60);
          if (lives <= 0) {
            api.lose('Two rectangles beat you.');
            return;
          }
          spawnBall(1);
        } else if (b.y < -60) {
          balls.splice(i, 1);
          api.audio.blip(660, 0.1, 'square', 0.2);
          spawnBall(1);
        }
      }

      api.hud(`LIVES ${lives}    RALLIES ${rallies}    ${Math.max(0, ROUND - t).toFixed(0)}s`);

      if (t >= ROUND) {
        api.win({
          stat: lives === 4 ? `FLAWLESS · ${rallies} RALLIES` : `${rallies} RALLIES`,
          score: rallies,
        });
      }
    },

    draw() {
      const { ctx } = api;
      fill(api);

      // Size the wordmark first, then hang the year off its baseline, so the two
      // can never collide on a narrow or a short stage.
      const titleSize = Math.min(api.w / 4.4, api.h / 7);
      const yearSize = titleSize * 0.4;
      const titleY = api.h * 0.44;
      text(api, 'PONG', api.w / 2, titleY, titleSize, { alpha: titleFade });
      text(api, '1972', api.w / 2, titleY + titleSize * 0.76, yearSize, { alpha: titleFade });

      ctx.save();
      ctx.translate(api.w / 2, api.h / 2);
      ctx.rotate(tilt);
      ctx.translate(-api.w / 2, -api.h / 2);
      ctx.fillStyle = api.colors.fg;

      const ph = padH();
      const pw = paddleW * api.w;
      const aw = aiW * api.w;
      roundRect(ctx, aiX * api.w - aw / 2, aiY() - ph / 2, aw, ph, ph / 2);
      ctx.fill();
      roundRect(ctx, playerX * api.w - pw / 2, playerY() - ph / 2, pw, ph, ph / 2);
      ctx.fill();

      balls.forEach((b) => {
        // 1972 had no alpha channel. We are taking liberties.
        ctx.globalAlpha = ghost ? 0.35 + Math.abs(Math.sin(t * 7 + b.x * 0.01)) * 0.65 : 1;
        circle(ctx, b.x, b.y, b.r);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      ctx.restore();

      timerBar(api, t, ROUND);
    },
  } satisfies MiniGame;
}
