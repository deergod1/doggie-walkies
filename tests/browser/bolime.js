// In devtools (?dev=1): await (await import('./tests/browser/bolime.js')).runBolimeChecks()
// The Bolime (core/enemies.js BOLIME) in the enemies' test room: its pounce comes down where its
// shadow lies and swallows the player under it (game/engulf.js): inside it, slowed, the weapon
// too, digested a bite at a time; jumping breaks out sooner than walking out; at its release it
// spits you out; out of it the weapon is free again. A pounce that catches nobody skips its
// holding, and a Bolime killed while it holds you lets you out.
import { paused } from './combat.js';
import { state, player } from '../../src/game/state.js';
import { updateEnemies } from '../../src/game/enemies.js';
import { updatePlayer } from '../../src/game/update.js';
import { goTestRoom, leaveTestRoom } from '../../src/game/dev.js';
import { spawnAt } from '../../src/game/flow.js';
import { spawnEnemies, clearEnemies } from '../../src/game/devspawn.js';
import { loadSpecies } from '../../src/render/enemies.js';
import { controls } from '../../src/game/inputstate.js';
import { groundY } from '../../src/physics/enemynav.js';
import { weaponFactor, moveFactor } from '../../src/core/status.js';
import { idx } from '../../src/core/util.js';

const check = (value, message) => { if (!value) throw Error(message); };
const step = (dt = 1 / 30) => { updatePlayer(dt); updateEnemies(dt); };
const run = (seconds, dt = 1 / 30, each = null) => { for (let t = 0; t < seconds; t += dt) { each?.(); step(dt); } };
// run until `done` (at most `limit` s): how long it took
function until(done, limit, each = null) {
  let t = 0;
  for (; t < limit && !done(); t += 1 / 30) { each?.(); step(); }
  return t;
}
function pounce(e) {
  const i = e.profile.attacks.findIndex(a => a.engulf), a = e.profile.attacks[i];
  Object.assign(e, { mode: 'attack', attack: i, t: 0, bit: false, attacks: e.attacks + 1, stun: 0, cool: 0 });
  return a;
}

export async function runBolimeChecks() {
  return paused(async () => {
    const hero = { ...player }, out = {};
    try {
      await goTestRoom('enemies', 5);
      await loadSpecies(['bolime']);
      clearEnemies();
      const map = state.map, x = 8.5, z = 6.5, f = map.cols[idx(Math.floor(x), Math.floor(z))].at(-1), low = groundY(f, x, z);
      // a Bolime two cells in front of the player, facing them
      const fresh = (type = 'bolime') => {
        clearEnemies();
        spawnAt(x, low, z); player.yaw = 0;
        Object.assign(player, { hp: player.maxHp, engulfed: null, slowed: null, ragdoll: null, toxic: null, stun: 0 });
        const [e] = spawnEnemies(type, { level: 5, at: { x, y: low, z: z + 2 } });
        Object.assign(e, { x, z: z + 2, y: low, yaw: Math.PI, mode: 'chase', cool: 9 });
        state.enemyGrace = 0;
        return e;
      };

      // the pounce: it comes down on the player and swallows them
      let e = fresh();
      const a = pounce(e), g = a.engulf;
      run(a.hitAt + 0.1);
      check(player.engulfed?.e === e, 'swallowed where it came down');
      check(Math.hypot(player.x - e.x, player.z - e.z) < 0.4, 'inside it');
      check(moveFactor(player) < 0.5 && weaponFactor(player) < 0.5, `slowed, the weapon too: ${JSON.stringify(player.slowed)} ${JSON.stringify(player.chilled)}`);
      // walking alone takes a while to get out (digested a bite at a time meanwhile); jumping as
      // well gets out sooner
      const hp = player.hp;
      let bitten = null;
      const walked = until(() => !player.engulfed, 6, () => { stick(0, 1); if (bitten === null && player.hp < hp) bitten = hp - player.hp; });
      stick(0, 0);
      check(bitten > 0, 'digested a bite at a time');
      out.bite = bitten;
      check(!player.engulfed && walked > g.walk * 0.8 && e.t < g.release + 0.05, `walked out after ${walked.toFixed(2)} s`);
      check(weaponFactor(player) === 1 && moveFactor(player) < 1, 'out: the weapon free, still a little sticky');
      e = fresh(); pounce(e); run(a.hitAt + 0.1);
      check(player.engulfed, 'swallowed again');
      let n = 0;
      const jumped = until(() => !player.engulfed, 6, () => { stick(0, 1); if (n++ % 4 === 0) controls.jumpPressed = true; });
      stick(0, 0);
      check(!player.engulfed && jumped < walked * 0.75, `jumping out is quicker (${jumped.toFixed(2)} s against ${walked.toFixed(2)} s)`);
      out.escape = { walked, jumped };

      // left in there, it spits you out at its release
      e = fresh(); pounce(e); run(a.hitAt + 0.1);
      check(player.engulfed, 'swallowed for the last time');
      run(g.release - e.t + 0.1);
      check(!player.engulfed && player.hp > 0, 'spat out');

      // a pounce that catches nobody: it spits out what it has not got at once
      e = fresh(); pounce(e);
      run(0.2);
      player.x = x + 3; player.z = z - 1;
      run(a.hitAt + 0.2);
      check(!player.engulfed && e.t >= g.release, `missed: no holding (${!!player.engulfed}, ${e.t.toFixed(2)})`);

      // killed while it holds you: out
      e = fresh(); pounce(e); run(a.hitAt + 0.1);
      check(player.engulfed, 'swallowed before its end');
      e.hp = 0; e.mode = 'dead'; e.deadT = 0;
      step();
      check(!player.engulfed, 'out when it dies');
      out.ok = true;
      return out;
    } finally {
      clearEnemies();
      stick(0, 0);
      player.engulfed = null; player.slowed = null; player.ragdoll = null; player.toxic = null;
      await leaveTestRoom();
      Object.assign(player, hero);
    }
  });
}
function stick(sx, sy) { Object.assign(controls.stick, { x: sx, y: sy, m: sx || sy ? 1 : 0 }); }
