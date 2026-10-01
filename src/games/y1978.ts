import type { GameApi, MiniGame } from '../core/types';
import { Script, aabb, clamp, dist, fill, rand, text, timerBar } from './helpers';

interface Alien {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  hp: number;
  boss?: boolean;
}

interface Shot {
  x: number;
  y: number;
  vy: number;
  from: 'player' | 'alien';
}

/** 1978 — the aliens start as a polite grid and end as a personal problem. */
export function create1978(api: GameApi): MiniGame {
  let t = 0;
  let lives = api.diff.lives(4);
  let kills = 0;
  let cool = 0;
  let dodge = false;
  let split = false;
  let homing = false;
  let rate = 1;
  let bossSpawned = false;
  let wave = 1;
  let shields = false;
  let px = 0;
  let invuln = 0;
  const aliens: Alien[] = [];
  const shots: Shot[] = [];
  /** Four shields, each a grid of chunks that both sides can chew through. */
  const bunkers: { x: number; y: number; cells: boolean[][] }[] = [];

  const u = () => Math.min(api.w, api.h) / 600;
  const playerW = () => 46 * u() * 1.4;
  const playerY = () => api.h - 46 * u() * 1.4;

  const spawnWave = (rows = 3, cols = 7) => {
    const sz = 26 * u() * 1.4;
    const gapX = (api.w * 0.8) / cols;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        aliens.push({
          x: api.w * 0.1 + gapX * (c + 0.5),
          y: 70 * u() * 1.4 + r * sz * 2,
          vx: 40 * u() * 1.4,
          vy: 0,
          size: sz,
          hp: shields ? 2 : 1,
        });
      }
    }
  };

  const spawnBoss = () => {
    bossSpawned = true;
    aliens.length = 0;
    aliens.push({
      x: api.w / 2,
      y: api.h * 0.3,
      vx: 90,
      vy: 0,
      size: Math.min(api.w, api.h) * 0.34,
      hp: api.diff.goal(18),
      boss: true,
    });
    api.shout('OH');
    api.audio.blip(70, 1.2, 'sawtooth', 0.3, 40);
  };

  const script = new Script(
    [
      {
        at: 8,
        when: () => kills >= 6,
        warn: 'They have been watching your aim.',
        run: () => { dodge = true; api.say('Apparently the aliens learned something.'); },
      },
      { at: 14, when: () => kills >= 14, run: () => { rate = api.diff.pace(1.7); api.say('And they have been practising.'); } },
      { at: 20, when: () => wave >= 2, warn: 'Right.', run: () => { split = true; api.shout('THEY SPLIT NOW'); } },
      { at: 27, run: () => { homing = true; api.say('They know where you live.'); } },
      { at: 33, when: () => wave >= 3, run: () => { shields = true; api.say('Now with shields. Two hits each.'); } },
      { at: 40, when: () => wave >= 3 && kills >= 34, warn: 'Something larger is coming.', run: () => spawnBoss() },
    ],
    { say: api.say, grace: api.diff.grace },
  );

  const buildBunkers = () => {
    bunkers.length = 0;
    const scale = u() * 1.4;
    const bw = 7;
    const bh = 4;
    for (let i = 0; i < 4; i++) {
      const cells: boolean[][] = [];
      for (let y = 0; y < bh; y++) {
        cells[y] = [];
        for (let x = 0; x < bw; x++) {
          // notch out the underside arch
          cells[y][x] = !(y >= bh - 2 && x > 1 && x < bw - 2);
        }
      }
      bunkers.push({
        x: api.w * (0.14 + i * 0.24),
        y: api.h - 120 * scale,
        cells,
      });
    }
  };

  /** Returns true when the shot chewed a hole instead of flying on. */
  const hitBunker = (x: number, y: number) => {
    const scale = u() * 1.4;
    const cs = 9 * scale;
    for (const b of bunkers) {
      for (let cy = 0; cy < b.cells.length; cy++) {
        for (let cx = 0; cx < b.cells[cy].length; cx++) {
          if (!b.cells[cy][cx]) continue;
          const bx = b.x + cx * cs;
          const by = b.y + cy * cs;
          if (x > bx && x < bx + cs && y > by && y < by + cs) {
            b.cells[cy][cx] = false;
            return true;
          }
        }
      }
    }
    return false;
  };

  return {
    start() {
      px = api.w / 2;
      buildBunkers();
      spawnWave();
    },

    update(dt) {
      t += dt;
      script.update(t);
      invuln = Math.max(0, invuln - dt);
      const scale = u() * 1.4;

      px = clamp(px + api.input.axisX * 430 * scale * dt, playerW() / 2, api.w - playerW() / 2);
      if (api.input.pointerDown) {
        px = clamp(api.input.pointerX, playerW() / 2, api.w - playerW() / 2);
      }

      cool -= dt;
      if (api.input.action && cool <= 0) {
        cool = 0.2;
        shots.push({ x: px, y: playerY(), vy: -620 * scale, from: 'player' });
        api.audio.blip(900, 0.06, 'square', 0.18, 420);
      }

      if (!bossSpawned && aliens.length === 0) {
        wave++;
        lives++;
        api.shout('EXTRA SHIP');
        api.audio.jingle([72, 76, 79, 84], 0.06, 'square');
        spawnWave(3, wave >= 3 ? 8 : 7);
        api.say(wave === 2 ? 'They brought friends.' : `Wave ${wave}. Nobody is counting but you.`);
      }

      // One bullet budget for the whole screen, so the pressure is readable.
      const incoming = shots.filter((sh) => sh.from === 'alien').length;
      const cap = Math.min(5, 3 + Math.floor(t / 15));

      // aliens
      for (const a of aliens) {
        if (a.boss) {
          a.x += a.vx * dt;
          if (a.x < a.size / 2 || a.x > api.w - a.size / 2) a.vx *= -1;
          a.y = api.h * 0.3 + Math.sin(t * 1.5) * 20 * scale;
          if (incoming < cap && Math.random() < api.diff.pace(1.25) * dt) {
            shots.push({
              x: a.x + rand(-a.size / 3, a.size / 3),
              y: a.y + a.size / 2,
              vy: 300 * scale,
              from: 'alien',
            });
          }
          continue;
        }
        a.x += a.vx * api.diff.pace(rate) * dt;
        a.y += 7 * api.diff.pace(rate) * scale * dt;
        if (a.x < a.size || a.x > api.w - a.size) {
          a.vx *= -1;
          a.y += 14 * scale;
        }
        if (homing) {
          a.x += Math.sign(px - a.x) * 60 * scale * dt;
        } else if (dodge) {
          const threat = shots.find(
            (s) => s.from === 'player' && Math.abs(s.x - a.x) < a.size && s.y > a.y && s.y < a.y + 260 * scale,
          );
          if (threat) a.x += Math.sign(a.x - threat.x || 1) * 240 * scale * dt;
        }
        // Arcade rule: only so many enemy bullets at once, so the opening is
        // readable and the pressure comes from the clock, not the volume.
        if (incoming < cap && Math.random() < (0.06 + t * 0.006) * rate * dt) {
          shots.push({ x: a.x, y: a.y + a.size / 2, vy: 260 * scale, from: 'alien' });
        }
        if (a.y > api.h - 60 * scale) {
          // Reaching the floor takes a life rather than the whole run; the formation
          // always outlasts the player otherwise.
          a.hp = 0;
          a.y = -999;
          if (invuln <= 0) {
            lives--;
            invuln = 2.2;
            api.audio.noise(0.5, 0.3, 400);
            if (lives <= 0) {
              api.lose('They landed. That counts as losing.');
              return;
            }
            api.say('One got through. That costs.');
          }
        }
      }

      // shots
      for (let i = shots.length - 1; i >= 0; i--) {
        const s = shots[i];
        s.y += s.vy * dt;
        if (s.y < -20 || s.y > api.h + 20) {
          shots.splice(i, 1);
          continue;
        }
        if (hitBunker(s.x, s.y)) {
          shots.splice(i, 1);
          api.audio.noise(0.06, 0.12, 1800);
          continue;
        }
        if (s.from === 'player') {
          for (let j = aliens.length - 1; j >= 0; j--) {
            const a = aliens[j];
            if (dist(s.x, s.y, a.x, a.y) < a.size * 0.5) {
              shots.splice(i, 1);
              a.hp--;
              api.audio.blip(a.boss ? 160 : 330, 0.08, 'square', 0.22, 110);
              if (a.hp <= 0) {
                aliens.splice(j, 1);
                kills++;
                api.audio.noise(0.15, 0.2, 2000);
                if (a.boss) {
                  api.win({ stat: `${kills} ALIENS, ONE VERY LARGE ONE`, score: kills });
                  return;
                }
                if (split && a.size > 14 * scale && aliens.length < 18) {
                  for (const dir of [-1, 1]) {
                    aliens.push({
                      x: a.x + dir * a.size * 0.4,
                      y: a.y,
                      vx: dir * 110 * scale,
                      vy: 0,
                      size: a.size * 0.6,
                      hp: 1,
                    });
                  }
                }
              }
              break;
            }
          }
        } else {
          // The hull is narrower than the sprite, and a hit buys a breath of safety:
          // without it one bad second takes every life at once.
          const hull = playerW() * 0.6;
          const pr = { x: px - hull / 2, y: playerY() - 8 * scale, w: hull, h: 20 * scale };
          if (aabb({ x: s.x - 3, y: s.y - 6, w: 6, h: 12 }, pr)) {
            shots.splice(i, 1);
            if (!script.mercy && invuln <= 0) {
              lives--;
              invuln = 2.2;
              api.audio.noise(0.4, 0.3, 600);
              if (lives <= 0) {
                api.lose('Shot down by pixels.');
                return;
              }
            }
          }
        }
      }

      api.hud(
        bossSpawned
          ? `LIVES ${lives}    BOSS ${Math.max(0, aliens[0]?.hp ?? 0)}`
          : `LIVES ${lives}    WAVE ${wave}/3    KILLS ${kills}`,
      );
    },

    draw() {
      const { ctx } = api;
      fill(api);
      const scale = u() * 1.4;
      ctx.fillStyle = api.colors.fg;

      // player
      const pw = playerW();
      ctx.globalAlpha = invuln > 0 && Math.floor(invuln * 12) % 2 ? 0.3 : 1;
      ctx.fillRect(px - pw / 2, playerY(), pw, 10 * scale);
      ctx.fillRect(px - pw / 6, playerY() - 10 * scale, pw / 3, 10 * scale);
      ctx.fillRect(px - 3 * scale, playerY() - 18 * scale, 6 * scale, 8 * scale);
      ctx.globalAlpha = 1;

      // bunkers
      const cs = 9 * scale;
      ctx.fillStyle = api.colors.fg;
      bunkers.forEach((b) => {
        b.cells.forEach((row, cy) =>
          row.forEach((on, cx) => {
            if (on) ctx.fillRect(b.x + cx * cs, b.y + cy * cs, cs - 1, cs - 1);
          }),
        );
      });

      aliens.forEach((a) => {
        const s = a.size;
        ctx.save();
        ctx.translate(a.x, a.y);
        const wig = Math.floor(t * 4) % 2 === 0 ? 1 : -1;
        ctx.fillStyle = a.boss ? api.colors.accent : api.colors.fg;
        ctx.fillRect(-s * 0.5, -s * 0.3, s, s * 0.45);
        ctx.fillRect(-s * 0.3, -s * 0.5, s * 0.6, s * 0.3);
        ctx.fillRect(-s * 0.5, s * 0.15, s * 0.22, s * 0.25 * wig + s * 0.1);
        ctx.fillRect(s * 0.28, s * 0.15, s * 0.22, s * 0.25 * -wig + s * 0.1);
        ctx.fillStyle = api.colors.bg;
        ctx.fillRect(-s * 0.26, -s * 0.22, s * 0.16, s * 0.14);
        ctx.fillRect(s * 0.1, -s * 0.22, s * 0.16, s * 0.14);
        ctx.restore();
      });

      shots.forEach((s) => {
        ctx.fillStyle = s.from === 'player' ? api.colors.fg : api.colors.accent;
        ctx.fillRect(s.x - 2 * scale, s.y - 8 * scale, 4 * scale, 16 * scale);
      });

      text(api, '1978', 18, 24, 16, { align: 'left', kind: 'mono', alpha: 0.5 });
      timerBar(api, t, 48);
    },
  } satisfies MiniGame;
}
