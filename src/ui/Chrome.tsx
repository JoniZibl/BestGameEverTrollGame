import { useGame } from '../core/state';
import { ERAS } from '../games/registry';

export function TopBar() {
  const { progress, fragmentCount, totalFragments, screen, go, toggleMute, era } = useGame();
  if (screen === 'title' || screen === 'intro') return null;

  const pct = Math.round((fragmentCount / totalFragments) * 100);
  const done = ERAS.filter((e) => progress.eras[e.id]).length;

  return (
    <header className="topbar">
      <button className="topbar-home" onClick={() => go('machine')}>
        TIME MACHINE
      </button>
      <div className="fragments" title={`${done} years, ${fragmentCount} fragments`}>
        <span className="bar">
          <i style={{ width: `${pct}%` }} />
        </span>
        <span className="count">
          {fragmentCount} / {totalFragments} FRAGMENTS
        </span>
      </div>
      <div className="topbar-right">
        {era && screen === 'play' ? <span className="topbar-era">{era.label}</span> : null}
        <button className="topbar-mute" onClick={toggleMute} aria-label="toggle sound">
          {progress.muted ? 'SOUND OFF' : 'SOUND ON'}
        </button>
      </div>
    </header>
  );
}

export function Toasts() {
  const { toasts } = useGame();
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          <b>{t.title}</b>
          {t.desc ? <span>{t.desc}</span> : null}
        </div>
      ))}
    </div>
  );
}
