// Slomo's fight as rules (game/slomo.js runs it; his profiles are core/enemies.js SLOMO,
// SLOMO_LEGS and SLOMO_SLUG). docs/bosses.md tells the whole fight.
//
// Three phases, a third of his health each. No blow takes him below the next phase's share of his
// health (`splits`); there he changes (`morphTime` s, nothing hurting him meanwhile) and fights on
// with the next phase's attacks:
//   1 (a blob)      a great see-through blob of slime with two slug arms: he throws the slugs at
//                   the end of his arms (each lands where it flies and comes to life: an arm slug
//                   that crawls after the player, latches on and dies; the arm grows a new one,
//                   `arms.grow`) and spits slime meteorites up into the sky that come down round
//                   the player (`rain`)
//   2 (legs)        the blob in front of a slug body on long legs: he walks after the player and
//                   now and then (`jump`) jumps up high onto them (his landing sends out
//                   shockwaves); he floods the bowl with slime from one side (`flood`), and the
//                   meteorites
//   3 (the slug)    the slug alone, legs and all: he spits slime, calls slimes out of himself (up to
//                   `minions.slimes`: Ooze slugs and Ooze bolimes) and Slime squirtles (up to
//                   `minions.squirtles`), floods the bowl and the meteorites
// The flood comes in from a side of his bowl (a different one each time, at random): its front
// runs across in `surge` s, the slime stands `high` s and drains away in `drain` s. It never stands
// over anyone's head; it slows whoever wades through it (`slow`: the slime's, on top of the wading).
// His death drains the flood and takes his minions along. His arena is always at night.
import { mulberry32 } from './util.js';
import { JUMP_V, GRAV, CHAR_R } from './constants.js';

export const SLOMO_FIGHT = Object.freeze({
  splits: [2 / 3, 1 / 3],    // the shares of his health phase 2 and phase 3 start at
  morphTime: 3.2,            // s he changes into the next phase's shape, nothing hurting him
  appear: 0.5,               // s more nothing hurts him once he has changed
  arms: { grow: 3 },         // s a slug arm he threw takes to grow back
  armSlugs: 4,               // the most arm slugs about at once (more thrown ones melt where they land)
  armLife: 8,                // s an arm slug crawls after the player before it melts away
  // an arm slug that reaches the player latches on (`reach` cells from it): it bites every `bite` s
  // (`power` of its damage, slowing), and after `hold` s it drops off dead
  latch: { reach: 0.75, bite: 0.6, hold: 2.4, power: 0.5, slow: { time: 0.8, slow: 0.6, source: 'slime' } },
  // the meteorites he spits up: when the first one is due after the fight starts, then between
  // casts (s); they come down round the player (game/meteors.js rainOf)
  rain: { first: 4, every: [8, 12] },
  flood: { first: 5, every: [13, 19], surge: 2.4, high: 1.5, drain: 10, slow: { time: 0.35, slow: 0.72, source: 'slime' } },
  jump: { first: 3, every: [8, 12] },   // phase 2: s into it before his first jump, then between jumps (he walks after you meanwhile)
  minions: { slimes: 5, squirtles: 2 },   // phase 3: the most slimes (Ooze slugs, Ooze bolimes) / Slime squirtles at once
  summonCool: { slimes: 8, squirtles: 12 },   // s from one summon of each to the next
  firstSummon: 2,            // s into phase 3 before his first summons
  leave: 0.5,                // s a minion he takes along lingers, gone, before it is let go
});
const ALL = ['armL', 'armR', 'meteor', 'jump', 'flood', 'spit', 'summon', 'squirtle'];
const MINE = [['armL', 'armR', 'meteor'], ['jump', 'flood', 'meteor'], ['spit', 'summon', 'squirtle', 'flood', 'meteor']];

// the health below which no blow takes him in phase `phase` (0 in the last)
export const phaseFloor = (maxHp, phase) => phase <= SLOMO_FIGHT.splits.length ? Math.ceil(maxHp * SLOMO_FIGHT.splits[phase - 1]) : 0;
// how many a summon of `name` ('slimes' or 'squirtles') brings with `alive` of them about
export const summonCount = (name, alive) => Math.max(0, (SLOMO_FIGHT.minions[name] ?? 0) - alive);
// The attacks he may not start now (names): those of the other phases; the flood when it is due,
// and then nothing else; the meteorites, the jump and the summons only when due; an arm throw only
// while he has that slug arm.
export function barred({ phase, arms = [1, 1], floodDue = false, rainDue = false, jumpDue = false, slimesDue = false, squirtlesDue = false }) {
  const mine = new Set(MINE[phase - 1]);
  if (floodDue && mine.has('flood')) return new Set(ALL.filter(n => n !== 'flood'));
  return new Set(ALL.filter(n => !mine.has(n) || n === 'flood' || (n === 'meteor' && !rainDue) || (n === 'jump' && !jumpDue) || (n === 'armL' && arms[0] < 1)
    || (n === 'armR' && arms[1] < 1) || (n === 'summon' && !slimesDue) || (n === 'squirtle' && !squirtlesDue)));
}

// The flood: { phase: 'dry' | 'surge' | 'high' | 'drain', t (s into the phase), k (0 dry .. 1 its
// height), front (0 .. 1: how far across the bowl its front has come), side (0..3: where it comes
// in from, cubegen/arenashapes.js floodBox) }. One step of dt; returns what started, or null.
export const newFlood = () => ({ phase: 'dry', t: 0, k: 0, front: 0, side: 0 });
export function stepFlood(w, dt) {
  const T = SLOMO_FIGHT.flood;
  w.t += dt;
  if (w.phase === 'surge') {
    w.k = 1;
    w.front = Math.min(1, w.front + dt / T.surge);
    if (w.front >= 1) { w.phase = 'high'; w.t = 0; return 'high'; }
  } else if (w.phase === 'high') {
    if (w.t >= T.high) { w.phase = 'drain'; w.t = 0; return 'drain'; }
  } else if (w.phase === 'drain') {
    w.k = Math.max(0, w.k - dt / T.drain);
    if (w.k <= 0) { Object.assign(w, { phase: 'dry', t: 0, front: 0 }); return 'dry'; }
  }
  return null;
}
// the flood called, from side `side` (another than the last one, r in 0..1)
export function raiseFlood(w, r = Math.random()) {
  const side = (w.side + 1 + Math.floor(r * 3)) % 4;
  Object.assign(w, { phase: 'surge', t: 0, k: 1, front: 0, side });
  return side;
}
// let it drain (his death), from wherever it stands
export function drainFlood(w) { if (w.phase !== 'dry') Object.assign(w, { phase: 'drain', t: 0, front: 1 }); }
// the part of `box` ([x0, z0, x1, z1]) the flood has reached: from side `side` (0 +x, 1 -x, 2 +z,
// 3 -z: the side it comes in from, the way DIRS go) to `front` of the way across
export function floodBox(box, side, front) {
  const [x0, z0, x1, z1] = box, u = Math.min(1, Math.max(0, front));
  if (side === 0) return [x1 - (x1 - x0) * u, z0, x1, z1];
  if (side === 1) return [x0, z0, x0 + (x1 - x0) * u, z1];
  if (side === 2) return [x0, z1 - (z1 - z0) * u, x1, z1];
  return [x0, z0, x1, z0 + (z1 - z0) * u];
}

// The meteorites of one cast (an attack's `rain`: count, spread [least, most cells from the
// player], stagger s between them), as offsets from where the player stands when he spits them:
// the first right on them (a little off), the rest round them. seed: the same cast, the same rain.
export function rainOf(rain, seed) {
  const R = mulberry32(seed >>> 0), out = [], [lo, hi] = rain.spread;
  for (let i = 0; i < rain.count; i++) {
    const a = R() * Math.PI * 2, d = i === 0 ? R() * 0.5 : lo + R() * (hi - lo);
    out.push({ dx: Math.cos(a) * d, dz: Math.sin(a) * d, delay: i * rain.stagger });
  }
  return out;
}

// Jumping over his shockwaves (core/enemies.js SLOMO_JUMP `wave`, game/quakes.js): a ring's band,
// `width` deep, runs out at `speed`; whoever is on the ground when it rolls under them is thrown off
// their feet, one in the air is not. It is under a body of radius r for under = (width + 2 r) / speed
// s. A jump keeps the hero off the ground for air = 2 JUMP_V / GRAV s (0.57), so a jump started at
// most air - under before the band reaches them, and no later than when it does, clears it: `window`
// s to jump in. Of two rings `gap` s apart each can be cleared with a jump of its own however early
// or late in the first window one jumped, if one is down again before the second window opens:
// gap >= 2 air - under (`gap`). (One jump over both would need gap <= air - 2 under: far too tight.)
// He lands on his shadow, so the hero who got out of it stands just outside it (`near`): the first
// band reaches them `reach` s after he lands; `from` / `to`: their window to jump in, s from his
// landing (from < 0: as he comes down).
export function dodge(wave, near = 0, r = CHAR_R) {
  const air = 2 * JUMP_V / GRAV, under = (wave.width + 2 * r) / wave.speed, reach = Math.max(0, near) / wave.speed;
  return { air, under, window: air - under, gap: 2 * air - under, reach, from: reach + under - air, to: reach };
}
