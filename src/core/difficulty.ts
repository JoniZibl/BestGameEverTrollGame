export type DifficultyId = 'visitor' | 'player' | 'arcade';

export interface DifficultyDef {
  id: DifficultyId;
  label: string;
  blurb: string;
  /** Multiplies lives and health. */
  lives: number;
  /** Multiplies enemy speed, fall rate, spawn pressure. */
  pace: number;
  /** Multiplies how much you have to do. */
  goal: number;
  /** Multiplies time limits. */
  time: number;
  /** Seconds of mercy right after a twist fires. */
  grace: number;
}

export const DIFFICULTIES: DifficultyDef[] = [
  {
    id: 'visitor',
    label: 'VISITOR',
    blurb: 'Here for the museum. The years will go easy on you.',
    lives: 1.7,
    pace: 0.78,
    goal: 0.65,
    time: 1.35,
    grace: 1.8,
  },
  {
    id: 'player',
    label: 'PLAYER',
    blurb: 'Roughly how these years actually felt at the time.',
    lives: 1,
    pace: 1,
    goal: 1,
    time: 1,
    grace: 0.9,
  },
  {
    id: 'arcade',
    label: 'ARCADE',
    blurb: 'The machine wants your money. There is no money.',
    lives: 0.6,
    pace: 1.28,
    goal: 1.35,
    time: 0.85,
    grace: 0.35,
  },
];

export const difficultyDef = (id: DifficultyId) =>
  DIFFICULTIES.find((d) => d.id === id) ?? DIFFICULTIES[1];

/** What a minigame sees: the same numbers, already applied. */
export interface Tuning {
  id: DifficultyId;
  label: string;
  /** Lives, hearts, health. Never below one. */
  lives(base: number): number;
  /** Enemy speed, fall rate, spawn pressure. */
  pace(base: number): number;
  /** Targets, lines, pellets, pipes — how much is asked of you. */
  goal(base: number): number;
  /** Time limits, in seconds. */
  time(base: number): number;
  /** Seconds of mercy after each twist. */
  readonly grace: number;
  readonly isEasy: boolean;
  readonly isHard: boolean;
}

export function tuning(id: DifficultyId): Tuning {
  const d = difficultyDef(id);
  return {
    id: d.id,
    label: d.label,
    lives: (base) => Math.max(1, Math.round(base * d.lives)),
    pace: (base) => base * d.pace,
    goal: (base) => Math.max(1, Math.round(base * d.goal)),
    time: (base) => base * d.time,
    grace: d.grace,
    isEasy: d.id === 'visitor',
    isHard: d.id === 'arcade',
  };
}
