// The world's play time (state.run.clock): when its enemies come back (core/respawn.js), its
// days and nights (core/daycycle.js), its slime meteorites (core/meteors.js).
//
// Alone it counts the frames played (stopped while the game is paused). Playing together every
// game must have the same: the host's runs on real time from where it was when the others came,
// so slow frames, hit pauses, a hidden tab or loading lose nothing, and the guests follow the
// host's (core/worldclock.js: told with every ping and in the welcome, net/session.js). Other
// clocks (a trial's, Foggery's platforms, Renew's room) still run on the frames: each has its
// own owner who tells the others.
import { state } from './state.js';
import { online, together } from '../net/online.js';
import { hostClock, heard, follow } from '../core/worldclock.js';

let anchor = null;    // the host's: its run, its clock c at our time `at` (ms), and what was set last
let samples = [];     // a guest's: the host's words, { c, at }

const hosting = () => online.role === 'host' && together();
const following = () => online.role === 'guest' && online.slot !== null && together() && samples.length > 0;

// every frame (main.js; dt 0 in the main menu)
export function tickWorldClock(dt, now = performance.now()) {
  const run = state.run;
  if (!run) return;
  if (!hosting()) anchor = null;
  if (online.role !== 'guest') samples = [];
  if (hosting()) {
    // (from where it is: the start, or a clock set meanwhile: another world, a dev command)
    if (!anchor || anchor.run !== run || anchor.set !== run.clock) anchor = { run, c: run.clock, at: now };
    run.clock = anchor.set = anchor.c + (now - anchor.at) / 1000;
  } else if (following()) run.clock = follow(run.clock, hostClock(samples, now));
  else if (state.map) run.clock += dt;
}

// the clock as of now, between frames too (the host's pings come from a timer, also in a
// background tab)
export function worldClock(now = performance.now()) {
  const run = state.run;
  if (anchor && anchor.run === run && anchor.set === run.clock) return anchor.c + (now - anchor.at) / 1000;
  return run?.clock ?? 0;
}

// a guest heard the host's clock (s); fresh: a new world or a new welcome, forget the old words
export function heardClock(c, fresh = false, now = performance.now()) {
  if (!Number.isFinite(c) || c < 0) return;
  samples = heard(fresh ? [] : samples, c, now);
}
