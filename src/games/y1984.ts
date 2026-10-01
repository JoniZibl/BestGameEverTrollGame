import type { GameApi, MiniGame } from '../core/types';
import { Script, fill, randInt, text, timerBar } from './helpers';

const W = 10;
const H = 18;
const ROUND = 27;

/** Our own block set. Same idea, different shapes — four of them, all ours. */
const SHAPES: number[][][] = [
  [[1, 1, 1, 1]],
  [
    [1, 1],
    [1, 1],
  ],
  [
    [1, 1, 0],
    [0, 1, 1],
  ],
  [
    [0, 1, 0],
    [1, 1, 1],
  ],
  [
    [1, 0, 0],
    [1, 1, 1],
  ],
  [
    [1, 1, 1],
    [0, 0, 1],
  ],
];

const rotate = (m: number[][]) => m[0].map((_, i) => m.map((r) => r[i]).reverse());

/** 1984 — a tidy little puzzle game that gets progressively less tidy. */
export function create1984(api: GameApi): MiniGame {
  let t = 0;
  let speed = 1;
  let lines = 0;
  let fallTimer = 0;
  let moveTimer = 0;
  let topped = false;
  const grid: number[][] = Array.from({ length: H }, () => Array(W).fill(0));
  let piece = { m: SHAPES[0], x: 3, y: 0 };

  const cell = () => Math.min((api.h - 30) / H, api.w / (W + 10));
  const ox = () => (api.w - cell() * W) / 2;
  const oy = () => (api.h - cell() * H) / 2;

  const collides = (m: number[][], px: number, py: number) => {
    for (let y = 0; y < m.length; y++) {
      for (let x = 0; x < m[y].length; x++) {
        if (!m[y][x]) continue;
        const gx = px + x;
        const gy = py + y;
        if (gx < 0 || gx >= W || gy >= H) return true;
        if (gy >= 0 && grid[gy][gx]) return true;
      }
    }
    return false;
  };

  const newPiece = () => {
    const m = SHAPES[randInt(0, SHAPES.length - 1)];
    piece = { m, x: Math.floor((W - m[0].length) / 2), y: -m.length };
    if (collides(m, piece.x, 0)) topped = true;
  };

  const lockPiece = () => {
    piece.m.forEach((row, y) =>
      row.forEach((v, x) => {
        if (v && piece.y + y >= 0) grid[piece.y + y][piece.x + x] = 1;
      }),
    );
    let cleared = 0;
    for (let y = H - 1; y >= 0; y--) {
      if (grid[y].every((v) => v)) {
        grid.splice(y, 1);
        grid.unshift(Array(W).fill(0));
        cleared++;
        y++;
      }
    }
    if (cleared) {
      lines += cleared;
      api.audio.jingle([72, 76, 79].slice(0, cleared + 1), 0.06, 'square');
    } else {
      api.audio.blip(160, 0.06, 'square', 0.16);
    }
    newPiece();
  };

  const bump = (mult: number, line: string) => {
    speed = mult;
    api.shout(`SPEED x${mult}`);
    api.say(line);
    api.audio.blip(300 + mult * 30, 0.2, 'square', 0.25, 700);
  };

  const script = new Script([
    { at: 8, run: () => bump(2, 'Okay. Maybe we made this too easy.') },
    { at: 13, run: () => bump(4, 'Still comfortable?') },
    { at: 18, run: () => bump(8, 'Hm.') },
    { at: 22, run: () => bump(16, 'Right.') },
    { at: 24, run: () => api.say('This is roughly level 29. People trained for years.') },
  ]);

  return {
    start() {
      newPiece();
      api.say('MOVE: ← →   ROTATE: ↑   DROP: SPACE');
    },

    update(dt) {
      t += dt;
      script.update(t);

      if (topped) {
        api.lose('The stack reached the top. It always does.');
        return;
      }

      moveTimer -= dt;
      if (moveTimer <= 0 && api.input.axisX) {
        if (!collides(piece.m, piece.x + api.input.axisX, piece.y)) piece.x += api.input.axisX;
        moveTimer = 0.11;
      }
      if (api.input.justPressed('ArrowUp', 'KeyW')) {
        const r = rotate(piece.m);
        if (!collides(r, piece.x, piece.y)) piece.m = r;
        else if (!collides(r, piece.x - 1, piece.y)) {
          piece.m = r;
          piece.x--;
        }
        api.audio.blip(500, 0.04, 'square', 0.12);
      }
      if (api.input.justPressed('Space') || api.input.actionPressed) {
        while (!collides(piece.m, piece.x, piece.y + 1)) piece.y++;
        lockPiece();
        return;
      }

      const interval = Math.max(0.035, 0.8 / speed);
      fallTimer += dt * (api.input.downKey ? 8 : 1);
      if (fallTimer >= interval) {
        fallTimer = 0;
        if (collides(piece.m, piece.x, piece.y + 1)) lockPiece();
        else piece.y++;
      }

      api.hud(`LINES ${lines}    SPEED x${speed}    ${Math.max(0, ROUND - t).toFixed(0)}s`);
      if (t >= ROUND) api.win({ stat: `${lines} LINES AT x${speed}`, score: lines });
    },

    draw() {
      const { ctx } = api;
      fill(api);
      const c = cell();
      const X = ox();
      const Y = oy();

      ctx.save();
      ctx.globalAlpha = 0.2;
      ctx.strokeStyle = api.colors.fg;
      ctx.lineWidth = 2;
      ctx.strokeRect(X - 2, Y - 2, c * W + 4, c * H + 4);
      ctx.restore();

      const block = (gx: number, gy: number, alpha = 1) => {
        if (gy < 0) return;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = api.colors.fg;
        ctx.fillRect(X + gx * c + 1, Y + gy * c + 1, c - 2, c - 2);
        ctx.fillStyle = api.colors.bg;
        ctx.fillRect(X + gx * c + c * 0.28, Y + gy * c + c * 0.28, c * 0.44, c * 0.44);
        ctx.restore();
      };

      grid.forEach((row, y) => row.forEach((v, x) => v && block(x, y)));
      piece.m.forEach((row, y) => row.forEach((v, x) => v && block(piece.x + x, piece.y + y)));

      // ghost landing position, because 1984 did not have one and it shows
      let gy = piece.y;
      while (!collides(piece.m, piece.x, gy + 1)) gy++;
      piece.m.forEach((row, y) => row.forEach((v, x) => v && block(piece.x + x, gy + y, 0.12)));

      text(api, `x${speed}`, api.w / 2, 24, Math.min(28, api.w / 16), { alpha: speed > 1 ? 0.8 : 0.3 });
      timerBar(api, t, ROUND);
    },
  } satisfies MiniGame;
}
