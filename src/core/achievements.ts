export interface AchievementDef {
  id: string;
  title: string;
  desc: string;
  secret?: boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-jump', title: 'IT BEGINS', desc: 'Start the time machine.' },
  { id: 'historian', title: 'HISTORIAN', desc: 'Complete every era.' },
  { id: 'champion-1972', title: '1972 CHAMPION', desc: 'Finish 1972 without conceding a single ball.' },
  { id: 'button-masher', title: 'BUTTON MASHER', desc: 'Press 1000 buttons.' },
  { id: 'time-paradox', title: 'TIME PARADOX', desc: 'Travel from the far future straight back to 1972.' },
  { id: 'skill-issue', title: 'SKILL ISSUE', desc: 'Lose within 2 seconds.' },
  { id: 'touched-grass', title: 'TOUCHED GRASS', desc: 'Leave the game. Come back.' },
  { id: 'archivist', title: 'ARCHIVIST', desc: 'Read the small print on 5 eras.' },
  { id: 'quiet', title: 'THE COMPOSERS NOTICED', desc: 'Mute the soundtrack.' },
  { id: 'persistent-no', title: 'COMMITMENT ISSUES', desc: 'Refuse to play 5 times.', secret: true },
  { id: 'quest-refused', title: 'WORK-LIFE BALANCE', desc: 'Abandon a quest. Correctly.', secret: true },
  { id: 'patient', title: 'PATIENCE', desc: 'Wait for a loading bar that was never moving.', secret: true },
];

/** Fragments that are not eras. The time machine needs 20 in total. */
export const SECRET_FRAGMENTS = [
  'secret:persistent-no',
  'secret:year-clicks',
  'secret:muted',
  'secret:big-monitor',
  'secret:masher',
] as const;

/** Every era is a fragment, plus the five that are hidden elsewhere. */
export const totalFragments = (eraCount: number) => eraCount + SECRET_FRAGMENTS.length;
