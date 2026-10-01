import { useEffect, useRef, useState } from 'react';
import { useGame } from '../core/state';
import { audio } from '../core/audio';

const LINES = [
  'VIDEO GAMES DIDN’T\nALWAYS LOOK LIKE THIS.',
  'ACTUALLY…',
  'THEY USED TO LOOK\nPRETTY TERRIBLE.',
  'LET’S GO BACK.',
];

const YEARS = [2026, 2020, 2017, 2013, 2009, 2004, 2000, 1996, 1993, 1992, 1985, 1984, 1980, 1978, 1972, 1962];

export function IntroScreen() {
  const { go, progress } = useGame();
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<'lines' | 'rewind' | 'stop'>('lines');
  const [year, setYear] = useState(0);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const push = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));
    if (phase === 'lines') {
      const t = i === 1 ? 950 : 1700;
      push(() => {
        if (i < LINES.length - 1) setI(i + 1);
        else setPhase('rewind');
      }, t);
      audio.blip(300 + i * 60, 0.1, 'sine', 0.18);
    }
    if (phase === 'rewind') {
      YEARS.forEach((y, idx) => {
        push(() => {
          setYear(y);
          audio.blip(900 - idx * 42, 0.05, 'square', 0.16);
        }, idx * 85);
      });
      push(() => {
        setPhase('stop');
        audio.blip(120, 0.8, 'sine', 0.3, 60);
      }, YEARS.length * 85 + 200);
    }
    if (phase === 'stop') {
      push(() => go("machine"), 1300);
    }
    return () => {
      timers.current.forEach(window.clearTimeout);
      timers.current = [];
    };
  }, [i, phase, go]);

  const skip = () => {
    timers.current.forEach(window.clearTimeout);
    go('machine');
  };

  return (
    <div className="screen intro-screen" onClick={skip}>
      {phase === 'lines' && <h1 className="giant intro-line">{LINES[i]}</h1>}
      {phase === 'rewind' && (
        <div className="rewind">
          <div className="rewind-year">{year}</div>
          <div className="rewind-note">rewinding</div>
        </div>
      )}
      {phase === 'stop' && (
        <div className="rewind">
          <div className="rewind-year stop">STOP.</div>
        </div>
      )}
      {!progress.seenIntro ? <p className="skip-hint">click to skip</p> : null}
    </div>
  );
}
