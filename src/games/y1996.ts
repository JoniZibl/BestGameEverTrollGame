import type { GameApi, MiniGame } from '../core/types';
import { Script, clamp, fill, text } from './helpers';

interface V3 {
  x: number;
  y: number;
  z: number;
}

interface Shape {
  pos: V3;
  verts: V3[];
  faces: number[][];
  scale: number;
  spin: number;
  crystal?: boolean;
  taken?: boolean;
}

const CUBE: { verts: V3[]; faces: number[][] } = {
  verts: [
    { x: -1, y: 0, z: -1 },
    { x: 1, y: 0, z: -1 },
    { x: 1, y: 0, z: 1 },
    { x: -1, y: 0, z: 1 },
    { x: -1, y: 2, z: -1 },
    { x: 1, y: 2, z: -1 },
    { x: 1, y: 2, z: 1 },
    { x: -1, y: 2, z: 1 },
  ],
  faces: [
    [0, 1, 5, 4],
    [1, 2, 6, 5],
    [2, 3, 7, 6],
    [3, 0, 4, 7],
    [4, 5, 6, 7],
  ],
};

const OCTA: { verts: V3[]; faces: number[][] } = {
  verts: [
    { x: 0, y: 1.6, z: 0 },
    { x: 0.7, y: 0.8, z: 0 },
    { x: 0, y: 0.8, z: 0.7 },
    { x: -0.7, y: 0.8, z: 0 },
    { x: 0, y: 0.8, z: -0.7 },
    { x: 0, y: 0, z: 0 },
  ],
  faces: [
    [0, 1, 2],
    [0, 2, 3],
    [0, 3, 4],
    [0, 4, 1],
    [5, 2, 1],
    [5, 3, 2],
    [5, 4, 3],
    [5, 1, 4],
  ],
};

/** 1996 — polygons, fog, and a draw distance you could reach out and touch. */
export function create1996(api: GameApi): MiniGame {
  let t = 0;
  let taken = 0;
  let quantize = 4;
  let far = 20;
  const NEEDED = 5;
  let dragX: number | null = null;
  let polyLabel = 412;
  let remastered = false;
  const cam = { x: 0, y: 1.6, z: -6, yaw: 0, bob: 0 };
  const shapes: Shape[] = [];

  const build = () => {
    let seed = 1996;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let i = 0; i < 26; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 6 + rnd() * 24;
      shapes.push({
        pos: { x: Math.cos(a) * r, y: 0, z: Math.sin(a) * r },
        verts: CUBE.verts,
        faces: CUBE.faces,
        scale: 0.6 + rnd() * 1.6,
        spin: 0,
      });
    }
    const spots: V3[] = [
      { x: 8, y: 0, z: 9 },
      { x: -11, y: 0, z: 4 },
      { x: 2, y: 0, z: 18 },
      { x: -6, y: 0, z: -14 },
      { x: 17, y: 0, z: -5 },
    ];
    spots.forEach((p) =>
      shapes.push({ pos: p, verts: OCTA.verts, faces: OCTA.faces, scale: 1.1, spin: 1.4, crystal: true }),
    );
  };

  const script = new Script([
    { at: 2, run: () => api.say('LOOK AT THESE GRAPHICS.') },
    { at: 9, run: () => api.say('That fog is not atmosphere. It is hiding the parts we did not draw.') },
    { at: 30, run: () => api.say('Still looking? The draw distance is not helping, is it.') },
    {
      at: 17,
      run: () => {
        remastered = true;
        quantize = 1;
        far = 60;
        polyLabel = 12000;
        api.shout('12,000 POLYGONS');
        api.say('The future is here.');
        api.audio.jingle([60, 67, 72, 76], 0.08, 'sawtooth');
      },
    },
  ]);

  return {
    start() {
      build();
      api.say('MOVE: ↑   TURN: ← →');
    },

    update(dt) {
      t += dt;
      script.update(t);
      cam.yaw += api.input.axisX * 1.9 * dt;
      // Drag to look, for anyone without arrow keys to hand.
      if (api.input.pointerDown) {
        if (dragX !== null) cam.yaw += (api.input.pointerX - dragX) * 0.006;
        dragX = api.input.pointerX;
      } else {
        dragX = null;
      }
      const fwd = (api.input.up ? 1 : 0) - (api.input.downKey ? 1 : 0);
      cam.x += Math.sin(cam.yaw) * fwd * 6.5 * dt;
      cam.z += Math.cos(cam.yaw) * fwd * 6.5 * dt;
      cam.bob += Math.abs(fwd) * dt * 7;
      cam.y = 1.6 + Math.sin(cam.bob) * 0.07;

      for (const s of shapes) {
        if (!s.crystal || s.taken) continue;
        s.spin += dt;
        const d = Math.hypot(s.pos.x - cam.x, s.pos.z - cam.z);
        if (d < 2.2) {
          s.taken = true;
          taken++;
          api.audio.jingle([76, 83], 0.07, 'triangle');
          if (taken >= NEEDED) {
            api.win({ stat: remastered ? 'ALL THREE, REMASTERED' : 'ALL THREE, FOGGED' });
            return;
          }
          api.say(`${NEEDED - taken} left. Somewhere in the fog.`);
        }
      }

      if (t > 75) {
        api.lose('Lost in the fog. It was doing its job.');
        return;
      }
      api.hud(
        `POLYGONS ${polyLabel.toLocaleString()}    CRYSTALS ${taken}/${NEEDED}    ${Math.max(0, 75 - t).toFixed(0)}s`,
      );
    },

    draw() {
      const { ctx } = api;
      fill(api);
      const W = api.w;
      const H = api.h;
      const focal = Math.min(W, H) * 0.9;
      // Camera basis must match the movement basis below: forward = (sin yaw, cos yaw).
      const cos = Math.cos(cam.yaw);
      const sin = Math.sin(cam.yaw);

      const project = (p: V3) => {
        const dx = p.x - cam.x;
        const dz = p.z - cam.z;
        const rx = dx * cos - dz * sin;
        const rz = dx * sin + dz * cos;
        if (rz < 0.3) return null;
        let sx = W / 2 + (rx / rz) * focal;
        let sy = H / 2 - ((p.y - cam.y) / rz) * focal;
        if (quantize > 1) {
          sx = Math.round(sx / quantize) * quantize;
          sy = Math.round(sy / quantize) * quantize;
        }
        return { x: sx, y: sy, z: rz };
      };

      // ground grid
      ctx.strokeStyle = api.colors.fg;
      ctx.lineWidth = 1;
      for (let i = -14; i <= 14; i++) {
        const seg = [
          { x: Math.round(cam.x) + i * 3, y: 0, z: Math.round(cam.z) - 45 },
          { x: Math.round(cam.x) + i * 3, y: 0, z: Math.round(cam.z) + 45 },
        ];
        const steps = 30;
        ctx.beginPath();
        let started = false;
        for (let k = 0; k <= steps; k++) {
          const p = project({
            x: seg[0].x,
            y: 0,
            z: seg[0].z + ((seg[1].z - seg[0].z) * k) / steps,
          });
          if (!p) {
            started = false;
            continue;
          }
          const fog = clamp(1 - p.z / far, 0, 1) * 0.45;
          ctx.globalAlpha = fog;
          if (!started) {
            ctx.moveTo(p.x, p.y);
            started = true;
          } else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // painter's algorithm, exactly as nature intended
      const polys: { pts: { x: number; y: number }[]; z: number; crystal: boolean }[] = [];
      for (const s of shapes) {
        if (s.taken) continue;
        for (const f of s.faces) {
          const pts: { x: number; y: number }[] = [];
          let zsum = 0;
          let ok = true;
          for (const idx of f) {
            const v = s.verts[idx];
            const spin = s.spin;
            const vx = v.x * Math.cos(spin) - v.z * Math.sin(spin);
            const vz = v.x * Math.sin(spin) + v.z * Math.cos(spin);
            const p = project({
              x: s.pos.x + vx * s.scale,
              y: v.y * s.scale,
              z: s.pos.z + vz * s.scale,
            });
            if (!p) {
              ok = false;
              break;
            }
            pts.push(p);
            zsum += p.z;
          }
          if (!ok) continue;
          const z = zsum / f.length;
          if (z > far) continue;
          polys.push({ pts, z, crystal: !!s.crystal });
        }
      }
      polys.sort((a, b) => b.z - a.z);
      for (const p of polys) {
        const fog = clamp(1 - p.z / far, 0, 1);
        ctx.globalAlpha = fog * 0.9;
        ctx.fillStyle = p.crystal ? api.colors.accent : api.colors.fg;
        ctx.beginPath();
        ctx.moveTo(p.pts[0].x, p.pts[0].y);
        for (let i = 1; i < p.pts.length; i++) ctx.lineTo(p.pts[i].x, p.pts[i].y);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = fog;
        ctx.strokeStyle = api.colors.bg;
        ctx.lineWidth = remastered ? 0.5 : 1.5;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      text(api, `${polyLabel.toLocaleString()} POLYGONS`, 18, 24, 14, {
        align: 'left',
        kind: 'mono',
        alpha: 0.6,
      });
      if (!remastered) {
        text(api, 'DRAW DISTANCE: MODEST', api.w - 18, 24, 14, {
          align: 'right',
          kind: 'mono',
          alpha: 0.6,
        });
      }
    },
  } satisfies MiniGame;
}
