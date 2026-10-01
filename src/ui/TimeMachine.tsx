import { useState } from 'react';
import { useGame } from '../core/state';
import { ERAS } from '../games/registry';
import { audio } from '../core/audio';

/** The hub: a timeline of years, and a machine that is missing most of its parts. */
export function TimeMachine() {
  const { progress, openEra, bump, addFragment, note, allErasDone, go, tuning } = useGame();
  const [clickedYear, setClickedYear] = useState<string | null>(null);

  // A year opens only once the one before it has actually been won.
  const unlockedIndex = ERAS.reduce((acc, e, i) => (progress.eras[e.id]?.won ? i + 1 : acc), 0);

  const onYearClick = (id: string, locked: boolean) => {
    if (locked) {
      const n = bump('yearClicks');
      audio.blip(160, 0.08, 'square', 0.16);
      if (n === 8) note('That year is not ready for you.', 'Win the one before it.');
      if (n === 20) {
        note("Yes. That's still the year.", 'Nothing you do to it will change that.');
        addFragment('secret:year-clicks');
      }
      setClickedYear(id);
      window.setTimeout(() => setClickedYear((c) => (c === id ? null : c)), 400);
      return;
    }
    audio.blip(520, 0.1, 'square', 0.2, 900);
    openEra(id);
  };

  return (
    <div className="screen machine-screen">
      <header className="machine-head">
        <h2>TIME MACHINE</h2>
        <p>Win a year to open the next one.</p>
        <button className="btn ghost small" onClick={() => go('difficulty')}>
          DIFFICULTY: {tuning.label}
        </button>
      </header>

      <ol className="timeline">
        {ERAS.map((e, i) => {
          const done = !!progress.eras[e.id];
          const locked = i > unlockedIndex;
          const won = progress.eras[e.id]?.won;
          return (
            <li
              key={e.id}
              className={[
                'tl-item',
                done ? 'done' : '',
                locked ? 'locked' : '',
                clickedYear === e.id ? 'shake' : '',
              ].join(' ')}
            >
              <button onClick={() => onYearClick(e.id, locked)} disabled={false}>
                <span className="tl-dot">{done ? '●' : locked ? '○' : '◉'}</span>
                <span className="tl-year">{e.label}</span>
                <span className="tl-title">{locked ? 'LOCKED' : e.title}</span>
                <span className={`tl-stat${done && !won ? ' missing' : ''}`}>
                  {won
                    ? (progress.eras[e.id]?.stat ?? 'COMPLETE')
                    : done
                      ? `${progress.eras[e.id]?.attempts ?? 0} TRIED`
                      : ''}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {allErasDone && (
        <div className="machine-finale">
          <p>Every year is accounted for.</p>
          <button className="btn huge" onClick={() => go('ending')}>
            START THE MACHINE
          </button>
        </div>
      )}
    </div>
  );
}
