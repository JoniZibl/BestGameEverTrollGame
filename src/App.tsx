import { useEffect } from 'react';
import { useGame } from './core/state';
import { TitleScreen } from './ui/TitleScreen';
import { ConfirmScreen } from './ui/ConfirmScreen';
import { IntroScreen } from './ui/IntroScreen';
import { TimeMachine } from './ui/TimeMachine';
import { BriefScreen } from './ui/BriefScreen';
import { PlayScreen } from './ui/PlayScreen';
import { EndingScreen } from './ui/EndingScreen';
import { TopBar, Toasts } from './ui/Chrome';
import { ERAS } from './games/registry';
import { audio } from './core/audio';
import type { ThemeId } from './core/types';

/** The whole site ages with the player: 1962 terminal, 2020s glass. */
function shellTheme(lastPlayed: string | null, eras: Record<string, unknown>): ThemeId {
  const played = ERAS.filter((e) => eras[e.id]);
  const latest = lastPlayed ? ERAS.find((e) => e.id === lastPlayed) : undefined;
  const ref = latest ?? played[played.length - 1];
  return ref?.theme ?? 'oscilloscope';
}

export default function App() {
  const { screen, era, progress, markIntroSeen, note, addFragment, allErasDone, grant } = useGame();

  const theme: ThemeId =
    screen === 'play' || screen === 'brief'
      ? era?.theme ?? 'oscilloscope'
      : screen === 'ending'
        ? 'modern'
        : shellTheme(progress.lastEraPlayed, progress.eras);

  useEffect(() => {
    if (screen === 'intro') markIntroSeen();
  }, [screen, markIntroSeen]);

  useEffect(() => {
    if (screen !== 'play') audio.setEra(theme);
  }, [theme, screen]);

  useEffect(() => {
    if (allErasDone) grant('historian');
  }, [allErasDone, grant]);

  // "Nice monitor."
  useEffect(() => {
    if (screen !== 'machine') return;
    if (window.innerWidth >= 1900 && !progress.fragments.includes('secret:big-monitor')) {
      window.setTimeout(() => {
        note('Nice monitor.', 'In 1962 that would have been a building.');
        addFragment('secret:big-monitor');
      }, 1200);
    }
  }, [screen, note, addFragment, progress.fragments]);

  return (
    <div className="app" data-theme={theme} data-screen={screen}>
      <div className="app-inner">
        <TopBar />
        {screen === 'title' && <TitleScreen />}
        {screen === 'confirm' && <ConfirmScreen />}
        {screen === 'intro' && <IntroScreen />}
        {screen === 'machine' && <TimeMachine />}
        {screen === 'brief' && <BriefScreen />}
        {(screen === 'play' || screen === 'result') && <PlayScreen />}
        {screen === 'ending' && <EndingScreen />}
        <Toasts />
      </div>
      <div className="crt-overlay" aria-hidden="true" />
    </div>
  );
}
