// Shockwaves (core/squarlo.js waveRadius, inWave): a giant's stomp and his landing after a jump
// (an attack's `wave`, core/enemies.js SQUARLO_GIANT) send one running out over the floor from
// where they struck: his foot (the stomp beam's muzzle), or under him. Read off each enemy's
// attack clock like the gusts (game/gusts.js): as it passes the hit frame every game starts the
// wave and shows it (render/giantfx.js), shaking the ground; only the game that runs the enemies
// hurts anyone with it (`hurt`). Whoever it rolls under is thrown off their feet, once a wave;
// one in the air (jumping over it), up a step from it, already down, or inside the shadow the
// blow itself came down on (the beam's: that one has had theirs) it passes by. A landing may send
// out several, one after another (`rings`, `gap` s apart: Slomo's, timed so each can be jumped
// over, core/slomo.js dodge), the later ones catching those in the shadow too; they run on after
// the attack is over.
import { player } from './state.js';
import { party, alive } from './party.js';
import { attackOf, waveBlowOf } from '../core/enemies.js';
import { muzzleAt } from '../core/beams.js';
import { waveRadius, waveOver, inWave } from '../core/squarlo.js';
import { groundAt } from '../physics/collide.js';
import { hitBody, attacker } from './enemycombat.js';
import { waveFx } from './juice.js';
import { drawWave, removeWave } from '../render/giantfx.js';

let waves = [];
export function updateQuakes(list, dt, hurt = true) {
  for (const e of list) {
    const a = e.mode === 'attack' ? attackOf(e) : null;
    if (!a?.wave || e.waved === e.attacks || e.t < a.hitAt) continue;
    e.waved = e.attacks;
    // (a landing that sends out more than one, Slomo's: `rings` of them, each `gap` s after the one
    // before, all from where he struck; a later one catches those in the shadow too)
    const at = muzzleAt(e, a.beam?.muzzle ?? [0, 0, 0]), g = groundAt(at.x, at.z, e.y + 0.6, 0);
    const blow = { ...waveBlowOf(e.profile, a), by: attacker(e) };
    e.rings = 0;
    for (let k = 0; k < (a.wave.rings ?? 1); k++)
      waves.push({ x: at.x, y: Number.isFinite(g.h) ? g.h : e.y, z: at.z, t: -k * (a.wave.gap ?? 0), spec: a.wave, inner: k ? 0 : a.beam?.radius ?? 0,
        blow, hit: new Set(), view: null, by: e });
  }
  waves = waves.filter(w => {
    const r0 = waveRadius(w);
    if (w.t <= 0 && w.t + dt > 0) { waveFx(w); w.by.rings = (w.by.rings ?? 0) + 1; }   // (it starts)
    w.t += dt;
    if (w.t <= 0) return true;
    if (hurt) for (const p of party()) {
      if (w.hit.has(p) || !alive(p) || (p !== player && !p.here) || p.ragdoll || p.held || p.grounded === false) continue;
      const dx = p.x - w.x, dz = p.z - w.z, d = Math.hypot(dx, dz);
      if (d < w.inner || !inWave(w, Math.max(0, r0), p)) continue;
      w.hit.add(p);
      hitBody(p, w.blow, w.x, w.z, d ? dx / d : 1, d ? dz / d : 0);
    }
    if (!waveOver(w)) return true;
    removeWave(w);
    return false;
  });
}
export function drawQuakes(dt, off) {
  for (const w of waves) if (w.t > 0) drawWave(w, waveRadius(w), Math.min(1, waveRadius(w) / w.spec.reach), dt, off);
}
export function clearQuakes() { waves.forEach(removeWave); waves = []; }
