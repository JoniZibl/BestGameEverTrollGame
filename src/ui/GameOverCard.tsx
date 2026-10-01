import { useMemo } from 'react';
import { audio } from '../core/audio';
import { DIFFICULTIES, type DifficultyId } from '../core/difficulty';

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
  attempts,
  difficulty,
  onRetry,
  onEasier,
  onLeave,
}: {
  reason?: string;
  attempts: number;
  difficulty: DifficultyId;
  onRetry: () => void;
  onEasier: (next: DifficultyId) => void;
  onLeave: () => void;
}) {
  const lines = useMemo(() => LINES[Math.floor(Math.random() * LINES.length)], []);
  const idx = DIFFICULTIES.findIndex((d) => d.id === difficulty);
  // After three honest attempts the game stops pretending it cannot hear you.
  const easier = attempts >= 3 && idx > 0 ? DIFFICULTIES[idx - 1] : null;

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
          {easier ? (
            <button
              className="btn"
              onClick={() => {
                audio.blip(380, 0.12, 'square', 0.2, 620);
                onEasier(easier.id);
              }}
            >
              DROP TO {easier.label}
            </button>
          ) : null}
          <button className="btn ghost" onClick={onLeave}>
            TIMELINE
          </button>
        </div>
        <p className="gameover-note">
          {easier
            ? `${attempts} attempts. Nobody is counting, but the machine is.`
            : 'This year stays shut until you win it. That is the deal.'}
        </p>
      </div>
    </div>
  );
}
