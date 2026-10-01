import type { GameApi, MiniGame } from '../core/types';
import { Script, fill, randInt, text } from './helpers';

const COLS = 17;
const ROWS = 15;

interface Cell {
  x: number;
  y: number;
}

/** 1997 — the one that came free with the phone, and ate everyone's lunch breaks. */
export function create1997(api: GameApi): MiniGame {
  let t = 0;
  let step = 0;
  let rate = 6.5;
  let target = 12;
  let grow = 3;
  let eaten = 0;
  let pending = 0;
  let walls = true;
  let dx = 1;
  let dy = 0;
  let queued: Cell | null = null;
  let food: Cell = { x: 12, y: 7 };
  const snake: Cell[] = [
    { x: 5, y: 7 },
    { x: 4, y: 7 },
    { x: 3, y: 7 },
  ];

  const cell = () => Math.min(api.w / (COLS + 1.2), (api.h - 30) / (ROWS + 1.2));
  const ox = () => (api.w - cell() * COLS) / 2;
  const oy = () => (api.h - cell() * ROWS) / 2;

  const placeFood = () => {
    for (let i = 0; i < 200; i++) {
      const c = { x: randInt(0, COLS - 1), y: randInt(0, ROWS - 1) };
      if (!snake.some((s) => s.x === c.x && s.y === c.y)) {
        food = c;
        return;
      }
    }
  };

  const script = new Script(
    [
    { at: 12, when: () => eaten >= 3, run: () => { rate = api.diff.pace(9); api.say('It speeds up. That is the entire design document.'); } },
    { at: 22, when: () => eaten >= 6, warn: 'Six. Of course.', run: () => { rate = api.diff.pace(13); api.shout('FASTER'); } },
    { at: 32, when: () => eaten >= 9, run: () => { grow = 6; api.say('Each pellet is worth more now. Sorry.'); } },
    {
      at: 42,
      warn: 'One more thing.',
      run: () => {
        walls = false;
        api.shout('WALLS OFF');
        api.say('Edges wrap. This is widely considered the easy mode.');
      },
    },
    ],
    { say: api.say, grace: api.diff.grace },
  );

  return {
    start() {
      rate = api.diff.pace(6.5);
      target = api.diff.goal(12);
      placeFood();
    },

    update(dt) {
      t += dt;
      script.update(t);

      const sw = api.input.swipe;
      const want: Cell | null =
        sw === 'left'
          ? { x: -1, y: 0 }
          : sw === 'right'
            ? { x: 1, y: 0 }
            : sw === 'up'
              ? { x: 0, y: -1 }
              : sw === 'down'
                ? { x: 0, y: 1 }
                : api.input.dirX
                  ? { x: api.input.dirX, y: 0 }
                  : api.input.dirY
                    ? { x: 0, y: api.input.dirY }
                    : null;
      if (want && !(want.x === -dx && want.y === -dy)) queued = want;

      step += dt * rate;
      if (step < 1) return;
      step = 0;

      if (queued) {
        dx = queued.x;
        dy = queued.y;
        queued = null;
      }

      const head = { x: snake[0].x + dx, y: snake[0].y + dy };
      if (walls && (head.x < 0 || head.y < 0 || head.x >= COLS || head.y >= ROWS)) {
        api.lose('Into the wall, at speed.');
        return;
      }
      head.x = (head.x + COLS) % COLS;
      head.y = (head.y + ROWS) % ROWS;
      if (snake.some((s) => s.x === head.x && s.y === head.y)) {
        api.lose('You ate yourself. Classic.');
        return;
      }

      snake.unshift(head);
      if (head.x === food.x && head.y === food.y) {
        eaten++;
        api.audio.blip(600 + eaten * 30, 0.06, 'square', 0.2);
        placeFood();
        pending += grow;
        if (eaten >= target) {
          api.win({ stat: `${eaten} PELLETS, LENGTH ${snake.length}`, score: eaten });
          return;
        }
      }
      if (pending > 0) pending--;
      else snake.pop();

      api.hud(`PELLETS ${eaten}/${target}    LENGTH ${snake.length}`);
    },

    draw() {
      const { ctx } = api;
      fill(api);
      const c = cell();
      const X = ox();
      const Y = oy();

      // LCD grid, faint, like the dead pixels behind the game
      ctx.globalAlpha = 0.07;
      ctx.fillStyle = api.colors.fg;
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          ctx.fillRect(X + x * c + 1, Y + y * c + 1, c - 2, c - 2);
        }
      }
      ctx.globalAlpha = 1;

      ctx.strokeStyle = api.colors.fg;
      ctx.lineWidth = 2;
      ctx.globalAlpha = walls ? 0.7 : 0.15;
      ctx.strokeRect(X - 4, Y - 4, c * COLS + 8, c * ROWS + 8);
      ctx.globalAlpha = 1;

      ctx.fillStyle = api.colors.fg;
      snake.forEach((s, i) => {
        const pad = i === 0 ? 1 : 2;
        ctx.fillRect(X + s.x * c + pad, Y + s.y * c + pad, c - pad * 2, c - pad * 2);
        if (i === 0) {
          ctx.fillStyle = api.colors.bg;
          ctx.fillRect(X + s.x * c + c * 0.3, Y + s.y * c + c * 0.3, c * 0.4, c * 0.4);
          ctx.fillStyle = api.colors.fg;
        }
      });

      ctx.fillStyle = api.colors.accent;
      const pulse = 1 + Math.sin(t * 8) * 0.1;
      ctx.fillRect(
        X + food.x * c + c * (0.5 - 0.3 * pulse),
        Y + food.y * c + c * (0.5 - 0.3 * pulse),
        c * 0.6 * pulse,
        c * 0.6 * pulse,
      );

      text(api, 'NOKIA-ERA RULES APPLY', api.w / 2, Y - 18, 12, { kind: 'mono', alpha: 0.4 });
    },
  } satisfies MiniGame;
}
