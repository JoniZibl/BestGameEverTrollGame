import { useEffect, useMemo, useState } from 'react';
import type { Era } from '../core/types';
import { useGame } from '../core/state';
import { nextEra } from '../games/registry';
import { audio } from '../core/audio';

type Step = 'head' | 'fact' | 'more' | 'actions';

/** Split a fact into sentences so they can fade in one after another. */
const sentences = (text: string) =>
  text
    .split(/(?<=\.)\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

export function ResultCard({ era, stat }: { era: Era; stat?: string }) {
  const { go, openEra, markDeepDive, allErasDone } = useGame();
  const [step, setStep] = useState<Step>('head');
  const [page, setPage] = useState(0);
  const next = nextEra(era.id);

  const lines = useMemo(() => sentences(era.fact), [era.fact]);
  const dive = useMemo(
    () => [
      ['Made by', era.deepDive.developer],
      ['Released', era.deepDive.release],
      ['Platform', era.deepDive.platform],
      ['What was new', era.deepDive.innovation],
      ['Why it mattered', era.deepDive.why],
      ['One more thing', era.deepDive.funFact],
    ],
    [era],
  );

  const advance = () => {
    audio.blip(520, 0.05, 'square', 0.16, 760);
    if (step === 'head') setStep('fact');
    else if (step === 'fact') setStep('actions');
    else if (step === 'more') {
      if (page < dive.length - 1) setPage(page + 1);
      else {
        setPage(0);
        setStep('actions');
      }
    }
  };

  // Space or Enter reads on, the way a placard would if it could.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (step === 'actions') return;
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        advance();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="screen result-screen">
      {step === 'head' && (
        <div className="card-step" key="head">
          <span className="result-kicker">YEAR COMPLETE</span>
          <h1 className="giant">{era.label}</h1>
          <h2 className="result-title">{era.title}</h2>
          {stat ? <p className="result-stat">{stat}</p> : null}
          <button className="btn huge step-btn" onClick={advance}>
            CONTINUE
          </button>
        </div>
      )}

      {step === 'fact' && (
        <div className="card-step" key="fact">
          <span className="result-kicker">{era.label}</span>
          <h2 className="fact-head">{era.title}</h2>
          <div className="fact">
            {lines.map((l, i) => (
              <p key={l} style={{ animationDelay: `${i * 420}ms` }}>
                {l}
              </p>
            ))}
          </div>
          <div className="step-actions">
            <button className="btn step-btn" onClick={advance}>
              CONTINUE
            </button>
            <button
              className="btn ghost"
              onClick={() => {
                markDeepDive(era.id);
                audio.blip(480, 0.06, 'square', 0.16);
                setStep('more');
                setPage(0);
              }}
            >
              LEARN MORE
            </button>
          </div>
        </div>
      )}

      {step === 'more' && (
        <div className="card-step" key={`more-${page}`}>
          <span className="result-kicker">
            {era.label} · {page + 1} / {dive.length}
          </span>
          <h2 className="dive-label">{dive[page][0]}</h2>
          <p className="dive-body">{dive[page][1]}</p>
          <div className="dive-dots">
            {dive.map((d, i) => (
              <i key={d[0]} className={i === page ? 'on' : ''} />
            ))}
          </div>
          <div className="step-actions">
            <button className="btn step-btn" onClick={advance}>
              {page < dive.length - 1 ? 'NEXT' : 'DONE'}
            </button>
            <button
              className="btn ghost"
              onClick={() => {
                setPage(0);
                setStep('actions');
              }}
            >
              SKIP
            </button>
          </div>
        </div>
      )}

      {step === 'actions' && (
        <div className="card-step" key="actions">
          <span className="result-kicker">FRAGMENT SECURED · NEXT YEAR OPEN</span>
          <h1 className="giant small-giant">{era.label}</h1>
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
              <button
                className="btn huge"
                onClick={() => go(allErasDone ? 'ending' : 'machine')}
              >
                BACK TO THE MACHINE
              </button>
            )}
            <button className="btn ghost" onClick={() => go('machine')}>
              TIMELINE
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
