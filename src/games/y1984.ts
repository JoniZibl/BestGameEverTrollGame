import type { GameApi, MiniGame } from '../core/types';
import { Script, fill, randInt, text, timerBar } from './helpers';

const W = 10;
const H = 18;
const BASE_ROUND = 45;
const BASE_TARGET = 4;

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
  const ROUND = api.diff.time(BASE_ROUND);
  const LINE_TARGET = api.diff.goal(BASE_TARGET);
  let fallTimer = 0;
  let moveTimer = 0;
  let topped = false;
  let done = false;
  const grid: number[][] = Array.from({ length: H }, () => Array(W).fill(0));
  let piece = { m: SHAPES[0], x: 3, y: 0 };
  let nextIdx = randInt(0, SHAPES.length - 1);

  // Leave the top of the stage free: that is where the control caption sits.
  const top = () => api.h * 0.15;
  const cell = () => Math.min((api.h - top() - 26) / H, api.w / (W + 2.2));
  const ox = () => (api.w - cell() * W) / 2;
  const oy = () => top();

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
    const idx = nextIdx;
    nextIdx = randInt(0, SHAPES.length - 1);
    const m = SHAPES[idx];
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
      if (lines >= LINE_TARGET) {
        done = true;
        api.win({ stat: `${lines} LINES AT x${speed}`, score: lines });
        return;
      }
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

  // Each speed step waits for a line, so it reads as a reply to the player
  // rather than a clock running out.
  const script = new Script(
    [
      { at: 12, when: () => lines >= 1, run: () => bump(2, 'Okay. Maybe we made this too easy.') },
      { at: 20, when: () => lines >= 2, run: () => bump(3, 'Still comfortable?') },
      { at: 27, when: () => lines >= 3, warn: 'Hm.', run: () => bump(5, 'Hm.') },
      { at: 33, when: () => lines >= LINE_TARGET - 1, warn: 'One line left. About that.', run: () => bump(8, 'You are doing better than expected.') },
      { at: 39, warn: 'Right.', run: () => bump(16, 'Right.') },
      { at: 41, run: () => api.say('This is roughly level 29. People trained for years.') },
    ],
    { say: api.say, grace: api.diff.grace },
  );

  return {
    start() {
      newPiece();
    },

    update(dt) {
      if (done) return;
      t += dt;
      script.update(t);

      if (topped) {
        api.lose('The stack reached the top. It always does.');
        return;
      }

      moveTimer -= dt;
      const swipe = api.input.swipe;
      const sideways = swipe === 'left' ? -1 : swipe === 'right' ? 1 : 0;
      if (sideways && !collides(piece.m, piece.x + sideways, piece.y)) {
        piece.x += sideways;
        api.audio.blip(300, 0.03, 'square', 0.1);
      }
      if (moveTimer <= 0 && api.input.axisX) {
        if (!collides(piece.m, piece.x + api.input.axisX, piece.y)) piece.x += api.input.axisX;
        moveTimer = 0.11;
      }
      if (api.input.justPressed('ArrowUp', 'KeyW') || api.input.tapped) {
        const r = rotate(piece.m);
        if (!collides(r, piece.x, piece.y)) piece.m = r;
        else if (!collides(r, piece.x - 1, piece.y)) {
          piece.m = r;
          piece.x--;
        }
        api.audio.blip(500, 0.04, 'square', 0.12);
      }
      if (api.input.justPressed('Space') || api.input.swipe === 'down' || api.input.secondTap) {
        while (!collides(piece.m, piece.x, piece.y + 1)) piece.y++;
        lockPiece();
        return;
      }

      const interval = Math.max(0.035, 0.8 / api.diff.pace(speed));
      fallTimer += dt * (api.input.downKey ? 8 : 1);
      if (fallTimer >= interval) {
        fallTimer = 0;
        if (collides(piece.m, piece.x, piece.y + 1)) lockPiece();
        else piece.y++;
      }

      api.hud(
        `LINES ${lines}/${LINE_TARGET}    SPEED x${speed}    ${Math.max(0, ROUND - t).toFixed(0)}s`,
      );
      if (t >= ROUND) api.lose(`Time ran out on ${lines} line${lines === 1 ? '' : 's'}.`);
    },

    draw() {
      const { ctx } = api;
      fill(api);
      const c = cell();
      const X = ox();
      const Y = oy();

      ctx.save();
      ctx.globalAlpha = 0.22;
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
      piece.m.forEach((row, y) => row.forEach((v, x) => v && block(piece.x + x, gy + y, 0.14)));

      // NEXT preview, bottom right of the well
      const nm = SHAPES[nextIdx];
      const sideRoom = X + c * W + c * 2.8 < api.w;
      const bx = sideRoom ? X + c * W + c * 0.5 : X;
      const by = sideRoom ? Y + 8 : Math.max(26, Y - c * 1.5);
      text(api, 'NEXT', bx, by - 9, 11, { align: 'left', kind: 'mono', alpha: 0.5 });
      nm.forEach((row, y) =>
        row.forEach((v, x) => {
          if (!v) return;
          ctx.save();
          ctx.globalAlpha = 0.75;
          ctx.fillStyle = api.colors.fg;
          const nc = c * 0.55;
          ctx.fillRect(bx + x * nc + 1, by + 4 + y * nc + 1, nc - 2, nc - 2);
          ctx.fillStyle = api.colors.bg;
          ctx.fillRect(bx + x * nc + nc * 0.3, by + 4 + y * nc + nc * 0.3, nc * 0.4, nc * 0.4);
          ctx.restore();
        }),
      );
      text(api, `x${speed}`, api.w / 2, 20, Math.min(26, api.w / 17), { alpha: speed > 1 ? 0.8 : 0.3 });
      timerBar(api, t, ROUND);
    },
  } satisfies MiniGame;
}
