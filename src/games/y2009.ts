import type { GameApi, MiniGame } from '../core/types';
import { Script, circle, fill, text } from './helpers';

const W = 620;
const H = 430;
const GROUND = 330;

interface Block {
  x: number;
  y: number;
  sy: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  target?: boolean;
  dead?: boolean;
}

/** 2009 — a phone, a slingshot, and a tower that had it coming. */
export function create2009(api: GameApi): MiniGame {
  let t = 0;
  let shots = 0;
  let hit = 0;
  let paused = false;
  const SHOT_LIMIT = api.diff.lives(12);
  let energyGag = false;
  let adGag = false;
  const blocks: Block[] = [];
  const sling = { x: 86, y: GROUND - 56 };
  const ball = { x: sling.x, y: sling.y, vx: 0, vy: 0, flying: false, rest: 0 };
  let aim: { x: number; y: number } | null = null;

  const tower = () => {
    blocks.length = 0;
    const baseX = 380;
    const add = (x: number, y: number, w: number, h: number, target = false) =>
      blocks.push({ x, y, sy: y, w, h, vx: 0, vy: 0, rot: 0, vr: 0, target });
    // two columns, a lid, another storey, and three round things that regret everything
    add(baseX, GROUND - 110, 22, 110);
    add(baseX + 124, GROUND - 110, 22, 110);
    add(baseX - 8, GROUND - 132, 162, 22);
    add(baseX + 24, GROUND - 222, 22, 90);
    add(baseX + 100, GROUND - 222, 22, 90);
    add(baseX + 16, GROUND - 244, 114, 22);
    add(baseX + 48, GROUND - 164, 32, 32, true);
    add(baseX + 18, GROUND - 276, 32, 32, true);
    add(baseX + 96, GROUND - 276, 32, 32, true);
  };

  const script = new Script(
    [
    {
      at: 18,
      when: () => hit >= 1,
      run: () => {
        if (energyGag) return;
        energyGag = true;
        paused = true;
        api.popup({
          title: 'ENERGY EMPTY',
          lines: ['Your lives refill over time.', 'Or you can wait.'],
          buttons: [
            { label: 'WAIT 7 HOURS', value: 'wait', primary: true },
            { label: 'BUY 5 LIVES', value: 'buy' },
          ],
          onPick: () => {
            paused = false;
            api.shout('JUST KIDDING');
            api.say('Keep playing. We would not actually do that to you.');
            api.audio.jingle([72, 76, 79], 0.07, 'sine');
          },
        });
      },
    },
    {
      at: 34,
      when: () => hit >= 2,
      run: () => {
        if (adGag) return;
        adGag = true;
        paused = true;
        api.popup({
          title: 'AD',
          lines: ['A different game would like your attention.', 'It is the same game.'],
          buttons: [
            { label: 'CLOSE ✕', value: 'x', primary: true },
            { label: 'INSTALL', value: 'i' },
          ],
          onPick: () => {
            paused = false;
            api.say('That was four seconds of your life. Monetised.');
          },
        });
      },
    },
    ],
    { say: api.say, grace: api.diff.grace },
  );

  const scale = () => Math.min(api.w / W, api.h / H, 1.4);
  const toWorld = (sx: number, sy: number) => {
    const s = scale();
    const offY = Math.min(api.h * 0.66 - GROUND * s, api.h - H * s);
    return { x: (sx - (api.w - W * s) / 2) / s, y: (sy - offY) / s };
  };

  return {
    start() {
      tower();
    },

    update(dt) {
      if (paused) return;
      t += dt;
      script.update(t);

      if (!ball.flying) {
        if (api.input.pointerDown) {
          aim = toWorld(api.input.pointerX, api.input.pointerY);
        } else if (aim) {
          ball.vx = (sling.x - aim.x) * 3.1;
          ball.vy = (sling.y - aim.y) * 3.1;
          ball.flying = true;
          shots++;
          aim = null;
          api.audio.blip(300, 0.12, 'square', 0.2, 700);
        }
      }

      const kill = (b: Block) => {
        if (!b.target || b.dead) return;
        b.dead = true;
        hit++;
        api.audio.jingle([76, 72], 0.07, 'sine');
      };

      if (ball.flying) {
        ball.vy += 780 * dt;
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;
        for (const b of blocks) {
          if (b.dead) continue;
          if (
            ball.x > b.x - 14 &&
            ball.x < b.x + b.w + 14 &&
            ball.y > b.y - 14 &&
            ball.y < b.y + b.h + 14
          ) {
            b.vx += ball.vx * 0.3;
            b.vy += ball.vy * 0.18 - 40;
            b.vr += (Math.random() - 0.5) * 7;
            ball.vx *= 0.45;
            ball.vy *= 0.45;
            api.audio.noise(0.12, 0.2, 1400);
            kill(b);
          }
        }
        if (ball.y > GROUND || ball.x > W + 60) {
          ball.flying = false;
          ball.x = sling.x;
          ball.y = sling.y;
          ball.vx = ball.vy = 0;
        }
      }

      // Loose physics with support: blocks rest on the ground and on each other,
      // so the tower stands until something arrives to disagree.
      const live = blocks.filter((b) => !b.dead).sort((a, b) => b.y - a.y);
      for (const b of live) {
        b.vy += 1400 * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.rot += b.vr * dt;
        b.vx *= 0.99;
        b.vr *= 0.97;

        if (b.y + b.h > GROUND) {
          b.y = GROUND - b.h;
          if (b.vy > 0) b.vy = 0;
          b.vx *= 0.82;
          b.vr *= 0.7;
        }
        for (const o of live) {
          if (o === b) continue;
          const overlapX = b.x < o.x + o.w && b.x + b.w > o.x;
          const landing = b.y + b.h > o.y && b.y + b.h < o.y + o.h * 0.9 && b.vy >= 0;
          if (overlapX && landing) {
            b.y = o.y - b.h;
            b.vy = 0;
            b.vx *= 0.9;
          }
        }

        // A target is finished when it is thrown about or falls off the tower.
        if (b.target && (Math.abs(b.vx) > 190 || b.y - b.sy > 90 || Math.abs(b.rot) > 1.1)) kill(b);
      }

      if (hit >= 3) {
        api.win({ stat: `TOWER DOWN IN ${shots} SHOT${shots === 1 ? '' : 'S'}`, score: shots });
        return;
      }

      if (shots >= SHOT_LIMIT && !ball.flying) {
        api.lose(`${SHOT_LIMIT} shots. The tower is fine. Smug, even.`);
        return;
      }

      api.hud(`TARGETS ${3 - hit}    SHOTS ${shots}/${SHOT_LIMIT}`);
    },

    draw() {
      const { ctx } = api;
      fill(api);
      const s = scale();
      ctx.save();
      // Anchor the scene low in the frame: on a phone the sky is wasted space.
      ctx.translate((api.w - W * s) / 2, Math.min(api.h * 0.66 - GROUND * s, api.h - H * s));
      ctx.scale(s, s);

      // ground
      ctx.fillStyle = api.colors.fg;
      ctx.globalAlpha = 0.18;
      ctx.fillRect(0, GROUND, W, H - GROUND);
      ctx.globalAlpha = 1;
      ctx.fillRect(0, GROUND - 2, W, 4);

      // slingshot
      ctx.fillRect(sling.x - 7, sling.y, 14, 58);
      ctx.fillRect(sling.x - 26, sling.y - 32, 10, 42);
      ctx.fillRect(sling.x + 16, sling.y - 32, 10, 42);

      blocks.forEach((b) => {
        if (b.dead) return;
        ctx.save();
        ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
        ctx.rotate(b.rot);
        if (b.target) {
          ctx.fillStyle = api.colors.accent;
          circle(ctx, 0, 0, b.w / 2);
          ctx.fill();
          ctx.fillStyle = api.colors.bg;
          circle(ctx, -b.w * 0.16, -b.h * 0.1, b.w * 0.1);
          ctx.fill();
          circle(ctx, b.w * 0.16, -b.h * 0.1, b.w * 0.1);
          ctx.fill();
          ctx.fillRect(-b.w * 0.12, b.h * 0.14, b.w * 0.24, b.h * 0.08);
        } else {
          ctx.fillStyle = api.colors.fg;
          ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
          ctx.fillStyle = api.colors.bg;
          ctx.globalAlpha = 0.25;
          ctx.fillRect(-b.w / 2 + 4, -b.h / 2 + 4, b.w - 8, 4);
        }
        ctx.restore();
      });

      // aim
      if (aim) {
        ctx.strokeStyle = api.colors.fg;
        ctx.setLineDash([8, 10]);
        ctx.lineWidth = 4;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(sling.x, sling.y);
        ctx.lineTo(aim.x, aim.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }

      const bx = aim && !ball.flying ? aim.x : ball.x;
      const by = aim && !ball.flying ? aim.y : ball.y;
      ctx.fillStyle = api.colors.accent;
      circle(ctx, bx, by, 18);
      ctx.fill();
      ctx.fillStyle = api.colors.bg;
      circle(ctx, bx + 5, by - 4, 4);
      ctx.fill();
      ctx.restore();

      if (t < 6 && shots === 0) {
        text(api, 'PULL BACK AND RELEASE', api.w / 2, api.h * 0.9, Math.min(16, api.w / 24), {
          alpha: 0.55,
          kind: 'ui',
        });
      }
    },
  } satisfies MiniGame;
}
