import { useGame } from '../core/state';
import { audio } from '../core/audio';

export function BriefScreen() {
  const { era, go } = useGame();
  if (!era) return null;

  const start = () => {
    audio.setEra(era.theme);
    audio.blip(620, 0.1, 'square', 0.22, 980);
    go('play');
  };

  return (
    <div className="screen brief-screen">
      <div className="brief-year">{era.label}</div>
      <h1 className="giant brief-lines">
        {era.tagline.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </h1>
      <p className="brief-controls">{era.controls}</p>
      <div className="brief-actions">
        <button className="btn huge" onClick={start}>
          PLAY {era.label}
        </button>
        <button className="btn ghost" onClick={() => go('machine')}>
          BACK TO THE MACHINE
        </button>
      </div>
    </div>
  );
}
