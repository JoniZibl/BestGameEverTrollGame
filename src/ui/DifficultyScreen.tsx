import { useGame } from '../core/state';
import { DIFFICULTIES } from '../core/difficulty';
import { audio } from '../core/audio';

export function DifficultyScreen() {
  const { go, setDifficulty, difficulty, progress } = useGame();
  const returning = progress.seenIntro;

  return (
    <div className="screen difficulty-screen">
      <span className="result-kicker">HOW HARD SHOULD HISTORY BE</span>
      <h1 className="giant">
        PICK YOUR
        <br />
        DECADE.
      </h1>

      <ul className="diff-list">
        {DIFFICULTIES.map((d) => (
          <li key={d.id}>
            <button
              className={`diff-option${difficulty === d.id ? ' on' : ''}`}
              onClick={() => {
                audio.unlock();
                audio.startMusic();
                audio.blip(520 + DIFFICULTIES.indexOf(d) * 120, 0.1, 'square', 0.2, 900);
                setDifficulty(d.id);
                go(returning ? 'machine' : 'intro');
              }}
            >
              <span className="diff-label">{d.label}</span>
              <span className="diff-blurb">{d.blurb}</span>
            </button>
          </li>
        ))}
      </ul>

      <p className="footnote">
        Every year has three settings. You can change this later, and nobody will mention it.
      </p>
    </div>
  );
}
