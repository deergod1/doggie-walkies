// The world's play time while playing together (game/worldclock.js keeps it): pure.
//
// Alone, the clock (state.run.clock) counts the frames played. Together that would drift: a
// slow frame is cut short (main.js MAX_STEP), a hit pause slows one game, a hidden tab stops
// it, loading stalls it. So together the host's clock runs on real time (performance.now), and
// each guest follows it: the host tells its clock with every ping (net/session.js), and the
// guest runs it on, on its own real time, from what it heard. Each word is late by its trip
// over the network, so the one that came quickest (the latest estimate) is the best.

export const HOLD = 2;      // s a guest's clock may be ahead of the host's and just wait for it
export const KEEP = 8000;   // ms the host's words are kept

// the host's clock now (s) from its words [{ c (its clock, s), at (when we heard it, our ms) }],
// or null without any
export const hostClock = (samples, now) => samples.length ? Math.max(...samples.map(s => s.c + (now - s.at) / 1000)) : null;

// the words kept after hearing clock `c` at `at`: the last KEEP ms; if the host's clock went
// back (a new world, its computer slept) only this one
export function heard(samples, c, at) {
  const before = hostClock(samples, at);
  if (before !== null && before - c > HOLD) return [{ c, at }];
  return [...samples.filter(s => s.at > at - KEEP), { c, at }];
}

// where a guest's clock goes towards the host's (target): forward at once; a little ahead it
// waits (it never runs back a little: a meteorite would come again, game/meteors.js); far
// ahead it goes back
export const follow = (clock, target) => target >= clock || clock - target > HOLD ? target : clock;
