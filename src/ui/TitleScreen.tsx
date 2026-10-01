import { useState } from 'react';
import { useGame } from '../core/state';
import { audio } from '../core/audio';

export function TitleScreen() {
  const { go, progress, grant } = useGame();
  const [teased, setTeased] = useState(false);

  const start = () => {
    audio.unlock();
    audio.startMusic();
    audio.setEra('oscilloscope');
    audio.blip(440, 0.12, 'square', 0.25, 880);
    grant('first-jump');
    go('confirm');
  };

  return (
    <div className="screen title-screen">
      <h1 className="giant">
        THIS GAME
        <br />
        WILL
        <br />
        CHANGE
        <br />
        YOUR LIFE.
        <br />
        FOR
        <br />
        LIKE 10
        <br />
        MINUTES.
      </h1>
      <div className="title-actions">
        <button className="btn huge" onClick={start}>
          PLAY
        </button>
        {progress.fragments.length > 0 && (
          <button className="btn ghost" onClick={() => { audio.unlock(); audio.startMusic(); go('machine'); }}>
            CONTINUE · {progress.fragments.length} FRAGMENTS
          </button>
        )}
      </div>
      <p
        className="footnote"
        onMouseEnter={() => setTeased(true)}
      >
        {teased ? 'It is mostly rectangles. We are being honest with you.' : 'A playable history of video games. Sort of.'}
      </p>
    </div>
  );
}
