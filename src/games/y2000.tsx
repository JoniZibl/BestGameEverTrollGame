import { useEffect, useRef, useState } from 'react';
import type { ReactGameProps } from '../core/types';

const LOADING_STEPS = [3, 7, 8, 8, 8, 8, 9, 11, 11, 11, 94, 100];

interface Target {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/** 2000 — the game is fine. The connection is the content. */
export function Game2000({ onWin, onLose, say, shout, audio, grant }: ReactGameProps) {
  const [phase, setPhase] = useState<'dial' | 'play'>('dial');
  const [pct, setPct] = useState(0);
  const [step, setStep] = useState(0);
  const [hits, setHits] = useState(0);
  const [left, setLeft] = useState(18);
  const [targets, setTargets] = useState<Target[]>([]);
  const [shots, setShots] = useState<{ id: number; x: number; y: number }[]>([]);
  const areaRef = useRef<HTMLDivElement>(null);
  const stuckSince = useRef(0);
  const nextId = useRef(1);

  useEffect(() => {
    if (phase !== 'dial') return;
    audio.blip(1200, 0.4, 'square', 0.12, 400);
    audio.noise(0.9, 0.1, 3000);
    const iv = window.setInterval(() => {
      setStep((s) => {
        const next = Math.min(s + 1, LOADING_STEPS.length - 1);
        setPct(LOADING_STEPS[next]);
        if (LOADING_STEPS[next] === 8 && !stuckSince.current) stuckSince.current = Date.now();
        audio.blip(300 + Math.random() * 900, 0.08, 'square', 0.08);
        if (next >= LOADING_STEPS.length - 1) {
          window.setTimeout(() => {
            setPhase('play');
            shout('WELCOME TO\nONLINE GAMING');
            say('Your ping is 420. Everything you do arrives late.');
            audio.jingle([60, 64, 67], 0.08, 'sawtooth');
          }, 700);
        }
        return next;
      });
    }, 900);
    return () => window.clearInterval(iv);
  }, [phase, audio, say, shout]);

  // The patient ones get an achievement for watching a bar that was never moving.
  useEffect(() => {
    if (phase !== 'dial') return;
    const to = window.setTimeout(() => grant?.('patient'), 9000);
    return () => window.clearTimeout(to);
  }, [phase, grant]);

  useEffect(() => {
    if (phase !== 'play') return;
    const area = areaRef.current;
    if (!area) return;
    const r = area.getBoundingClientRect();
    setTargets(
      Array.from({ length: 3 }, () => ({
        id: nextId.current++,
        x: Math.random() * (r.width - 60) + 30,
        y: Math.random() * (r.height - 60) + 30,
        vx: (Math.random() - 0.5) * 220,
        vy: (Math.random() - 0.5) * 220,
      })),
    );
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const rect = area.getBoundingClientRect();
      setTargets((ts) =>
        ts.map((t) => {
          let { x, y, vx, vy } = t;
          x += vx * dt;
          y += vy * dt;
          if (x < 24 || x > rect.width - 24) vx *= -1;
          if (y < 24 || y > rect.height - 24) vy *= -1;
          return { ...t, x: Math.max(24, Math.min(rect.width - 24, x)), y: Math.max(24, Math.min(rect.height - 24, y)), vx, vy };
        }),
      );
      return undefined;
    };
    raf = requestAnimationFrame(tick);
    const timer = window.setInterval(() => setLeft((l) => l - 1), 1000);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(timer);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== 'play' || left > 0) return;
    if (hits >= 4) onWin({ stat: `${hits} HITS THROUGH 420ms OF LAG`, score: hits });
    else onLose('The lag won. It usually did.');
  }, [left, phase, hits, onWin, onLose]);

  const shoot = (e: React.MouseEvent) => {
    const area = areaRef.current;
    if (!area) return;
    const r = area.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const id = nextId.current++;
    setShots((s) => [...s, { id, x, y }]);
    audio.blip(700, 0.05, 'square', 0.14, 300);
    // 420ms later the server finally hears about it
    window.setTimeout(() => {
      setShots((s) => s.filter((p) => p.id !== id));
      setTargets((ts) => {
        const hit = ts.find((t) => Math.hypot(t.x - x, t.y - y) < 34);
        if (!hit) {
          audio.blip(160, 0.1, 'square', 0.12);
          return ts;
        }
        audio.blip(880, 0.12, 'square', 0.2, 1400);
        setHits((h) => {
          const n = h + 1;
          if (n === 2) say('Aim where it is going to be. Welcome to 2000.');
          if (n >= 6) onWin({ stat: `${n} HITS THROUGH 420ms OF LAG`, score: n });
          return n;
        });
        return ts.map((t) =>
          t.id === hit.id
            ? {
                ...t,
                x: Math.random() * (r.width - 60) + 30,
                y: Math.random() * (r.height - 60) + 30,
              }
            : t,
        );
      });
    }, 420);
  };

  if (phase === 'dial') {
    return (
      <div className="era2000 dialup">
        <h2>CONNECTING…</h2>
        <div className="modem">
          {Array.from({ length: 28 }, (_, i) => (
            <span key={i} style={{ height: `${12 + Math.abs(Math.sin(i + step * 1.7)) * 46}px` }} />
          ))}
        </div>
        <div className="pct">{pct}%</div>
        <div className="loglines">
          {LOADING_STEPS.slice(0, step + 1)
            .slice(-6)
            .map((p, i) => (
              <div key={i}>{p}%</div>
            ))}
        </div>
        <p className="hint">Do not pick up the telephone.</p>
      </div>
    );
  }

  return (
    <div className="era2000 arena" ref={areaRef} onMouseDown={shoot}>
      <div className="net-hud">
        <span>PING 420ms</span>
        <span>HITS {hits}/6</span>
        <span>{Math.max(0, left)}s</span>
      </div>
      {targets.map((t) => (
        <div key={t.id} className="target" style={{ left: t.x, top: t.y }} />
      ))}
      {shots.map((s) => (
        <div key={s.id} className="shot" style={{ left: s.x, top: s.y }} />
      ))}
      <div className="lagnote">your shots arrive 420ms late</div>
    </div>
  );
}
