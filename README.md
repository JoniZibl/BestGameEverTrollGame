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
| 1962 | Two Dots And A Star | A gravity well with opinions, on a borrowed radar scope |
| 1972 | Two Rectangles | Second ball. Then eight. Then the controls reverse |
| 1978 | Descending Grid | The aliens learn to dodge, split, and follow you home |
| 1980 | Dot Management | The ghosts stop respecting walls, then swap roles with you |
| 1981 | Barrel Climb | The ladders start moving. Nobody authorised this |
| 1984 | Falling Shapes | x1 → x2 → x3 → x5 → x8 → x16, and four lines to find |
| 1985 | Run And Jump | Moving platforms, vanishing floor, patched physics, a scrolling deadline |
| 1991 | Loop Runner | It goes fast. Then faster. Then it stops asking |
| 1992 | Two Fighters | Round one is a formality. Round three is enormous |
| 1993 | The Third Dimension | Raycast corridors and a field of view that forgets itself |
| 1994 | Four Words In A Box | You win. Another random encounter. You win. Another one |
| 1996 | Actual Polygons | Fog, wobbling vertices, and a sudden "12,000 POLYGONS" |
| 1997 | The Line That Grows | It speeds up, then the walls switch off |
| 2000 | Connecting | A 56k handshake, a bar stuck at 8%, and 420ms of lag as a mechanic |
| 2001 | Needs Management | A new need appears. Then the fridge becomes an expansion pack |
| 2004 | Save The Kingdom | Collect three mushrooms. Excellent. Now collect 47 more |
| 2009 | Tower Demolition | Energy empty. Wait seven hours. (Just kidding) |
| 2011 | Block World | The sun sets, and something blocky wants a word |
| 2013 | One Button, Two Pipes | The game is free. The gaps are €2.99 |
| 2016 | Catch It | AR mode on, servers down, creature unimpressed |
| 2017 | Ninety-Nine Others | The other ninety-eight resolve themselves. The last one walks off the map |
| 2020s | Please Wait | Shaders, a day-one patch, a EULA, and then one button |

Twenty-two years, each with the game everybody remembers from it. Finish them all and the machine is repaired — which unlocks 2031, where the game
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

Keyboard and mouse on desktop (arrows / WASD, space, click). On a phone, **one
finger, no buttons** — every year is driven by a gesture that suits it:

| Gesture | Where |
| --- | --- |
| Slide your thumb | 1972 paddle, 1978 ship — the thing follows your finger, and holding also fires |
| Hold and steer | 1962 (the ship turns toward your finger, thrusts, and fires by itself), 2017 |
| Swipe | 1980 maze — a flick commits a direction instantly; holding and steering keeps it |
| Swipe + tap | 1984 — sideways to move, down to drop, tap to rotate |
| Drag + tap | 1985 and 2013 run by dragging and jump on a tap or an upward flick; 1992 moves by dragging and punches on a tap |
| Drag to look | 1993 and 1996 — sideways turns, forwards walks, a tap shoots |

A finger pressed on the playfield becomes a floating joystick whose anchor trails
the finger, so reversing direction costs a flick instead of a trip back across the
screen. A second finger is always a plain button, for anyone who would rather run
and jump at the same time. Each year states its gesture in one line when it starts,
and never explains more than that.

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
   `touchControls`, `goal`, theme, a short historical fact and a `deepDive` for the
   LEARN MORE panel.

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
properly. All twenty-seven fragments means winning all twenty-two years and finding the
five that are hidden somewhere else.

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
