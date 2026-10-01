import type { GameApi, MiniGame } from '../core/types';
import { Script, fill, text } from './helpers';

/** Our own layout, drawn in the language of the era: corridors, a pen, four power pellets. */
const MAZE = [
  '###############',
  '#......#......#',
  '#o##.#.#.#.##o#',
  '#.............#',
  '#.##.##.##.##.#',
  '#....#..#..#..#',
  '####.#.###.#.##',
  '#......#......#',
  '#.##.#.#.#.##.#',
  '#....#...#....#',
  '##.#.#.#.#.#.##',
  '#......#......#',
  '#o##.#.#.#.##o#',
  '#....#...#....#',
  '#.##.#.#.#.##.#',
  '#.............#',
  '###############',
];
const COLS = MAZE[0].length;
const ROWS = MAZE.length;
const DOT_TARGET = 30;

interface Mover {
  cx: number;
  cy: number;
  dx: number;
  dy: number;
  prog: number;
  scared?: boolean;
  caught?: boolean;
  home: [number, number];
}

export function create1980(api: GameApi): MiniGame {
  let t = 0;
  let lives = 3;
  let eaten = 0;
  let phasing = false;
  let reversed = false;
  let frightened = 0;
  const walls: boolean[][] = [];
  const dots: number[][] = []; // 0 none, 1 dot, 2 power pellet
  const player: Mover = { cx: 7, cy: 15, dx: 0, dy: 0, prog: 0, home: [7, 15] };
  const ghosts: Mover[] = [];
  let wantX = 0;
  let wantY = 0;

  const cell = () => Math.min(api.w / (COLS + 0.6), (api.h - 30) / (ROWS + 0.4));
  const ox = () => (api.w - cell() * COLS) / 2;
  const oy = () => (api.h - cell() * ROWS) / 2;
  const isWall = (x: number, y: number) =>
    x < 0 || y < 0 || x >= COLS || y >= ROWS ? true : walls[y][x];

  const build = () => {
    for (let y = 0; y < ROWS; y++) {
      walls[y] = [];
      dots[y] = [];
      for (let x = 0; x < COLS; x++) {
        const ch = MAZE[y][x];
        walls[y][x] = ch === '#';
        dots[y][x] = ch === 'o' ? 2 : ch === '.' ? 1 : 0;
      }
    }
    // Flood fill from the start: anything the player cannot reach loses its dot,
    // so a hand-drawn maze can never hide an uncollectable pellet.
    const seen = new Set<string>();
    const queue: [number, number][] = [[player.cx, player.cy]];
    while (queue.length) {
      const [x, y] = queue.pop()!;
      const k = `${x},${y}`;
      if (seen.has(k) || isWall(x, y)) continue;
      seen.add(k);
      queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (!seen.has(`${x},${y}`)) dots[y][x] = 0;
      }
    }
    dots[player.cy][player.cx] = 0;
  };

  const spawnGhosts = () => {
    const spots: [number, number][] = [
      [7, 7],
      [1, 1],
      [13, 1],
    ];
    spots.forEach(([x, y]) => ghosts.push({ cx: x, cy: y, dx: 0, dy: 0, prog: 0, home: [x, y] }));
  };

  const flipTheRules = () => {
    if (reversed) return;
    reversed = true;
    ghosts.forEach((g) => (g.scared = true));
    api.shout('NEW RULES');
    api.say('Now YOU chase THEM. Catch all three.');
    api.audio.jingle([76, 72, 69, 64], 0.08, 'square');
  };

  const script = new Script([
    {
      at: 12,
      run: () => {
        phasing = true;
        api.shout('THE GHOSTS ARE\nTIRED OF LOSING');
        api.say('They have stopped respecting the walls.');
        api.audio.blip(180, 0.5, 'square', 0.3, 90);
      },
    },
    { at: 26, run: () => api.say('They are getting quicker about it.') },
  ]);

  const stepTowards = (m: Mover, tx: number, ty: number, flee: boolean) => {
    const opts: [number, number][] = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    let best: [number, number] | null = null;
    let score = flee ? -Infinity : Infinity;
    for (const [dx, dy] of opts) {
      if (dx === -m.dx && dy === -m.dy && Math.random() < 0.85) continue;
      const nx = m.cx + dx;
      const ny = m.cy + dy;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      if (!phasing && isWall(nx, ny)) continue;
      const d = Math.hypot(nx - tx, ny - ty);
      if (flee ? d > score : d < score) {
        score = d;
        best = [dx, dy];
      }
    }
    m.dx = best ? best[0] : 0;
    m.dy = best ? best[1] : 0;
  };

  return {
    start() {
      build();
      spawnGhosts();
    },

    update(dt) {
      t += dt;
      script.update(t);
      if (frightened > 0) {
        frightened -= dt;
        if (frightened <= 0 && !reversed) ghosts.forEach((g) => (g.scared = false));
      }

      const sw = api.input.swipe;
      if (sw === 'left' || sw === 'right') {
        wantX = sw === 'left' ? -1 : 1;
        wantY = 0;
      } else if (sw === 'up' || sw === 'down') {
        wantY = sw === 'up' ? -1 : 1;
        wantX = 0;
      } else if (api.input.dirX) {
        wantX = api.input.dirX;
        wantY = 0;
      } else if (api.input.dirY) {
        wantY = api.input.dirY;
        wantX = 0;
      }

      if (player.dx === 0 && player.dy === 0) {
        if ((wantX || wantY) && !isWall(player.cx + wantX, player.cy + wantY)) {
          player.dx = wantX;
          player.dy = wantY;
        }
      }
      if (player.dx || player.dy) {
        player.prog += 5.4 * dt;
        if (player.prog >= 1) {
          player.prog = 0;
          player.cx += player.dx;
          player.cy += player.dy;
          const d = dots[player.cy][player.cx];
          if (d) {
            dots[player.cy][player.cx] = 0;
            eaten++;
            if (d === 2) {
              frightened = 6;
              ghosts.forEach((g) => !g.caught && (g.scared = true));
              api.shout('THEY ARE AFRAID');
              api.audio.jingle([48, 55, 60], 0.08, 'square');
            } else {
              api.audio.blip(360 + (eaten % 6) * 40, 0.04, 'square', 0.14);
            }
            if (eaten >= DOT_TARGET && !reversed) flipTheRules();
          }
          if ((wantX || wantY) && !isWall(player.cx + wantX, player.cy + wantY)) {
            player.dx = wantX;
            player.dy = wantY;
          } else if (isWall(player.cx + player.dx, player.cy + player.dy)) {
            player.dx = 0;
            player.dy = 0;
          }
        }
      }

      const gSpeed = t < 2.5 ? 0 : reversed || frightened > 0 ? 3.1 : t > 26 ? 5 : phasing ? 4.5 : 3.5;
      for (const g of ghosts) {
        if (g.caught) continue;
        const flee = !!g.scared;
        if (g.dx === 0 && g.dy === 0) stepTowards(g, player.cx, player.cy, flee);
        g.prog += gSpeed * dt;
        if (g.prog >= 1) {
          g.prog = 0;
          g.cx += g.dx;
          g.cy += g.dy;
          stepTowards(g, player.cx, player.cy, flee);
        }
        const gx = g.cx + g.dx * g.prog;
        const gy = g.cy + g.dy * g.prog;
        const ppx = player.cx + player.dx * player.prog;
        const ppy = player.cy + player.dy * player.prog;
        if (t > 2.5 && Math.hypot(gx - ppx, gy - ppy) < 0.7) {
          if (reversed || frightened > 0) {
            if (reversed) {
              g.caught = true;
              api.audio.jingle([72, 79], 0.07, 'square');
              if (ghosts.every((x) => x.caught)) {
                api.win({ stat: `ALL THREE CAUGHT, ${eaten} DOTS`, score: eaten });
                return;
              }
            } else {
              g.cx = g.home[0];
              g.cy = g.home[1];
              g.prog = 0;
              g.scared = false;
              api.audio.jingle([84, 79, 72], 0.05, 'square');
            }
          } else {
            lives--;
            api.audio.blip(200, 0.4, 'square', 0.3, 60);
            player.cx = player.home[0];
            player.cy = player.home[1];
            player.prog = 0;
            player.dx = 0;
            player.dy = 0;
            ghosts.forEach((x) => {
              x.cx = x.home[0];
              x.cy = x.home[1];
              x.prog = 0;
            });
            if (lives <= 0) {
              api.lose('Caught. Repeatedly.');
              return;
            }
            api.say(`Caught. ${lives} left.`);
          }
        }
      }

      api.hud(
        reversed
          ? `CATCH THEM  ${ghosts.filter((g) => g.caught).length}/3    LIVES ${lives}`
          : `DOTS ${eaten}/${DOT_TARGET}    LIVES ${lives}`,
      );
    },

    draw() {
      const { ctx } = api;
      fill(api);
      const c = cell();
      const X = ox();
      const Y = oy();

      // Walls as double lines, the way the cabinets drew them.
      ctx.strokeStyle = api.colors.fg;
      ctx.lineWidth = Math.max(2, c * 0.1);
      ctx.globalAlpha = phasing ? 0.4 : 1;
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          if (!walls[y][x]) continue;
          const px = X + x * c;
          const py = Y + y * c;
          const inset = c * 0.18;
          // Draw an edge only where this wall block faces open space.
          if (!isWall(x, y - 1)) line(ctx, px + inset, py + inset, px + c - inset, py + inset);
          if (!isWall(x, y + 1)) line(ctx, px + inset, py + c - inset, px + c - inset, py + c - inset);
          if (!isWall(x - 1, y)) line(ctx, px + inset, py + inset, px + inset, py + c - inset);
          if (!isWall(x + 1, y)) line(ctx, px + c - inset, py + inset, px + c - inset, py + c - inset);
        }
      }
      ctx.globalAlpha = 1;

      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const d = dots[y][x];
          if (!d) continue;
          ctx.fillStyle = d === 2 ? api.colors.accent : api.colors.dim;
          const r = d === 2 ? c * 0.22 * (1 + Math.sin(t * 7) * 0.12) : c * 0.08;
          ctx.beginPath();
          ctx.arc(X + x * c + c / 2, Y + y * c + c / 2, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ghosts.forEach((g) => {
        const gx = X + (g.cx + g.dx * g.prog) * c;
        const gy = Y + (g.cy + g.dy * g.prog) * c;
        ctx.save();
        ctx.globalAlpha = g.caught ? 0.16 : 1;
        ctx.fillStyle = g.scared ? api.colors.dim : api.colors.accent;
        ctx.beginPath();
        ctx.arc(gx + c / 2, gy + c * 0.45, c * 0.33, Math.PI, 0);
        ctx.lineTo(gx + c * 0.83, gy + c * 0.82);
        ctx.lineTo(gx + c * 0.67, gy + c * 0.68);
        ctx.lineTo(gx + c * 0.5, gy + c * 0.82);
        ctx.lineTo(gx + c * 0.33, gy + c * 0.68);
        ctx.lineTo(gx + c * 0.17, gy + c * 0.82);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = api.colors.bg;
        ctx.fillRect(gx + c * 0.26, gy + c * 0.33, c * 0.15, c * 0.15);
        ctx.fillRect(gx + c * 0.56, gy + c * 0.33, c * 0.15, c * 0.15);
        ctx.restore();
      });

      const px = X + (player.cx + player.dx * player.prog) * c;
      const py = Y + (player.cy + player.dy * player.prog) * c;
      ctx.fillStyle = api.colors.fg;
      const bite = Math.abs(Math.sin(t * 9)) * 0.3;
      const dir = Math.atan2(player.dy, player.dx);
      ctx.beginPath();
      ctx.moveTo(px + c / 2, py + c / 2);
      ctx.arc(px + c / 2, py + c / 2, c * 0.38, dir + bite, dir - bite + Math.PI * 2);
      ctx.closePath();
      ctx.fill();

      text(api, '1980', 16, api.h - 16, 13, { align: 'left', kind: 'mono', alpha: 0.4 });
    },
  } satisfies MiniGame;
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}
