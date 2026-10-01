import { useCallback, useRef, useState } from 'react';
import { useGame } from '../core/state';
import { GameHost } from './GameHost';
import { GameOverCard } from './GameOverCard';
import { ResultCard } from './ResultCard';
import { audio } from '../core/audio';
import type { WinPayload } from '../core/types';

type Outcome = { kind: 'won'; stat?: string } | { kind: 'lost'; reason?: string } | null;

export function PlayScreen() {
  const { era, completeEra, grant, addFragment, bump, progress, go } = useGame();
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [attempt, setAttempt] = useState(0);
  const started = useRef(Date.now());

  const onWin = useCallback(
    (p?: WinPayload) => {
      if (!era) return;
      const elapsed = (Date.now() - started.current) / 1000;
      completeEra(era.id, true, p?.stat, elapsed);
      if (era.id === 'y1972' && p?.stat?.startsWith('FLAWLESS')) grant('champion-1972');
      audio.fanfare();
      setOutcome({ kind: 'won', stat: p?.stat });
    },
    [era, completeEra, grant],
  );

  const onLose = useCallback(
    (reason?: string) => {
      const elapsed = (Date.now() - started.current) / 1000;
      if (elapsed < 2.2) grant('skill-issue');
      audio.thud();
      setOutcome({ kind: 'lost', reason });
    },
    [grant],
  );

  const onPress = useCallback(
    (delta: number) => {
      const total = bump('presses', delta);
      if (total >= 1000 && !progress.achievements.includes('button-masher')) {
        grant('button-masher');
        addFragment('secret:masher');
      }
    },
    [bump, grant, addFragment, progress.achievements],
  );

  if (!era) return null;

  if (outcome?.kind === 'won') {
    return <ResultCard era={era} won stat={outcome.stat} />;
  }

  return (
    <div className="screen play-screen">
      <div className="play-head">
        <span className="play-year">{era.label}</span>
        <span className="play-title">{era.title}</span>
        <button className="btn tiny ghost" onClick={() => go('machine')}>
          ABANDON YEAR
        </button>
      </div>
      <GameHost key={`${era.id}-${attempt}`} era={era} onWin={onWin} onLose={onLose} onPress={onPress} />
      {outcome?.kind === 'lost' && (
        <GameOverCard
          reason={outcome.reason}
          onRetry={() => {
            started.current = Date.now();
            setOutcome(null);
            setAttempt((a) => a + 1);
          }}
          onContinue={() => {
            completeEra(era.id, false, 'SURVIVED, BARELY');
            setOutcome({ kind: 'won', stat: 'HISTORY CONTINUED WITHOUT YOU' });
          }}
        />
      )}
    </div>
  );
}
