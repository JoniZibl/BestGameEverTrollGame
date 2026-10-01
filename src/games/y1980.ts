import type { GameApi, MiniGame } from '../core/types';
import { Script, fill, text, timerBar } from './helpers';

const COLS = 13;
const ROWS = 19;

interface Mover {
  cx: number;
  cy: number;
  dx: number;
  dy: number;
  prog: number;
  scared?: boolean;
  caught?: boolean;
}

/** 1980 — dot eating, until the opposition files a complaint. */
export function create1980(api: GameApi): MiniGame {
  let t = 0;
  let lives = 3;
  let eaten = 0;
  let phasing = false;
  let reversed = false;
  const walls: boolean[][] = [];
  const dots: boolean[][] = [];
  let dotTotal = 0;
  const DOT_TARGET = 30;
  const player: Mover = { cx: 1, cy: 1, dx: 0, dy: 0, prog: 0 };
  const ghosts: Mover[] = [];
  let wantX = 0;
  let wantY = 0;

  const cell = () => Math.min(api.w / (COLS + 0.6), (api.h - 30) / (ROWS + 0.4));
  const ox = () => (api.w - cell() * COLS) / 2;
  const oy = () => (api.h - cell() * ROWS) / 2;

  const isWall = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return true;
    return walls[y][x];
  };

  const build = () => {
    for (let y = 0; y < ROWS; y++) {
      walls[y] = [];
      dots[y] = [];
      for (let x = 0; x < COLS; x++) {
        const border = x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1;
        const pillar = x % 2 === 0 && y % 2 === 0;
        const block = (x % 6 === 3 && y > 2 && y < ROWS - 3) || (y % 6 === 3 && x > 3 && x < COLS - 4);
        walls[y][x] = border || pillar || (block && !(x % 4 === 1 || y % 4 === 1));
        dots[y][x] = false;
      }
    }
    for (let y = 1; y < ROWS - 1; y++) {
      for (let x = 1; x < COLS - 1; x++) {
        if (!walls[y][x] && (x + y) % 2 === 0) {
          dots[y][x] = true;
          dotTotal++;
        }
      }
    }
    if (dots[1][1]) {
      dots[1][1] = false;
      dotTotal--;
    }
  };

  const spawnGhosts = () => {
    const spots = [
      [COLS - 2, 1],
      [1, ROWS - 2],
      [COLS - 2, ROWS - 2],
    ];
    spots.forEach(([x, y]) => ghosts.push({ cx: x, cy: y, dx: 0, dy: 0, prog: 0 }));
  };

  const script = new Script([
    { at: 10, run: () => { phasing = true; api.shout('THE GHOSTS ARE\nTIRED OF LOSING'); api.audio.blip(180, 0.5, 'square', 0.3, 90); } },
    { at: 12, run: () => api.say('They have stopped respecting the walls.') },
    { at: 24, run: () => api.say('They are getting quicker about it.') },
  ]);

  const flipTheRules = () => {
    if (reversed) return;
    reversed = true;
    ghosts.forEach((g) => (g.scared = true));
    api.shout('NEW RULES');
    api.say('Now YOU chase THEM. Catch all three.');
    api.audio.jingle([76, 72, 69, 64], 0.08, 'square');
  };

  const stepTowards = (m: Mover, tx: number, ty: number, flee: boolean) => {
    const opts: [number, number][] = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    let best: [number, number] | null = null;
    let bestScore = flee ? -Infinity : Infinity;
    for (const [dx, dy] of opts) {
      if (dx === -m.dx && dy === -m.dy && Math.random() < 0.85) continue;
      if (!phasing && isWall(m.cx + dx, m.cy + dy)) continue;
      if (phasing && (m.cx + dx < 0 || m.cx + dx >= COLS || m.cy + dy < 0 || m.cy + dy >= ROWS)) continue;
      const d = Math.hypot(m.cx + dx - tx, m.cy + dy - ty);
      if (flee ? d > bestScore : d < bestScore) {
        bestScore = d;
        best = [dx, dy];
      }
    }
    if (best) {
      m.dx = best[0];
      m.dy = best[1];
    } else {
      m.dx = 0;
      m.dy = 0;
    }
  };

  return {
    start() {
      build();
      spawnGhosts();
      api.say('MOVE: ARROW KEYS');
    },

    update(dt) {
      t += dt;
      script.update(t);

      if (api.input.axisX) {
        wantX = api.input.axisX;
        wantY = 0;
      } else if (api.input.axisY) {
        wantY = api.input.axisY;
        wantX = 0;
      }

      // player moves cell to cell
      const pSpeed = 5.2;
      if (player.dx === 0 && player.dy === 0) {
        if ((wantX || wantY) && !isWall(player.cx + wantX, player.cy + wantY)) {
          player.dx = wantX;
          player.dy = wantY;
        }
      }
      if (player.dx || player.dy) {
        player.prog += pSpeed * dt;
        if (player.prog >= 1) {
          player.prog = 0;
          player.cx += player.dx;
          player.cy += player.dy;
          if (dots[player.cy][player.cx]) {
            dots[player.cy][player.cx] = false;
            eaten++;
            api.audio.blip(360 + (eaten % 6) * 40, 0.04, 'square', 0.14);
            if (eaten >= DOT_TARGET && !reversed) flipTheRules();
          }
          const next = (wantX || wantY) && !isWall(player.cx + wantX, player.cy + wantY);
          if (next) {
            player.dx = wantX;
            player.dy = wantY;
          } else if (isWall(player.cx + player.dx, player.cy + player.dy)) {
            player.dx = 0;
            player.dy = 0;
          }
        }
      }

      // ghosts
      const gSpeed = t < 2.5 ? 0 : reversed ? 3.4 : t > 24 ? 5.2 : phasing ? 4.6 : 3.4;
      for (const g of ghosts) {
        if (g.caught) continue;
        if (g.dx === 0 && g.dy === 0) stepTowards(g, player.cx, player.cy, !!g.scared);
        g.prog += gSpeed * dt;
        if (g.prog >= 1) {
          g.prog = 0;
          g.cx += g.dx;
          g.cy += g.dy;
          stepTowards(g, player.cx, player.cy, !!g.scared);
        }
        // Compare interpolated positions so a ghost in the next cell is not already a hit.
        const gx = g.cx + g.dx * g.prog;
        const gy = g.cy + g.dy * g.prog;
        const ppx = player.cx + player.dx * player.prog;
        const ppy = player.cy + player.dy * player.prog;
        const touching = t > 2.5 && Math.hypot(gx - ppx, gy - ppy) < 0.7;
        if (touching) {
          if (reversed) {
            if (!g.caught) {
              g.caught = true;
              api.audio.jingle([72, 79], 0.07, 'square');
              if (ghosts.every((x) => x.caught)) {
                api.win({ stat: 'ALL THREE CAUGHT', score: eaten });
                return;
              }
            }
          } else {
            lives--;
            api.audio.blip(200, 0.4, 'square', 0.3, 60);
            player.cx = 1;
            player.cy = 1;
            player.prog = 0;
            player.dx = 0;
            player.dy = 0;
            g.cx = COLS - 2;
            g.cy = ROWS - 2;
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

      ctx.fillStyle = api.colors.fg;
      ctx.globalAlpha = phasing ? 0.45 : 1;
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          if (walls[y]?.[x]) ctx.fillRect(X + x * c + c * 0.1, Y + y * c + c * 0.1, c * 0.8, c * 0.8);
        }
      }
      ctx.globalAlpha = 1;

      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          if (dots[y]?.[x]) {
            ctx.fillStyle = api.colors.dim;
            ctx.fillRect(X + x * c + c * 0.44, Y + y * c + c * 0.44, c * 0.12, c * 0.12);
          }
        }
      }

      const drawMover = (m: Mover, color: string, ghost: boolean) => {
        const gx = X + (m.cx + m.dx * m.prog) * c;
        const gy = Y + (m.cy + m.dy * m.prog) * c;
        ctx.fillStyle = color;
        if (ghost) {
          ctx.save();
          ctx.globalAlpha = m.caught ? 0.18 : 1;
          ctx.beginPath();
          ctx.arc(gx + c / 2, gy + c * 0.45, c * 0.33, Math.PI, 0);
          ctx.lineTo(gx + c * 0.83, gy + c * 0.82);
          ctx.lineTo(gx + c * 0.67, gy + c * 0.68);
          ctx.lineTo(gx + c * 0.5, gy + c * 0.82);
          ctx.lineTo(gx + c * 0.33, gy + c * 0.68);
          ctx.lineTo(gx + c * 0.17, gy + c * 0.82);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        } else {
          const bite = Math.abs(Math.sin(t * 9)) * 0.28;
          const dir = Math.atan2(m.dy, m.dx);
          ctx.beginPath();
          ctx.moveTo(gx + c / 2, gy + c / 2);
          ctx.arc(gx + c / 2, gy + c / 2, c * 0.36, dir + bite, dir - bite + Math.PI * 2);
          ctx.closePath();
          ctx.fill();
        }
      };

      ghosts.forEach((g) => drawMover(g, g.scared ? api.colors.dim : api.colors.accent, true));
      drawMover(player, api.colors.fg, false);

      text(api, '1980', 18, api.h - 18, 14, { align: 'left', kind: 'mono', alpha: 0.4 });
      timerBar(api, t, 55);
    },
  } satisfies MiniGame;
}
