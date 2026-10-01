import type { Bot } from './harness';

/** Pong: follow whichever ball is closest to the player's paddle. */
export const pongBot: Bot = (input, _t, api, seen) => {
  const balls = seen.arcs().filter((a) => a[2] < api.h * 0.05);
  if (!balls.length) return;
  const target = balls.reduce((a, b) => (b[1] > a[1] ? b : a));
  input.pointerDown = true;
  input.pointerX = target[0];
  input.pointerY = target[1];
};

/** Space shooter: sit under the lowest alien, fire constantly, flee near bullets. */
export const shooterBot: Bot = (input, _t, api, seen) => {
  const rects = seen.rects();
  // Enemy shots are tall thin rectangles; aliens are wide blocks up the screen.
  const shots = rects.filter((r) => r[2] < api.w * 0.02 && r[3] > r[2] && r[1] > api.h * 0.4);
  const aliens = rects.filter((r) => r[2] > api.w * 0.03 && r[1] < api.h * 0.6);
  let want = api.w / 2;
  if (aliens.length) {
    const low = aliens.reduce((a, b) => (b[1] > a[1] ? b : a));
    want = low[0] + low[2] / 2;
  }
  // Dodge anything that is going to arrive on this column, not just what is close.
  const danger = shots
    .filter((s) => Math.abs(s[0] - input.pointerX) < api.w * 0.14)
    .sort((a, b) => b[1] - a[1])[0];
  if (danger) {
    const away = danger[0] < api.w / 2 ? 1 : -1;
    want = input.pointerX + away * api.w * 0.3;
  }
  input.pointerDown = true;
  input.pointerX = Math.max(20, Math.min(api.w - 20, want));
  input.pointerY = api.h - 30;
};

/**
 * Flappy: the world is drawn inside a scaled transform, so positions come from
 * the recorded translate (the bird) and the raw pipe rects (world space).
 */
export const flapBot: Bot = (input, _t, _api, seen) => {
  const birdOp = [...seen.ops].reverse().find((o) => o.op === 'translate' && o.args[0] === 110);
  if (!birdOp) return;
  const birdY = birdOp.args[1];
  // Top pipes start at y = 0; the gap begins where they end.
  const tops = seen
    .rects()
    .filter((r) => r[1] === 0 && r[2] === 60 && r[0] + 60 > 92)
    .sort((a, b) => a[0] - b[0]);
  const aim = tops.length ? tops[0][1] + tops[0][3] + 80 : 320;
  if (birdY > aim) input.tap();
};

/** Battle royale: walk back to the middle of the shrinking circle. */
export const royaleBot: Bot = (input, _t, api, seen) => {
  // Dead reckoning: the bot mirrors the game's own movement maths.
  const st = (royaleBot as unknown as { x?: number; y?: number });
  if (st.x === undefined) {
    st.x = api.w / 2;
    st.y = api.h / 2 + Math.min(api.w, api.h) * 0.46 * 0.3;
  }
  // Keep to the middle, but break off if the rival closes in.
  let aimX = api.w / 2;
  let aimY = api.h / 2;
  const rival = seen.rects().find((r) => r[2] === 18 && r[3] === 28 && Math.abs(r[0] + 9 - st.x!) > 20);
  if (rival) {
    const rx = rival[0] + 9;
    const ry = rival[1] + 14;
    const away = Math.hypot(rx - st.x!, ry - st.y!);
    if (away < api.w * 0.5) {
      // Run away, but never out of the circle — the storm is the real killer.
      const ux = (st.x! - rx) / (away || 1);
      const uy = (st.y! - ry) / (away || 1);
      const safeR = Math.min(api.w, api.h) * 0.46 * Math.max(0.28, 1 - _t * 0.024) * 0.6;
      const tx = st.x! + ux * 200 - api.w / 2;
      const ty = st.y! + uy * 200 - api.h / 2;
      const d2 = Math.hypot(tx, ty) || 1;
      const k = Math.min(1, safeR / d2);
      aimX = api.w / 2 + tx * k;
      aimY = api.h / 2 + ty * k;
    }
  }
  const dx = aimX - st.x;
  const dy = aimY - st.y;
  input.keys.clear();
  if (dx > 6) input.keys.add('ArrowRight');
  if (dx < -6) input.keys.add('ArrowLeft');
  if (dy > 6) input.keys.add('ArrowDown');
  if (dy < -6) input.keys.add('ArrowUp');
  st.x += Math.sign(dx) * Math.min(Math.abs(dx), 270 / 60);
  st.y += Math.sign(dy) * Math.min(Math.abs(dy), 270 / 60);
};
(royaleBot as unknown as { reset: () => void }).reset = () => {
  const st = royaleBot as unknown as { x?: number; y?: number };
  st.x = undefined;
  st.y = undefined;
};

/**
 * Turn-based: attack, and every so often step across to ITEM for a heal.
 * The cursor wraps 0..3, so the walk is written out explicitly rather than
 * guessed — a desynced cursor reads as a frozen game.
 */
export const rpgBot: Bot = (input, t) => {
  const st = rpgBot as unknown as { phase?: number; next?: number };
  st.phase ??= 0;
  st.next ??= 10;
  const tap = (code: string) => {
    input.press(code);
    input.release(code);
  };
  if (t > st.next && st.phase === 0) {
    st.phase = 1;
    tap('ArrowRight'); // FIGHT -> MAGIC
    return;
  }
  if (st.phase === 1) {
    st.phase = 2;
    tap('ArrowRight'); // MAGIC -> ITEM
    return;
  }
  if (st.phase === 2) {
    st.phase = 3;
    tap('Space'); // drink
    return;
  }
  if (st.phase === 3) {
    st.phase = 4;
    tap('ArrowLeft');
    return;
  }
  if (st.phase === 4) {
    st.phase = 0;
    st.next = t + 12;
    tap('ArrowLeft');
    return;
  }
  tap('Space');
};
(rpgBot as unknown as { reset: () => void }).reset = () => {
  const st = rpgBot as unknown as { phase?: number; next?: number };
  st.phase = 0;
  st.next = 10;
};

/** Life sim: keep topping up each need in rotation. */
export const simsBot: Bot = (input, t, api) => {
  const spots = [
    [0.18, 0.46],
    [0.82, 0.46],
    [0.21, 0.78],
    [0.77, 0.78],
  ];
  const pick = spots[Math.floor(t / 2.5) % spots.length];
  if (Math.floor(t * 60) % 30 === 0) {
    input.pointerX = pick[0] * api.w;
    input.pointerY = pick[1] * api.h;
    input.pointerEdge = true;
  }
};

/** Loop runner: jump when a spike is close enough ahead. */
export const sonicBot: Bot = (input, _t, _api, seen) => {
  const moves = seen.ops.filter((o) => o.op === 'translate' && o.args.length === 2);
  const runner = moves[moves.length - 1];
  if (!runner) return;
  const runnerX = runner.args[0];
  // Spikes are triangles: the first point is at (x - 16, ground).
  const spikes = seen.ops
    .filter((o) => o.op === 'moveTo' && o.args.length === 2)
    .map((o) => o.args[0] + 16)
    .filter((x) => x > runnerX)
    .sort((a, b) => a - b);
  if (spikes.length && spikes[0] - runnerX < 150) input.tap();
};
