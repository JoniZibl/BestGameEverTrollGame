# Playability harness

`npm run sim` plays the games headlessly and reports whether they can be won.

It exists because "this year feels unwinnable" is not a matter of opinion — it is
measurable. The harness runs a game's `update` loop with no canvas, a scripted
player, and the real difficulty tuning, then counts wins over several runs at each
setting.

Two details make it honest:

- **Bots read what the game drew.** `Recorder` captures the canvas calls, so a bot
  finds the ball or the pipes the same way a player's eyes would. No game needs a
  debug hook, and nothing here ships in the build.
- **The fakes behave like the real thing.** `FakeInput` deliberately does not extend
  `Input` (class fields would shadow a subclass accessor and silently feed every bot
  a dead controller), popups are answered synchronously, and `window.setTimeout` runs
  on simulated time.

A bot is a floor, not a ceiling: a human plays better. Treat "bot wins 5/5 on
VISITOR" as the bar for a year being fair, and a bot losing 5/5 on ARCADE as the
hardest setting doing its job.
