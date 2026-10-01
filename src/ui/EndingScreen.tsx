import { useEffect, useRef } from 'react';
import { useGame } from '../core/state';
import { ACHIEVEMENTS } from '../core/achievements';
import { ERAS } from '../games/registry';
import { audio } from '../core/audio';

/** 2031: the game plays itself. You are free to watch. */
function AutoPong() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = (c.width = c.clientWidth * dpr);
    const h = (c.height = c.clientHeight * dpr);
    const fg = getComputedStyle(c).color;
    let x = w / 2;
    let y = h / 2;
    let vx = w * 0.45;
    let vy = h * 0.3;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      x += vx * dt;
      y += vy * dt;
      if (y < 8 || y > h - 8) vy *= -1;
      if (x < 28 || x > w - 28) vx *= -1;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = fg;
      ctx.fillRect(12, y - h * 0.12, 8 * dpr, h * 0.24);
      ctx.fillRect(w - 20, y - h * 0.12, 8 * dpr, h * 0.24);
      ctx.fillRect(x - 6, y - 6, 12, 12);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas className="auto-pong" ref={ref} />;
}

export function EndingScreen() {
  const { progress, go, reset, fragmentCount, totalFragments } = useGame();

  useEffect(() => {
    audio.setEra('modern');
    audio.jingle([60, 64, 67, 72, 76, 79], 0.14, 'sine');
  }, []);

  const won = ERAS.filter((e) => progress.eras[e.id]?.won).length;

  return (
    <div className="screen ending-screen">
      <h1 className="giant">
        THE MACHINE
        <br />
        IS FIXED.
      </h1>
      <p className="ending-sub">
        {fragmentCount} of {totalFragments} fragments recovered. {won} of {ERAS.length} years survived
        properly.
      </p>

      <div className="future-box">
        <div className="future-year">2031</div>
        <AutoPong />
        <p>The game plays itself now. It is very good at it.</p>
        <p className="muted">Sixty-nine years of progress, and we are back to two rectangles.</p>
      </div>

      <section className="achievements">
        <h3>ACHIEVEMENTS</h3>
        <ul>
          {ACHIEVEMENTS.map((a) => {
            const got = progress.achievements.includes(a.id);
            return (
              <li key={a.id} className={got ? 'got' : 'missing'}>
                <b>{got || !a.secret ? a.title : '⁇ LOCKED'}</b>
                <span>{got || !a.secret ? a.desc : 'Found by doing something unreasonable.'}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="ending-actions">
        <button className="btn huge" onClick={() => go('machine')}>
          BACK TO THE TIMELINE
        </button>
        <button
          className="btn ghost"
          onClick={() => {
            if (confirm('Wipe all progress and start from 1962?')) reset();
          }}
        >
          ERASE THE TIMELINE
        </button>
      </div>
    </div>
  );
}
