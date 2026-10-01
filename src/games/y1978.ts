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
  let lives = 4;
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
  const aliens: Alien[] = [];
  const shots: Shot[] = [];

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
      hp: 22,
      boss: true,
    });
    api.shout('OH');
    api.audio.blip(70, 1.2, 'sawtooth', 0.3, 40);
  };

  const script = new Script([
    { at: 6, run: () => { dodge = true; api.say('Apparently the aliens learned something.'); } },
    { at: 12, run: () => { rate = 1.7; api.say('And they have been practising.'); } },
    { at: 19, run: () => { split = true; api.shout('THEY SPLIT NOW'); } },
    { at: 26, run: () => { homing = true; api.say('They know where you live.'); } },
    { at: 32, run: () => { shields = true; api.say('Now with shields. Two hits each.'); } },
    { at: 38, run: () => spawnBoss() },
  ]);

  return {
    start() {
      px = api.w / 2;
      spawnWave();
    },

    update(dt) {
      t += dt;
      script.update(t);
      const scale = u() * 1.4;

      px = clamp(px + api.input.axisX * 430 * scale * dt, playerW() / 2, api.w - playerW() / 2);
      if (api.input.pointerDown) {
        px = clamp(api.input.pointerX, playerW() / 2, api.w - playerW() / 2);
      }

      cool -= dt;
      if (api.input.action && cool <= 0) {
        cool = 0.26;
        shots.push({ x: px, y: playerY(), vy: -620 * scale, from: 'player' });
        api.audio.blip(900, 0.06, 'square', 0.18, 420);
      }

      if (!bossSpawned && aliens.length === 0) {
        wave++;
        spawnWave(2 + Math.min(2, wave), 7 + Math.min(2, wave));
        api.say(wave === 2 ? 'They brought friends.' : `Wave ${wave}. Nobody is counting but you.`);
      }

      // aliens
      for (const a of aliens) {
        if (a.boss) {
          a.x += a.vx * dt;
          if (a.x < a.size / 2 || a.x > api.w - a.size / 2) a.vx *= -1;
          a.y = api.h * 0.3 + Math.sin(t * 1.5) * 20 * scale;
          if (Math.random() < 1.9 * dt) {
            shots.push({ x: a.x + rand(-a.size / 3, a.size / 3), y: a.y + a.size / 2, vy: 300 * scale, from: 'alien' });
          }
          continue;
        }
        a.x += a.vx * rate * dt;
        a.y += (10 + (homing ? 26 : 0)) * rate * scale * dt;
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
        // Arcade rule: only so many enemy bullets may exist at once, so the opening
        // is readable and the pressure comes from the clock instead of the volume.
        const incoming = shots.filter((s) => s.from === 'alien').length;
        const cap = 3 + Math.floor(t / 9);
        if (incoming < cap && Math.random() < (0.06 + t * 0.006) * rate * dt) {
          shots.push({ x: a.x, y: a.y + a.size / 2, vy: 260 * scale, from: 'alien' });
        }
        if (a.y > api.h - 60 * scale) {
          lives = 0;
          api.lose('They landed. That counts as losing.');
          return;
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
                if (split && a.size > 14 * scale) {
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
          const pr = { x: px - playerW() / 2, y: playerY() - 10 * scale, w: playerW(), h: 22 * scale };
          if (aabb({ x: s.x - 3, y: s.y - 6, w: 6, h: 12 }, pr)) {
            shots.splice(i, 1);
            lives--;
            api.audio.noise(0.4, 0.3, 600);
            if (lives <= 0) {
              api.lose('Shot down by pixels.');
              return;
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
      ctx.fillRect(px - pw / 2, playerY(), pw, 10 * scale);
      ctx.fillRect(px - pw / 6, playerY() - 10 * scale, pw / 3, 10 * scale);
      ctx.fillRect(px - 3 * scale, playerY() - 18 * scale, 6 * scale, 8 * scale);

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
