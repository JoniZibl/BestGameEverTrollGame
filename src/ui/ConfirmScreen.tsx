import { useState } from 'react';
import { useGame } from '../core/state';
import { audio } from '../core/audio';

const NO_LINES = [
  'Wrong answer.',
  'Try the other one.',
  'Why are you still here?',
  'The button is right there.',
  'Fine.',
];

export function ConfirmScreen() {
  const { go, bump, grant, addFragment, progress } = useGame();
  const [noCount, setNoCount] = useState(0);
  const [nudge, setNudge] = useState({ x: 0, y: 0 });
  const [line, setLine] = useState('');

  const yes = () => {
    audio.blip(660, 0.12, 'square', 0.25, 1200);
    go(progress.seenIntro ? 'machine' : 'intro');
  };

  const no = () => {
    const total = bump('noCount');
    const n = noCount + 1;
    setNoCount(n);
    setLine(NO_LINES[Math.min(n - 1, NO_LINES.length - 1)]);
    audio.blip(200, 0.1, 'square', 0.2, 120);
    setNudge({ x: (Math.random() - 0.5) * 260, y: (Math.random() - 0.5) * 140 });
    if (total >= 5 || n >= 5) {
      grant('persistent-no');
      addFragment('secret:persistent-no');
      window.setTimeout(yes, 900);
    }
  };

  return (
    <div className="screen confirm-screen">
      <h1 className="giant">
        SURE YOU
        <br />
        WANNA
        <br />
        PLAY THIS
        <br />
        ABSOLUTLY
        <br />
        GREAT GAME?
      </h1>
      {line ? <p className="confirm-line">{line}</p> : null}
      <div className="confirm-buttons">
        <button
          className="btn outline"
          style={{ fontSize: `${Math.min(3.4, 1.4 + noCount * 0.45)}rem`, padding: `${0.4 + noCount * 0.2}em 1.2em` }}
          onClick={yes}
        >
          YES
        </button>
        <button
          className="btn outline runaway"
          style={{ transform: `translate(${nudge.x}px, ${nudge.y}px)` }}
          onMouseEnter={() => noCount > 1 && setNudge({ x: (Math.random() - 0.5) * 300, y: (Math.random() - 0.5) * 160 })}
          onClick={no}
        >
          NO
        </button>
      </div>
    </div>
  );
}
