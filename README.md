# GAME TIME MACHINE

A playable comedy time-trip through roughly seventy years of video game history.

You arrive in 1962 with a broken time machine. Every year you visit has a game in it.
Each game starts exactly as you remember the genre — and then, within a few seconds,
goes somewhere it should not. Survive the year, collect a time fragment, travel on.


> SHORT. FUNNY. PLAYABLE. SURPRISING. HISTORICALLY INTERESTING.

The site itself never changes its look: cream, dark brown, one red accent, from the
title screen to the ending. Only the playfield shifts when you step into a year —
1962 flickers, 1984 goes eight-bit, the 2020s go dark — and the frame around it
stays exactly where it was.

## The timeline

| Year | Game | The twist |
| --- | --- | --- |
| 1962 | Two dots and a star | A gravity well with opinions, on a borrowed radar scope |
| 1972 | Two rectangles | Second ball. Then eight. Then an absurd opponent paddle |
| 1978 | Descending grid | The aliens learn to dodge, split, and follow you home |
| 1980 | Dot management | The ghosts stop respecting walls, then swap roles with you |
| 1984 | Falling shapes | x1 → x2 → x4 → x8 → x16, in under thirty seconds |
| 1985 | Run and jump | Moving platforms, vanishing floor, patched physics, a scrolling deadline |
| 1992 | Two fighters | Round one is a formality. Round two is a lesson |
| 1993 | The third dimension | Raycast corridors, and a field of view that forgets itself |
| 1996 | Actual polygons | Fog, wobbling vertices, and a sudden "12,000 POLYGONS" |
| 2000 | Connecting | A 56k handshake, a bar stuck at 8%, and 420ms of lag as a mechanic |
| 2004 | Save the kingdom | Collect three mushrooms. Excellent. Now collect 47 more |
| 2009 | Pocket sized | Energy empty. Wait seven hours. (Just kidding) |
| 2013 | Some assembly required | The game is free. Jumping is €2.99 |
| 2017 | Ninety-nine others | The other ninety-eight resolve themselves. The last one walks off the map |
| 2020s | Please wait | Shaders, a day-one patch, a EULA, and then one button |

Finish them all and the machine is repaired — which unlocks 2031, where the game
plays itself, very well, without you.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static output in dist/
npm run preview
```

No backend. Progress lives in `localStorage`.

## Controls

Keyboard and mouse on desktop (arrows / WASD, space, click), on-screen buttons on
touch devices. Every game states its controls in one line and never explains more
than that.

## How it is put together

```
src/
  core/        engine-level pieces shared by everything
    types.ts       Era + GameApi contracts
    input.ts       keyboard / pointer / virtual buttons in one object
    audio.ts       Web Audio engine; one music definition per visual era
    state.tsx      progress, fragments, achievements, screen routing
    storage.ts     localStorage persistence
  games/
    registry.ts    the timeline: metadata, history facts, deep dives
    y1962.ts …     one module per year
    helpers.ts     drawing + a tiny Script class that fires the twists
  ui/            title, confirm, intro, time machine, play host, results, ending
  styles/
    global.css     the one visual identity: layout, typography, buttons
    eras.css       per-era palettes, scoped to `.stage` so only the game changes
```

### Adding a year

1. Write `src/games/yXXXX.ts` exporting `createXXXX(api: GameApi): MiniGame`
   (`start` / `update(dt)` / `draw`), or a React component for UI-driven satire.
2. Add an `Era` entry to `src/games/registry.ts` with its year, tagline, controls,
   theme, a short historical fact and a `deepDive` for the LEARN MORE panel.

Everything else — unlocking, fragments, timeline position, result card, touch
controls, the soundtrack switch — is wired from that one entry.

### Twists

Each game builds its comedy from the same small class:

```ts
const script = new Script([
  { at: 8,  run: () => bump(2, 'Okay. Maybe we made this too easy.') },
  { at: 13, run: () => bump(4, 'Still comfortable?') },
  { at: 22, run: () => bump(16, 'Right.') },
]);
```

## Failing is fine. It is just not free.

Losing never blocks the timeline: the game over screen offers TRY AGAIN and CONTINUE
ANYWAY, and the next year unlocks either way. But a **time fragment is only awarded
for an actual win**, so a year you merely survived shows up on the timeline as
`NO FRAGMENT · RETRY` and the machine stays broken until you go back and do it
properly. All twenty fragments means winning all fifteen years and finding the five
that are hidden somewhere else.

Each year states its win condition before it starts — survive 46 seconds, clear four
lines, catch all three ghosts, find five crystals in the fog — and most of them get
genuinely difficult before the end.

## Originality and copyright

No assets, music, characters, logos, level layouts or UI from any historical game
are used. Every sprite, sound, shape, level and line of text here is original. The
real games are referred to by name only in the historical notes, which is what those
notes are for. Mechanics are used as inspiration, as the history of this medium
intends.

Facts in the LEARN MORE panels are accurate to the best of our knowledge; the jokes
around them are not meant to be.
