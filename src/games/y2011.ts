import type { GameApi, MiniGame } from '../core/types';
import { Script, fill, text } from './helpers';

const COLS = 16;
const ROWS = 14;
const GROUND = 9;

type Block = 0 | 1 | 2 | 3; // air, dirt, stone, placed

interface Creep {
  x: number;
  y: number;
  hiss: number;
}

/** 2011 — dig blocks, stack blocks, regret not stacking more before dark. */
export function create2011(api: GameApi): MiniGame {
  let t = 0;
  let held = 0;
  let night = false;
  let hp = 3;
  let survived = 0;
  const grid: Block[][] = [];
  const creeps: Creep[] = [];
  const player = { x: 7.5, y: GROUND - 1 };

  const cell = () => Math.min(api.w / COLS, (api.h - 30) / ROWS);
  const ox = () => (api.w - cell() * COLS) / 2;
  const oy = () => (api.h - cell() * ROWS) / 2;

  const build = () => {
    for (let y = 0; y < ROWS; y++) {
      grid[y] = [];
      for (let x = 0; x < COLS; x++) {
        grid[y][x] = y < GROUND ? 0 : y === GROUND ? 1 : ((Math.random() < 0.25 ? 2 : 1) as Block);
      }
    }
  };

  const script = new Script([
    { at: 3, run: () => api.say('Tap a block to mine it. Tap the sky to place one.') },
    {
      at: 16,
      run: () => {
        api.shout('THE SUN IS\nSETTING');
        api.say('Something comes out at night. Build a wall. Three blocks high.');
      },
    },
    {
      at: 24,
      run: () => {
        night = true;
        creeps.push({ x: 0.5, y: GROUND - 1, hiss: 0 }, { x: COLS - 1.5, y: GROUND - 1, hiss: 0 });
        api.audio.blip(70, 1.2, 'sawtooth', 0.25, 40);
      },
    },
    { at: 34, run: () => creeps.push({ x: 2.5, y: GROUND - 1, hiss: 0 }) },
  ]);

  return {
    start() {
      build();
    },

    update(dt) {
      t += dt;
      script.update(t);

      if (api.input.pointerEdge || api.input.tapped) {
        const c = cell();
        const gx = Math.floor((api.input.pointerX - ox()) / c);
        const gy = Math.floor((api.input.pointerY - oy()) / c);
        if (gx >= 0 && gx < COLS && gy >= 0 && gy < ROWS) {
          const reach = Math.hypot(gx + 0.5 - player.x, gy + 0.5 - player.y) < 4.5;
          if (reach) {
            if (grid[gy][gx]) {
              held += grid[gy][gx] === 2 ? 2 : 1;
              grid[gy][gx] = 0;
              api.audio.blip(220 + Math.random() * 60, 0.07, 'square', 0.16);
            } else if (held > 0) {
              grid[gy][gx] = 3;
              held--;
              api.audio.blip(420, 0.07, 'square', 0.16, 300);
            }
          }
        }
      }

      // walk towards the tap, in a slow blocky way
      player.x += api.input.moveX * 3 * dt;
      player.x = Math.max(0.6, Math.min(COLS - 0.6, player.x));
      let landing = GROUND;
      for (let y = 0; y < ROWS; y++) if (grid[y][Math.floor(player.x)]) { landing = y; break; }
      player.y += (landing - 1 - player.y) * Math.min(1, dt * 8);

      if (night) {
        survived += dt;
        for (const cr of creeps) {
          const dir = Math.sign(player.x - cr.x);
          const ahead = Math.floor(cr.x + dir * 0.6);
          const blocked = grid[Math.floor(cr.y)]?.[ahead] || grid[Math.floor(cr.y) - 1]?.[ahead];
          if (!blocked) cr.x += dir * 1.1 * dt;
          let land = GROUND;
          for (let y = 0; y < ROWS; y++) if (grid[y][Math.floor(cr.x)]) { land = y; break; }
          cr.y += (land - 1 - cr.y) * Math.min(1, dt * 8);
          if (Math.abs(cr.x - player.x) < 0.9 && Math.abs(cr.y - player.y) < 1.2) {
            cr.hiss += dt;
            if (cr.hiss > 1.2) {
              cr.hiss = -3;
              hp--;
              api.audio.noise(0.5, 0.35, 500);
              api.shout('HISS');
              cr.x += dir * -3;
              if (hp <= 0) {
                api.lose('It got close enough to make its point.');
                return;
              }
            }
          } else if (cr.hiss > 0) cr.hiss = 0;
        }
        if (survived > 22) {
          api.win({ stat: `SURVIVED THE NIGHT WITH ${hp} HEARTS` });
          return;
        }
      }

      api.hud(
        night
          ? `NIGHT  ${Math.max(0, 22 - survived).toFixed(0)}s    HEARTS ${hp}    BLOCKS ${held}`
          : `DAY    ${Math.max(0, 24 - t).toFixed(0)}s TO DUSK    BLOCKS ${held}`,
      );
    },

    draw() {
      const { ctx } = api;
      fill(api, night ? undefined : undefined);
      const c = cell();
      const X = ox();
      const Y = oy();

      // sky
      ctx.globalAlpha = night ? 0.82 : 0.1;
      ctx.fillStyle = night ? api.colors.fg : api.colors.accent;
      ctx.fillRect(X, Y, c * COLS, c * GROUND);
      ctx.globalAlpha = 1;

      // sun / moon
      ctx.fillStyle = night ? api.colors.bg : api.colors.warn;
      ctx.fillRect(X + c * (night ? 2 : 12), Y + c * 1.2, c * 1.2, c * 1.2);

      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const b = grid[y][x];
          if (!b) continue;
          const px = X + x * c;
          const py = Y + y * c;
          ctx.fillStyle = b === 2 ? api.colors.dim : b === 3 ? api.colors.accent : api.colors.fg;
          ctx.fillRect(px, py, c, c);
          ctx.fillStyle = api.colors.bg;
          ctx.globalAlpha = 0.18;
          ctx.fillRect(px + 2, py + 2, c - 4, 3);
          ctx.fillRect(px + 2, py + c * 0.45, c * 0.3, 3);
          ctx.globalAlpha = 1;
        }
      }

      // player
      ctx.fillStyle = api.colors.accent;
      ctx.fillRect(X + (player.x - 0.3) * c, Y + (player.y - 0.9) * c, c * 0.6, c * 1.8);
      ctx.fillStyle = api.colors.bg;
      ctx.fillRect(X + (player.x - 0.2) * c, Y + (player.y - 0.75) * c, c * 0.12, c * 0.14);
      ctx.fillRect(X + (player.x + 0.05) * c, Y + (player.y - 0.75) * c, c * 0.12, c * 0.14);

      creeps.forEach((cr) => {
        ctx.fillStyle = cr.hiss > 0.4 ? api.colors.bg : api.colors.fg;
        ctx.fillRect(X + (cr.x - 0.35) * c, Y + (cr.y - 0.9) * c, c * 0.7, c * 1.8);
        ctx.fillStyle = cr.hiss > 0.4 ? api.colors.accent : api.colors.bg;
        ctx.fillRect(X + (cr.x - 0.24) * c, Y + (cr.y - 0.7) * c, c * 0.14, c * 0.16);
        ctx.fillRect(X + (cr.x + 0.1) * c, Y + (cr.y - 0.7) * c, c * 0.14, c * 0.16);
        ctx.fillRect(X + (cr.x - 0.1) * c, Y + (cr.y - 0.45) * c, c * 0.2, c * 0.2);
      });

      text(api, `BLOCKS ${held}`, X + 6, Y + 18, 14, { align: 'left', kind: 'mono', alpha: 0.6 });
    },
  } satisfies MiniGame;
}
