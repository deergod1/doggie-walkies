// Swallowed by a Bolime (core/enemies.js BOLIME: an attack with an `engulf`). Its pounce comes down
// at the hit frame onto its shadow (a stomp beam, game/beams.js); a player under it then is caught
// (a blow with `engulf`: the Bolime's id) and is inside it from then on (player.engulfed):
//   - held inside its body, a little off its middle at most (`hold`), wading through its slime:
//     a strong slowing with `weapons` (core/status.js): moving and the weapon both slowed, but the
//     fight goes on (the sword reaches it from inside, as any blade in reach does)
//   - digested: every `bite` s a bite of `share` of its damage, through the armor alone (no
//     shield), with its poison if it has one
//   - breaking out: walking out fills the struggle (in `walk` s), every jump adds `jump` to it;
//     full, you burst out the way you walked with a little hop. A stagger or its death lets you
//     out too, and at `release` it spits you out anyway
// Coming out the slowing has no `weapons` any more: a moment's sticky walking, the weapon free.
// Nothing else changes: other enemies, fluids and falls go on as ever. A pounce that catches nobody
// skips to the spitting out (passEngulfers). Playing together, the game of the player it caught
// carries it out (as a grab: net/foes.js), after the Bolime as it is shown there; the game running
// the Bolimes only learns that it caught a friend (markEngulfing).
import { player, state, setStatus } from './state.js';
import { allEnemies } from './enemies.js';
import { attackOf, enemyName } from '../core/enemies.js';
import { slowFrom } from '../core/status.js';
import { canMove } from '../physics/canmove.js';
import { groundAt } from '../physics/collide.js';
import { STEP } from '../core/constants.js';
import { playerHurtFx } from './juice.js';
import { armorOnly } from './armor.js';
import { poisonPlayer } from './enemycombat.js';
import { takeDamage } from '../core/progression.js';
import { knockDown } from './ragdoll.js';
import { flash } from './hud.js';
import { sfx } from '../audio/sfx.js';
import { msg, tr } from '../i18n/i18n.js';
import { emit, soft, rand } from '../render/particles.js';

// the engulf spec of e's attack if it is still at it (attack `n`)
function engulfing(e, n) {
  const a = e && e.mode === 'attack' && e.attacks === n ? attackOf(e) : null;
  return a?.engulf && allEnemies().includes(e) ? a.engulf : null;
}
// what the inside of it does to the player: slowed, the weapon too
const inside = g => ({ time: 0.6, slow: g.slow, weapons: true, source: 'engulf' });   // (renewed every step: longer than a thaw)

// a blow with `engulf` (game/enemycombat.js hitPlayer): caught, if it still pounces
export function engulfPlayer(blow) {
  const e = allEnemies().find(x => x.id === blow.engulf), g = e && engulfing(e, e.attacks);
  if (!g || player.engulfed) return false;
  Object.assign(player, { engulfed: { e, attacks: e.attacks, blow, g, struggle: 0, bite: g.bite, ox: 0, oz: 0 },
    vx: 0, vy: 0, vz: 0, gust: null, climb: null, getUp: null });
  e.engulfing = player;
  player.slowed = slowFrom(inside(g));
  sfx('gulp', { at: player });
  setStatus(tr('{name} swallowed you! Jump to break free!', { name: enemyName(e.profile) }));
  splash(e, 14);
  return true;
}
// the Bolimes' game hears that one caught a friend (their stand-in, game/party.js): it holds on
export function markEngulfing(id, body) {
  const e = allEnemies().find(x => x.id === id);
  if (e && engulfing(e, e.attacks)) e.engulfing = body;
}

// every step while inside (game/update.js), before moving: the struggle, the bites, its end.
// Returns whether the jump key was taken (no jumping inside a Bolime: it is struggling)
export function tickEngulf(dt, dx, dz, jump) {
  const h = player.engulfed, e = h.e, g = engulfing(e, h.attacks);
  if (!g || player.hp <= 0) { release(h, false); return jump; }
  if (e.t >= g.release) { release(h, true); return jump; }   // spat out
  player.slowed = slowFrom(inside(g));
  const pushing = Math.min(1, Math.hypot(dx, dz));
  h.struggle += pushing * dt / g.walk + (jump ? g.jump : 0);
  if (jump) { sfx('drip', { at: player, pitch: 0.7 + Math.random() * 0.3, volume: 0.6 }); splash(e, 4); }
  if (pushing) { h.ox = dx; h.oz = dz; }
  if (h.struggle >= 1) { release(h, false, true); return true; }   // burst out
  if ((h.bite -= dt) <= 0) { h.bite += g.bite; bite(h, g); }
  return true;
}
// after moving: still inside it (as far off its middle as `hold`), over the floor under it
export function holdInside() {
  const h = player.engulfed;
  if (!h) return;
  const e = h.e, r = h.g.hold * (e.profile.size ?? 1), dx = player.x - e.x, dz = player.z - e.z, d = Math.hypot(dx, dz);
  if (d > r) {
    const tx = e.x + dx / d * r - player.x, tz = e.z + dz / d * r - player.z;
    if (canMove(player.x + tx, player.z, 'x', Math.sign(tx))) player.x += tx;
    if (canMove(player.x, player.z + tz, 'z', Math.sign(tz))) player.z += tz;
  }
  const y = groundAt(player.x, player.z, e.y + STEP, STEP).h;
  if (Number.isFinite(y)) player.y = Math.max(player.y, y);
  player.vy = Math.min(player.vy, 0);
}

// a bite of it: its share of the blow through the armor alone, its poison too
function bite(h, g) {
  const b = armorOnly({ ...h.blow, damage: h.blow.damage * g.share, reason: g.reason ?? h.blow.reason }), p = player;
  const damage = Math.min(b.damage, p.hp);
  playerHurtFx(damage, h.e.x, h.e.z);
  sfx('gulp', { at: p, pitch: 1.3, volume: 0.5 });
  if (p.hp <= b.damage) { release(h, false); knockDown({ damage: b.damage, hop: 1, reason: b.reason, by: b.by }); return; }
  if (b.damage > 0) p.lastHurt = { reason: b.reason, by: b.by ?? null };
  takeDamage(p, b.damage, state.time); flash();
  if (b.toxin && !p.toxic) poisonPlayer(b.toxin, msg('Poisoned by a Bolime'), b.by ?? null);
}

// out: spat out (its release), burst out (the struggle full: the way you pushed) or let go (it is
// staggered, dead, or you went down); a little hop out of it, a moment's sticky walking
function release(h, spat, burst = false) {
  const e = h.e, p = player;
  p.engulfed = null;
  if (e.engulfing === p) e.engulfing = null;
  const yaw = spat ? e.yaw : Math.atan2(h.ox, h.oz), l = Math.hypot(h.ox, h.oz), speed = spat ? 3.2 : burst ? 2.6 : 1.2;
  const [fx, fz] = spat || !l ? [Math.sin(e.yaw), Math.cos(e.yaw)] : [Math.sin(yaw), Math.cos(yaw)];
  p.vx = fx * speed; p.vz = fz * speed; p.vy = burst || spat ? 3.5 : 2; p.grounded = false;
  p.slowed = slowFrom({ time: 1, slow: 0.7, source: 'slime' });   // (the weapon free again)
  sfx('splorch', { at: p });
  splash(e, 20);
  if (burst) setStatus(tr('You broke free!'));
  // (a Bolime that let go spits out what is left, quickly)
  const a = e.mode === 'attack' && e.attacks === h.attacks ? attackOf(e) : null;
  if (a?.engulf && e.t < a.engulf.release) e.t = a.engulf.release;
}

// slime flying off it
const GOO = ['#d8ff9a', '#8ae048', '#3e7a2a'];
function splash(e, n) {
  const s = e.profile.size ?? 1;
  for (let i = 0; i < n; i++)
    emit(soft, e.x + rand(-0.4, 0.4) * s, e.y + rand(0.3, 1.2) * s, e.z + rand(-0.4, 0.4) * s,
      { v: [rand(-1.5, 1.5), rand(0.5, 2.5), rand(-1.5, 1.5)], life: rand(0.4, 0.7), size: rand(0.06, 0.12), color: GOO[i % 3],
        alpha: 0.9, gravity: 8, drag: 1 });
}

// the Bolimes the game runs, after they stepped (game/bolimes.js): one that came down on nobody
// spits out at once (skips its holding)
export function passEngulfers(list) {
  for (const e of list) {
    const a = e.mode === 'attack' ? attackOf(e) : null;
    if (!a?.engulf) { e.engulfing = null; continue; }
    if (e.t > a.hitAt + 0.25 && e.t < a.engulf.release && !e.engulfing) e.t = a.engulf.release;
  }
}
export const clearEngulf = () => { if (player.engulfed) player.engulfed = null; };
