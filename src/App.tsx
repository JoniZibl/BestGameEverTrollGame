import { useEffect } from 'react';
import { useGame } from './core/state';
import { TitleScreen } from './ui/TitleScreen';
import { ConfirmScreen } from './ui/ConfirmScreen';
import { IntroScreen } from './ui/IntroScreen';
import { DifficultyScreen } from './ui/DifficultyScreen';
import { TimeMachine } from './ui/TimeMachine';
import { BriefScreen } from './ui/BriefScreen';
import { PlayScreen } from './ui/PlayScreen';
import { EndingScreen } from './ui/EndingScreen';
import { TopBar, Toasts } from './ui/Chrome';
import { audio } from './core/audio';

export default function App() {
  const { screen, era, progress, markIntroSeen, note, addFragment, allErasDone, grant } = useGame();

  // The site keeps one identity. Only the playfield changes era, inside GameHost.
  useEffect(() => {
    if (screen === 'intro') markIntroSeen();
  }, [screen, markIntroSeen]);

  useEffect(() => {
    if (screen === 'play' && era) audio.setEra(era.theme);
    else audio.setEra('arcade');
  }, [screen, era]);

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
    <div className="app" data-screen={screen}>
      <div className="app-inner">
        <TopBar />
        {screen === 'title' && <TitleScreen />}
        {screen === 'confirm' && <ConfirmScreen />}
        {screen === 'intro' && <IntroScreen />}
        {screen === 'difficulty' && <DifficultyScreen />}
        {screen === 'machine' && <TimeMachine />}
        {screen === 'brief' && <BriefScreen />}
        {(screen === 'play' || screen === 'result') && <PlayScreen />}
        {screen === 'ending' && <EndingScreen />}
        <Toasts />
      </div>
    </div>
  );
}
