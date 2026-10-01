import { useEffect, useRef, useState } from 'react';
import type { ReactGameProps } from '../core/types';

interface Step {
  label: string;
  detail: (p: number) => string;
  ms: number;
}

const STEPS: Step[] = [
  { label: 'COMPILING SHADERS', detail: (p) => `${Math.round(p * 12000).toLocaleString()} / 12,000`, ms: 3400 },
  { label: 'DOWNLOADING DAY ONE PATCH', detail: (p) => `${(p * 91.4).toFixed(1)} GB / 91.4 GB`, ms: 2600 },
  { label: 'CONNECTING TO ACCOUNT', detail: () => 'verifying that you are you', ms: 1800 },
  { label: 'INSTALLING UPDATE', detail: (p) => `${Math.round(p * 100)}%`, ms: 1600 },
  { label: 'CHECKING FOR UPDATES', detail: () => 'there is another one', ms: 1500 },
  { label: 'INSTALLING THAT UPDATE', detail: (p) => `${(p * 12.3).toFixed(1)} GB / 12.3 GB`, ms: 2000 },
  { label: 'SYNCHRONISING COSMETICS YOU DO NOT OWN', detail: () => 'almost there', ms: 1700 },
];

const PRESSES = [
  { shout: 'SPECTACULAR', line: '12,000 people worked on this game.' },
  { shout: 'INCREDIBLE', line: 'Four studios. Three countries. Six years.' },
  { shout: 'UNFORGETTABLE', line: "You're pressing one button." },
];

/** 2026 — twelve thousand people worked on this. You press one button. */
export function Game2026({ onWin, say, shout, audio }: ReactGameProps) {
  const [i, setI] = useState(0);
  const [p, setP] = useState(0);
  const [eula, setEula] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [phase, setPhase] = useState<'load' | 'eula' | 'ready' | 'cinematic'>('load');
  const [presses, setPresses] = useState(0);
  const [pressed, setPressed] = useState(false);
  const raf = useRef(0);

  useEffect(() => {
    if (phase !== 'load') return;
    const step = STEPS[i];
    if (!step) {
      setPhase('eula');
      return;
    }
    const started = performance.now();
    const tick = (now: number) => {
      const prog = Math.min(1, (now - started) / step.ms);
      setP(prog);
      if (prog < 1) raf.current = requestAnimationFrame(tick);
      else {
        audio.blip(500 + i * 90, 0.09, 'sine', 0.16);
        setI((v) => v + 1);
        setP(0);
      }
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [i, phase, audio]);

  useEffect(() => {
    if (phase !== 'ready') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') press();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const press = () => {
    if (pressed) return;
    const n = presses;
    const step = PRESSES[Math.min(n, PRESSES.length - 1)];
    audio.blip(180 + n * 40, 1.2, 'sine', 0.3, 60);
    shout(step.shout, 1800);
    window.setTimeout(() => say(step.line), 1600);
    if (n + 1 >= PRESSES.length) {
      setPressed(true);
      setPhase('cinematic');
      window.setTimeout(() => onWin({ stat: 'THREE BUTTONS, PRESSED PERFECTLY' }), 5200);
    } else {
      setPresses(n + 1);
      window.setTimeout(() => say('Press it again. That was a cutscene.'), 3400);
    }
  };

  if (phase === 'load') {
    const step = STEPS[i] ?? STEPS[STEPS.length - 1];
    return (
      <div className="era2026 loading">
        <div className="modern-logo">UNTITLED FRANCHISE ENTRY</div>
        <h2>{step.label}</h2>
        <div className="modern-bar">
          <span style={{ width: `${p * 100}%` }} />
        </div>
        <div className="detail">{step.detail(p)}</div>
        <ul className="checklist">
          {STEPS.map((s, idx) => (
            <li key={s.label} className={idx < i ? 'done' : idx === i ? 'active' : ''}>
              {idx < i ? '✓' : idx === i ? '▸' : '·'} {s.label}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (phase === 'eula') {
    return (
      <div className="era2026 eula">
        <h2>TERMS OF SERVICE</h2>
        <div className="eula-box">
          <p>
            By continuing you agree to a document nobody has ever finished reading. It is 94 pages
            long. Page 61 is just a map of our offices.
          </p>
          <p>
            You agree that your reflexes, preferences and small sighs may be used to improve the
            experience for a different player.
          </p>
          <p>You agree to be told later that this agreement has changed.</p>
        </div>
        <label className="check">
          <input type="checkbox" checked={eula} onChange={(e) => setEula(e.target.checked)} />
          <span>I have read and understood none of this</span>
        </label>
        <button
          className="btn"
          disabled={!eula}
          onClick={() => {
            setAccepted(true);
            audio.blip(760, 0.1, 'sine', 0.2, 1100);
            window.setTimeout(() => {
              setPhase('ready');
              say('Okay, you can actually play now.');
            }, 900);
          }}
        >
          {accepted ? 'FINALISING…' : 'ACCEPT'}
        </button>
      </div>
    );
  }

  if (phase === 'ready') {
    return (
      <div className="era2026 ready">
        <div className="qte-ring" />
        <h2>PRESS SPACE</h2>
        <button className="btn big" onClick={press}>
          PRESS
        </button>
        <p className="sub">
          {presses === 0 ? 'this is the gameplay' : `prompt ${presses + 1} of ${PRESSES.length}`}
        </p>
      </div>
    );
  }

  return (
    <div className="era2026 cinematic">
      <div className="bars" />
      <div className="credit-wall">
        {['NARRATIVE', 'LIGHTING', 'PHYSICS', 'LOCALISATION', 'MOTION CAPTURE', 'LIVE OPS'].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <h2>IT LOOKS INCREDIBLE</h2>
    </div>
  );
}
