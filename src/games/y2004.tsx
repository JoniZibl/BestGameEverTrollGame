import { useEffect, useRef, useState } from 'react';
import type { ReactGameProps } from '../core/types';

const CHAT = [
  'LFG dungeon, need healer',
  'anyone selling bank space',
  'WTS legendary mushroom 5g',
  'is the server down again',
  'first',
  'guild recruiting, must be online 7 nights',
  'has anyone seen my horse',
];

/** 2004 — the world is enormous. The quest is not. */
export function Game2004({ onWin, say, shout, audio, grant }: ReactGameProps) {
  const [collected, setCollected] = useState(0);
  const [goal, setGoal] = useState(3);
  const [casting, setCasting] = useState(0);
  const [stage, setStage] = useState<'first' | 'grind' | 'over'>('first');
  const [chat, setChat] = useState<string[]>([]);
  const castRef = useRef<number | null>(null);

  useEffect(() => {
    const iv = window.setInterval(() => {
      setChat((c) => [...c.slice(-5), CHAT[Math.floor(Math.random() * CHAT.length)]]);
    }, 2600);
    return () => window.clearInterval(iv);
  }, []);

  useEffect(() => () => {
    if (castRef.current) window.clearInterval(castRef.current);
  }, []);

  const harvest = () => {
    if (casting > 0 || stage === 'over') return;
    const duration = stage === 'first' ? 900 : 1400;
    const started = Date.now();
    audio.blip(420, 0.3, 'sine', 0.14, 560);
    castRef.current = window.setInterval(() => {
      const p = Math.min(1, (Date.now() - started) / duration);
      setCasting(p);
      if (p >= 1) {
        if (castRef.current) window.clearInterval(castRef.current);
        setCasting(0);
        audio.jingle([72, 79], 0.07, 'sine');
        setCollected((c) => {
          const n = c + 1;
          if (n === 3 && stage === 'first') {
            setStage('grind');
            setGoal(50);
            shout('EXCELLENT.');
            window.setTimeout(() => say('Now collect 47 more.'), 1200);
            audio.jingle([60, 59, 57], 0.14, 'sine');
          }
          if (n === 6) say('Only 44 to go.');
          if (n === 9) say('You are allowed to leave, you know.');
          if (n >= 12) {
            setStage('over');
            window.setTimeout(() => {
              shout('QUEST COMPLETE?');
              say('The village found the other 38 in a cupboard. Thank you for your service.');
              window.setTimeout(() => onWin({ stat: `${n} MUSHROOMS, 1 LESSON`, score: n }), 2600);
            }, 600);
          }
          return n;
        });
      }
    }, 30);
  };

  const abandon = () => {
    grant?.('quest-refused');
    shout('QUEST ABANDONED');
    say('A reasonable decision, made by a reasonable person.');
    audio.jingle([67, 72, 76], 0.1, 'sine');
    window.setTimeout(() => onWin({ stat: 'WALKED AWAY. CORRECTLY.' }), 1800);
  };

  return (
    <div className="era2004">
      <div className="mmo-world">
        <div className="mmo-sky" />
        <div className="mmo-ground" />
        {Array.from({ length: 7 }, (_, i) => (
          <div
            key={i}
            className={`mushroom ${i < collected % 7 ? 'picked' : ''}`}
            style={{ left: `${8 + i * 12.5}%`, bottom: `${14 + (i % 3) * 9}%` }}
          />
        ))}
        <div className="hero" />
      </div>

      <div className="quest-panel">
        <h3>SAVE THE KINGDOM</h3>
        <p className="objective">
          Collect legendary mushrooms <b>{collected}/{goal}</b>
        </p>
        <div className="xp">
          <span style={{ width: `${Math.min(100, (collected / goal) * 100)}%` }} />
        </div>
        <div className="quest-buttons">
          <button className="btn" onClick={harvest} disabled={casting > 0 || stage === 'over'}>
            {casting > 0 ? 'HARVESTING…' : 'HARVEST MUSHROOM'}
          </button>
          {stage === 'grind' && (
            <button className="btn ghost" onClick={abandon}>
              USE THE TIME MACHINE
            </button>
          )}
        </div>
        {casting > 0 && (
          <div className="cast">
            <span style={{ width: `${casting * 100}%` }} />
          </div>
        )}
      </div>

      <div className="mmo-chat">
        {chat.map((c, i) => (
          <div key={`${c}-${i}`}>
            <b>[General]</b> {c}
          </div>
        ))}
      </div>
    </div>
  );
}
