import { useMemo } from 'react';
import { audio } from '../core/audio';

const LINES = [
  ['WELL.', 'THAT HAPPENED.'],
  ['HISTORY WILL', 'NOT REMEMBER', 'THIS RUN.'],
  ['THE COMPUTER', 'WON.'],
  ['TRY AGAIN?', 'HISTORY DEPENDS', 'ON IT.'],
  ['PRETTY REALISTIC', 'ARCADE', 'EXPERIENCE.'],
  ['THE MACHINE', 'IS DISAPPOINTED.', 'BUT NOT SURPRISED.'],
];

export function GameOverCard({
  reason,
  onRetry,
  onContinue,
}: {
  reason?: string;
  onRetry: () => void;
  onContinue: () => void;
}) {
  const lines = useMemo(() => LINES[Math.floor(Math.random() * LINES.length)], []);

  return (
    <div className="gameover-layer">
      <div className="gameover">
        <h1 className="giant">
          {lines.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </h1>
        {reason ? <p className="gameover-reason">{reason}</p> : null}
        <div className="gameover-actions">
          <button
            className="btn"
            onClick={() => {
              audio.blip(560, 0.1, 'square', 0.2, 900);
              onRetry();
            }}
          >
            TRY AGAIN
          </button>
          <button className="btn ghost" onClick={onContinue}>
            CONTINUE ANYWAY
          </button>
        </div>
        <p className="gameover-note">Failing is also history. The timeline moves either way.</p>
      </div>
    </div>
  );
}
