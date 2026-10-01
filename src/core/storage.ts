export interface EraRecord {
  won: boolean;
  stat?: string;
  attempts: number;
  bestTime?: number;
}

export interface Progress {
  version: number;
  seenIntro: boolean;
  eras: Record<string, EraRecord>;
  /** Era ids plus secret fragment ids. */
  fragments: string[];
  achievements: string[];
  presses: number;
  noCount: number;
  yearClicks: number;
  deepDives: string[];
  muted: boolean;
  lastEraPlayed: string | null;
}

const KEY = 'gtm.progress.v1';

export const emptyProgress = (): Progress => ({
  version: 1,
  seenIntro: false,
  eras: {},
  fragments: [],
  achievements: [],
  presses: 0,
  noCount: 0,
  yearClicks: 0,
  deepDives: [],
  muted: false,
  lastEraPlayed: null,
});

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyProgress();
    const parsed = JSON.parse(raw) as Partial<Progress>;
    return { ...emptyProgress(), ...parsed };
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(p: Progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* private mode, a full disk, 1962 — all equally fine */
  }
}

export function wipeProgress() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
