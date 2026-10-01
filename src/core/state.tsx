import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { loadProgress, saveProgress, wipeProgress, type Progress } from './storage';
import { ACHIEVEMENTS, TOTAL_FRAGMENTS } from './achievements';
import { audio } from './audio';
import { ERAS } from '../games/registry';

export type Screen =
  | 'title'
  | 'confirm'
  | 'intro'
  | 'machine'
  | 'brief'
  | 'play'
  | 'result'
  | 'ending';

export interface Toast {
  id: number;
  title: string;
  desc: string;
  kind: 'achievement' | 'fragment' | 'note';
}

interface Ctx {
  progress: Progress;
  screen: Screen;
  eraId: string | null;
  era: (typeof ERAS)[number] | null;
  toasts: Toast[];
  go(screen: Screen): void;
  openEra(id: string): void;
  completeEra(id: string, won: boolean, stat?: string, time?: number): void;
  grant(id: string): void;
  addFragment(id: string): void;
  bump(key: 'presses' | 'noCount' | 'yearClicks', by?: number): number;
  toggleMute(): void;
  markIntroSeen(): void;
  markDeepDive(id: string): void;
  note(text: string, sub?: string): void;
  reset(): void;
  fragmentCount: number;
  totalFragments: number;
  allErasDone: boolean;
}

const GameContext = createContext<Ctx | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<Progress>(() => loadProgress());
  const [screen, setScreen] = useState<Screen>('title');
  const [eraId, setEraId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(1);

  const progressRef = useRef(progress);
  progressRef.current = progress;

  useEffect(() => {
    saveProgress(progress);
  }, [progress]);

  useEffect(() => {
    audio.setMuted(progress.muted);
    // Only on boot: later changes flow through toggleMute.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pushToast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = toastId.current++;
    setToasts((prev) => [...prev, { ...t, id }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 4200);
  }, []);

  const grant = useCallback(
    (id: string) => {
      const p = progressRef.current;
      if (p.achievements.includes(id)) return;
      const def = ACHIEVEMENTS.find((a) => a.id === id);
      if (!def) return;
      progressRef.current = { ...p, achievements: [...p.achievements, id] };
      setProgress(progressRef.current);
      pushToast({ title: def.title, desc: def.desc, kind: 'achievement' });
      audio.jingle([79, 83, 86], 0.07, 'triangle');
    },
    [pushToast],
  );

  const addFragment = useCallback(
    (id: string) => {
      const p = progressRef.current;
      if (p.fragments.includes(id)) return;
      progressRef.current = { ...p, fragments: [...p.fragments, id] };
      setProgress(progressRef.current);
      pushToast({
        title: '+1 TIME FRAGMENT',
        desc: id.startsWith('secret:')
          ? 'Found somewhere it should not have been.'
          : 'The machine hums.',
        kind: 'fragment',
      });
    },
    [pushToast],
  );

  const note = useCallback(
    (text: string, sub = '') => pushToast({ title: text, desc: sub, kind: 'note' }),
    [pushToast],
  );

  const completeEra = useCallback(
    (id: string, won: boolean, stat?: string, time?: number) => {
      const p = progressRef.current;
      const prev = p.eras[id];
      const isNew = !p.fragments.includes(id);
      progressRef.current = {
        ...p,
        eras: {
          ...p.eras,
          [id]: {
            won: won || prev?.won || false,
            stat: stat ?? prev?.stat,
            attempts: (prev?.attempts ?? 0) + 1,
            bestTime: Math.max(prev?.bestTime ?? 0, time ?? 0) || undefined,
          },
        },
        fragments: isNew ? [...p.fragments, id] : p.fragments,
        lastEraPlayed: id,
      };
      setProgress(progressRef.current);
      if (isNew) {
        pushToast({ title: '+1 TIME FRAGMENT', desc: 'The machine hums.', kind: 'fragment' });
      }
    },
    [pushToast],
  );

  const bump = useCallback((key: 'presses' | 'noCount' | 'yearClicks', by = 1) => {
    const next = (progressRef.current[key] ?? 0) + by;
    progressRef.current = { ...progressRef.current, [key]: next };
    setProgress(progressRef.current);
    return next;
  }, []);

  const markIntroSeen = useCallback(() => {
    if (progressRef.current.seenIntro) return;
    progressRef.current = { ...progressRef.current, seenIntro: true };
    setProgress(progressRef.current);
  }, []);

  const toggleMute = useCallback(() => {
    const muted = audio.toggleMute();
    progressRef.current = { ...progressRef.current, muted };
    setProgress(progressRef.current);
    if (muted) {
      grant('quiet');
      addFragment('secret:muted');
      pushToast({
        title: 'SOUND OFF',
        desc: 'The composers worked very hard on this.',
        kind: 'note',
      });
    }
  }, [grant, addFragment, pushToast]);

  const markDeepDive = useCallback(
    (id: string) => {
      const p = progressRef.current;
      if (p.deepDives.includes(id)) return;
      progressRef.current = { ...p, deepDives: [...p.deepDives, id] };
      setProgress(progressRef.current);
      if (progressRef.current.deepDives.length >= 5) grant('archivist');
    },
    [grant],
  );

  const go = useCallback((s: Screen) => setScreen(s), []);

  const openEra = useCallback(
    (id: string) => {
      // TIME PARADOX: jumping from the far end of the timeline straight back to Pong.
      const last = progress.lastEraPlayed;
      if (id === 'y1972' && last && (ERAS.find((e) => e.id === last)?.year ?? 0) >= 2017) {
        grant('time-paradox');
      }
      setEraId(id);
      setScreen('brief');
    },
    [grant, progress.lastEraPlayed],
  );

  const reset = useCallback(() => {
    wipeProgress();
    setProgress(loadProgress());
    setScreen('title');
    setEraId(null);
  }, []);

  const era = useMemo(() => ERAS.find((e) => e.id === eraId) ?? null, [eraId]);
  const fragmentCount = progress.fragments.length;
  const allErasDone = ERAS.every((e) => progress.eras[e.id]);

  // TOUCHED GRASS — you left, and the game noticed.
  useEffect(() => {
    let leftAt = 0;
    const onVis = () => {
      if (document.hidden) leftAt = Date.now();
      else if (leftAt && Date.now() - leftAt > 8000) grant('touched-grass');
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [grant]);

  const value: Ctx = {
    progress,
    screen,
    eraId,
    era,
    toasts,
    go,
    openEra,
    completeEra,
    grant,
    addFragment,
    bump,
    toggleMute,
    markIntroSeen,
    markDeepDive,
    note,
    reset,
    fragmentCount,
    totalFragments: TOTAL_FRAGMENTS,
    allErasDone,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame outside provider');
  return ctx;
}
