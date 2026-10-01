// Games schedule a few things with window.setTimeout; node needs to be told.
(globalThis as unknown as { window: unknown }).window = globalThis;

import { simulate, runs } from './harness';
import { pongBot, shooterBot, flapBot, royaleBot, rpgBot, simsBot, sonicBot } from './bots';
import { create1972 } from '../src/games/y1972';
import { create1978 } from '../src/games/y1978';
import { create2013 } from '../src/games/y2013';
import { create1991 } from '../src/games/y1991';
import { create1994 } from '../src/games/y1994';
import { create2001 } from '../src/games/y2001';
import { create2017 } from '../src/games/y2017';
import type { DifficultyId } from '../src/core/difficulty';

const DIFFS: DifficultyId[] = ['visitor', 'player', 'arcade'];
const games = [
  { name: '1972 pong', create: create1972, bot: pongBot },
  { name: '1978 shooter', create: create1978, bot: shooterBot },
  { name: '2013 flap', create: create2013, bot: flapBot },
  { name: '1991 runner', create: create1991, bot: sonicBot },
  {
    name: '1994 rpg',
    create: create1994,
    bot: rpgBot,
    reset: () => (rpgBot as unknown as { reset: () => void }).reset(),
  },
  { name: '2001 life sim', create: create2001, bot: simsBot },
  { name: '2017 royale', create: create2017, bot: royaleBot, reset: () => (royaleBot as unknown as { reset: () => void }).reset() },
];

for (const g of games) {
  for (const d of DIFFS) {
    const r = runs(5, () => {
      (g as { reset?: () => void }).reset?.();
      return simulate(g.create, g.bot, { difficulty: d, maxSeconds: 150 });
    });
    const first = r.samples[0];
    console.log(
      `${g.name.padEnd(14)} ${d.padEnd(8)} win ${r.win}/5  lose ${r.lose}  timeout ${r.timeout}` +
        `   e.g. ${first.outcome} @${first.seconds.toFixed(0)}s ${first.reason ?? first.stat ?? ''} | ${first.hud}`,
    );
  }
}
