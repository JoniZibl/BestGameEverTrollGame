import type { GameApi, MiniGame } from '../core/types';
import { Script, clamp, fill, text } from './helpers';

const MAP = [
  '################',
  '#..............#',
  '#..##....####..#',
  '#..##.......#..#',
  '#.......##..#..#',
  '#..####.##.....#',
  '#..#...........#',
  '#..#..#####.##.#',
  '#.....#.....##.#',
  '#..####...#....#',
  '#.........#..#.#',
  '#..#####..#..#.#',
  '#..#......#....#',
  '#..#..######...#',
  '#..............#',
  '################',
];

interface Sprite {
  x: number;
  y: number;
  alive: boolean;
  hurt: number;
}

/** 1993 — one extra dimension, rendered by a maths trick and a lot of nerve. */
export function create1993(api: GameApi): MiniGame {
  let t = 0;
  let hp = 3;
  let kills = 0;
  let fov = 0.66;
  let fovWarp = 0;
  let breathe = 0;
  let flash = 0;
  let cool = 0;
  const px = { x: 1.5, y: 1.5, dir: 0 };
  const sprites: Sprite[] = [
    { x: 12.5, y: 2.5, alive: true, hurt: 0 },
    { x: 3.5, y: 12.5, alive: true, hurt: 0 },
    { x: 12.5, y: 13.5, alive: true, hurt: 0 },
  ];

  const solid = (x: number, y: number) => {
    const row = MAP[Math.floor(y)];
    if (!row) return true;
    return row[Math.floor(x)] !== '.';
  };

  const script = new Script([
    { at: 1.2, run: () => api.shout('WELCOME TO THE\nTHIRD DIMENSION') },
    { at: 6, run: () => api.say('It is not actually three dimensions. Do not tell anyone.') },
    { at: 14, run: () => { breathe = 1; api.say('The walls are breathing. That is a rendering feature.'); } },
    {
      at: 22,
      run: () => {
        fovWarp = 1;
        api.shout('FIELD OF VIEW: YES');
        api.audio.blip(90, 0.8, 'sawtooth', 0.25, 400);
      },
    },
    { at: 28, run: () => { fovWarp = 0; api.say('Sorry. Settings menu was still a few years away.'); } },
  ]);

  return {
    start() {
      api.say('MOVE: ↑ ↓   TURN: ← →   SHOOT: SPACE');
    },

    update(dt) {
      t += dt;
      script.update(t);
      cool -= dt;
      flash = Math.max(0, flash - dt * 4);
      fov = 0.66 + (fovWarp ? Math.sin(t * 2.2) * 1.5 + 1.4 : 0);

      px.dir += -api.input.axisX * 2.1 * dt * -1;
      const mv = (api.input.up ? 1 : 0) - (api.input.downKey ? 1 : 0);
      const nx = px.x + Math.cos(px.dir) * mv * 2.6 * dt;
      const ny = px.y + Math.sin(px.dir) * mv * 2.6 * dt;
      if (!solid(nx, px.y)) px.x = nx;
      if (!solid(px.x, ny)) px.y = ny;

      if (api.input.actionPressed && cool <= 0) {
        cool = 0.45;
        flash = 1;
        api.audio.noise(0.18, 0.35, 2600);
        api.audio.blip(150, 0.18, 'square', 0.25, 60);
        // hit whatever is closest to the centre of the screen
        let best: Sprite | null = null;
        let bestAngle = 0.22;
        for (const s of sprites) {
          if (!s.alive) continue;
          const a = Math.atan2(s.y - px.y, s.x - px.x) - px.dir;
          const norm = Math.atan2(Math.sin(a), Math.cos(a));
          const d = Math.hypot(s.x - px.x, s.y - px.y);
          if (Math.abs(norm) < bestAngle && d < 11) {
            bestAngle = Math.abs(norm);
            best = s;
          }
        }
        if (best) {
          best.alive = false;
          best.hurt = 1;
          kills++;
          api.audio.blip(240, 0.3, 'sawtooth', 0.3, 80);
          if (kills === 1) api.say('Three dimensions. Two of them are fake.');
          if (kills >= 3) {
            api.win({ stat: `CLEARED IN ${t.toFixed(0)}s`, score: kills });
            return;
          }
        }
      }

      for (const s of sprites) {
        if (!s.alive) continue;
        const d = Math.hypot(s.x - px.x, s.y - px.y);
        if (d < 6) {
          const sx = s.x + ((px.x - s.x) / d) * 1.1 * dt;
          const sy = s.y + ((px.y - s.y) / d) * 1.1 * dt;
          if (!solid(sx, s.y)) s.x = sx;
          if (!solid(s.x, sy)) s.y = sy;
        }
        if (d < 0.7) {
          hp--;
          api.audio.noise(0.4, 0.3, 500);
          s.x += (s.x - px.x) * 2;
          s.y += (s.y - px.y) * 2;
          if (hp <= 0) {
            api.lose('Something in the corridor got you.');
            return;
          }
        }
      }

      api.hud(`HEALTH ${hp}    TARGETS ${3 - kills}`);
    },

    draw() {
      const { ctx } = api;
      const W = api.w;
      const H = api.h;
      fill(api);

      // ceiling + floor
      ctx.fillStyle = api.colors.fg;
      ctx.globalAlpha = 0.08;
      ctx.fillRect(0, 0, W, H / 2);
      ctx.globalAlpha = 0.18;
      ctx.fillRect(0, H / 2, W, H / 2);
      ctx.globalAlpha = 1;

      const cols = Math.min(320, Math.floor(W / 2));
      const colW = W / cols;
      const zbuf: number[] = new Array(cols);
      const dirX = Math.cos(px.dir);
      const dirY = Math.sin(px.dir);
      const planeX = -dirY * fov;
      const planeY = dirX * fov;

      for (let c = 0; c < cols; c++) {
        const camX = (2 * c) / cols - 1;
        const rdx = dirX + planeX * camX;
        const rdy = dirY + planeY * camX;
        let mapX = Math.floor(px.x);
        let mapY = Math.floor(px.y);
        const ddx = Math.abs(1 / (rdx || 1e-6));
        const ddy = Math.abs(1 / (rdy || 1e-6));
        let stepX: number;
        let stepY: number;
        let sideX: number;
        let sideY: number;
        if (rdx < 0) {
          stepX = -1;
          sideX = (px.x - mapX) * ddx;
        } else {
          stepX = 1;
          sideX = (mapX + 1 - px.x) * ddx;
        }
        if (rdy < 0) {
          stepY = -1;
          sideY = (px.y - mapY) * ddy;
        } else {
          stepY = 1;
          sideY = (mapY + 1 - px.y) * ddy;
        }
        let side = 0;
        let steps = 0;
        while (steps++ < 64) {
          if (sideX < sideY) {
            sideX += ddx;
            mapX += stepX;
            side = 0;
          } else {
            sideY += ddy;
            mapY += stepY;
            side = 1;
          }
          if (MAP[mapY]?.[mapX] !== '.') break;
        }
        let dist = side === 0 ? sideX - ddx : sideY - ddy;
        dist = Math.max(0.05, dist);
        zbuf[c] = dist;
        let lineH = H / dist;
        if (breathe) lineH *= 1 + Math.sin(t * 3 + mapX + mapY) * 0.06;
        // Dark-on-cream: a wall in your face would otherwise black out the screen.
        const shade = clamp(0.3 + (1 - dist / 14) * 0.5, 0.18, 0.82) * (side ? 0.78 : 1);
        ctx.globalAlpha = shade;
        ctx.fillStyle = api.colors.fg;
        ctx.fillRect(c * colW, H / 2 - lineH / 2, colW + 1, lineH);
      }
      ctx.globalAlpha = 1;

      // sprites, depth-tested against the wall buffer
      const order = sprites
        .map((s) => ({ s, d: (s.x - px.x) ** 2 + (s.y - px.y) ** 2 }))
        .sort((a, b) => b.d - a.d);
      for (const { s } of order) {
        if (!s.alive) continue;
        const sx = s.x - px.x;
        const sy = s.y - px.y;
        const inv = 1 / (planeX * dirY - dirX * planeY);
        const tx = inv * (dirY * sx - dirX * sy);
        const ty = inv * (-planeY * sx + planeX * sy);
        if (ty <= 0.1) continue;
        const screenX = (W / 2) * (1 + tx / ty);
        const size = Math.abs(H / ty) * 0.75;
        const col = Math.floor((screenX / W) * cols);
        if (col < 0 || col >= cols || zbuf[col] < ty) continue;
        ctx.save();
        ctx.fillStyle = api.colors.accent;
        ctx.globalAlpha = clamp(1 - ty / 14, 0.15, 1);
        ctx.fillRect(screenX - size * 0.22, H / 2 - size * 0.3, size * 0.44, size * 0.6);
        ctx.fillRect(screenX - size * 0.16, H / 2 - size * 0.46, size * 0.32, size * 0.2);
        ctx.restore();
      }

      // gun
      ctx.fillStyle = api.colors.fg;
      const gw = Math.min(W * 0.2, 160);
      const bob = Math.sin(t * 7) * 6 * (api.input.up ? 1 : 0);
      ctx.fillRect(W / 2 - gw / 2, H - gw * 0.75 + bob, gw, gw);
      ctx.fillStyle = api.colors.bg;
      ctx.fillRect(W / 2 - gw * 0.12, H - gw * 0.85 + bob, gw * 0.24, gw * 0.3);
      if (flash > 0) {
        ctx.save();
        ctx.globalAlpha = flash;
        ctx.fillStyle = api.colors.warn;
        ctx.beginPath();
        ctx.arc(W / 2, H - gw * 0.85 + bob, gw * 0.3 * flash, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // crosshair
      ctx.strokeStyle = api.colors.accent;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(W / 2 - 12, H / 2);
      ctx.lineTo(W / 2 + 12, H / 2);
      ctx.moveTo(W / 2, H / 2 - 12);
      ctx.lineTo(W / 2, H / 2 + 12);
      ctx.stroke();

      text(api, '1993', 18, 22, 14, { align: 'left', kind: 'mono', alpha: 0.5 });
    },
  } satisfies MiniGame;
}
