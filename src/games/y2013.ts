import type { GameApi, MiniGame } from '../core/types';
import { Script, fill, rand, text } from './helpers';

const W = 420;
const H = 640;
const BASE_GAP = 190;

interface Pipe {
  x: number;
  gapY: number;
  passed?: boolean;
}

/** 2013 — one button, two pipes, and a shop. */
export function create2013(api: GameApi): MiniGame {
  let t = 0;
  let score = 0;
  let paused = false;
  let dead = false;
  let gap = 190;
  let target = 14;
  let speed = 150;
  let purchases = 0;
  let askedContinue = false;
  let askedGap = false;
  let askedBird = false;
  const bird = { y: H / 2, vy: 0, rot: 0 };
  const pipes: Pipe[] = [];
  let spawn = 0;

  const ask = (title: string, price: string, lines: string[], onBuy: () => void) => {
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
        onBuy();
        api.say("Relax. We're not actually charging you.");
      },
    });
  };

  const script = new Script(
    [
    {
      at: 12,
      when: () => score >= 3,
      run: () => {
        if (askedGap) return;
        askedGap = true;
        ask('WIDER GAPS', '€2.99', ['The gaps are quite narrow.', 'They need not be.'], () => {
          const was = gap;
          gap = was + 34;
          window.setTimeout(() => {
            gap = was - 12;
            api.say('The wider gaps were a limited-time offer.');
          }, 9000);
        });
      },
    },
    { at: 22, when: () => score >= 5, warn: 'Five. Hm.', run: () => { speed = api.diff.pace(190); api.shout('FASTER'); } },
    {
      at: 30,
      run: () => {
        if (askedBird) return;
        askedBird = true;
        ask('SKIN: SLIGHTLY DIFFERENT BIRD', '€4.99', ['It is the same bird.', 'It is a different colour.'], () => {});
      },
    },
  ],
    { say: api.say, grace: api.diff.grace },
  );

  const reset = () => {
    bird.y = H / 2;
    bird.vy = 0;
    pipes.length = 0;
    spawn = 0;
    dead = false;
  };

  const crash = () => {
    if (dead) return;
    dead = true;
    api.audio.noise(0.35, 0.3, 700);
    if (!askedContinue) {
      askedContinue = true;
      ask('CONTINUE?', '€0.99', ['Carry on from where you fell.', 'A bargain, considering.'], () => {
        reset();
      });
      return;
    }
    api.lose(`${score} pipe${score === 1 ? '' : 's'}. The bird is unbothered.`);
  };

  return {
    start() {
      gap = Math.round(BASE_GAP * (api.diff.isEasy ? 1.22 : api.diff.isHard ? 0.84 : 1));
      speed = api.diff.pace(150);
      target = api.diff.goal(14);
      spawn = 0.6;
    },

    update(dt) {
      if (paused || dead) return;
      t += dt;
      script.update(t);

      if (api.input.jumpPressed || api.input.actionKeyPressed) {
        bird.vy = -300;
        api.audio.blip(520, 0.06, 'square', 0.15, 760);
      }
      bird.vy += 1150 * dt;
      bird.y += bird.vy * dt;
      bird.rot = Math.max(-0.5, Math.min(1.2, bird.vy / 460));

      spawn -= dt;
      if (spawn <= 0) {
        spawn = 1.55 - speed / 900;
        pipes.push({ x: W + 40, gapY: rand(gap * 0.6 + 40, H - gap * 0.6 - 60) });
      }
      for (let i = pipes.length - 1; i >= 0; i--) {
        const p = pipes[i];
        p.x -= speed * dt;
        if (p.x < -90) pipes.splice(i, 1);
        else if (!p.passed && p.x + 30 < 110) {
          p.passed = true;
          score++;
          api.audio.blip(800, 0.06, 'square', 0.16, 1200);
          if (score >= target) {
            api.win({
              stat: purchases === 0 ? `${score} PIPES, NOTHING BOUGHT` : `${score} PIPES, ${purchases} "PURCHASES"`,
              score,
            });
            return;
          }
        }
        const inX = 110 + 18 > p.x && 110 - 18 < p.x + 60;
        if (inX && (bird.y - 16 < p.gapY - gap / 2 || bird.y + 16 > p.gapY + gap / 2)) {
          crash();
          return;
        }
      }

      if (bird.y > H - 30 || bird.y < -20) {
        crash();
        return;
      }

      api.hud(`PIPES ${score}/${target}`);
    },

    draw() {
      const { ctx } = api;
      fill(api);
      const s = Math.min(api.w / W, api.h / H);
      ctx.save();
      ctx.translate((api.w - W * s) / 2, (api.h - H * s) / 2);
      ctx.scale(s, s);

      ctx.fillStyle = api.colors.fg;
      ctx.globalAlpha = 0.14;
      ctx.fillRect(0, H - 26, W, 26);
      ctx.globalAlpha = 1;

      pipes.forEach((p) => {
        ctx.fillStyle = api.colors.accent;
        ctx.fillRect(p.x, 0, 60, p.gapY - gap / 2);
        ctx.fillRect(p.x - 6, p.gapY - gap / 2 - 22, 72, 22);
        ctx.fillRect(p.x, p.gapY + gap / 2, 60, H - (p.gapY + gap / 2));
        ctx.fillRect(p.x - 6, p.gapY + gap / 2, 72, 22);
        ctx.fillStyle = api.colors.bg;
        ctx.globalAlpha = 0.2;
        ctx.fillRect(p.x + 10, 0, 8, p.gapY - gap / 2);
        ctx.fillRect(p.x + 10, p.gapY + gap / 2, 8, H);
        ctx.globalAlpha = 1;
      });

      ctx.save();
      ctx.translate(110, bird.y);
      ctx.rotate(bird.rot);
      ctx.fillStyle = api.colors.fg;
      ctx.fillRect(-18, -14, 36, 28);
      ctx.fillStyle = api.colors.warn;
      ctx.fillRect(14, -4, 12, 8);
      ctx.fillStyle = api.colors.bg;
      ctx.fillRect(4, -9, 9, 9);
      ctx.fillStyle = api.colors.fg;
      ctx.fillRect(6, -7, 4, 5);
      ctx.fillStyle = api.colors.bg;
      const flap = Math.sin(t * 18) * 5;
      ctx.fillRect(-14, -2 + flap, 16, 8);
      ctx.restore();
      ctx.restore();

      text(api, `${score}`, api.w / 2, api.h * 0.12, Math.min(52, api.w / 7), { alpha: 0.25 });
    },
  } satisfies MiniGame;
}
