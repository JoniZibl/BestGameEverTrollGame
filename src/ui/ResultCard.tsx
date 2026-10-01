import { useState } from 'react';
import type { Era } from '../core/types';
import { useGame } from '../core/state';
import { nextEra } from '../games/registry';
import { audio } from '../core/audio';

export function ResultCard({ era, won, stat }: { era: Era; won: boolean; stat?: string }) {
  const { go, openEra, markDeepDive, progress } = useGame();
  const [open, setOpen] = useState(false);
  const next = nextEra(era.id);

  const toggle = () => {
    if (!open) markDeepDive(era.id);
    audio.blip(480, 0.06, 'square', 0.16);
    setOpen(!open);
  };

  return (
    <div className="screen result-screen">
      <div className="result-head">
        <span className="result-kicker">{won ? 'YEAR COMPLETE' : 'YEAR SURVIVED'}</span>
        <h1 className="giant">{era.label}</h1>
        <h2 className="result-title">{era.title}</h2>
        {stat ? <p className="result-stat">{stat}</p> : null}
      </div>

      <p className="fact">{era.fact}</p>

      <button className="btn ghost small" onClick={toggle}>
        {open ? 'LESS' : 'LEARN MORE'}
      </button>

      {open && (
        <dl className="deep-dive">
          <div>
            <dt>Made by</dt>
            <dd>{era.deepDive.developer}</dd>
          </div>
          <div>
            <dt>Released</dt>
            <dd>{era.deepDive.release}</dd>
          </div>
          <div>
            <dt>Platform</dt>
            <dd>{era.deepDive.platform}</dd>
          </div>
          <div>
            <dt>What was new</dt>
            <dd>{era.deepDive.innovation}</dd>
          </div>
          <div>
            <dt>Why it mattered</dt>
            <dd>{era.deepDive.why}</dd>
          </div>
          <div>
            <dt>One more thing</dt>
            <dd>{era.deepDive.funFact}</dd>
          </div>
        </dl>
      )}

      <div className="result-actions">
        {next ? (
          <button
            className="btn huge"
            onClick={() => {
              audio.blip(700, 0.12, 'square', 0.22, 1300);
              openEra(next.id);
            }}
          >
            TRAVEL TO {next.label} →
          </button>
        ) : (
          <button className="btn huge" onClick={() => go(progress.fragments.length >= 15 ? 'ending' : 'machine')}>
            BACK TO THE MACHINE
          </button>
        )}
        <button className="btn ghost" onClick={() => go('machine')}>
          TIMELINE
        </button>
      </div>
    </div>
  );
}
