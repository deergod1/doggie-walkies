// In devtools (?dev=1): await (await import('./tests/browser/flimmer.js')).runFlimmerChecks()
// The Flimmer (core/enemies.js FLIMMER) in the enemies' test room: /spawn brings a whole troop of
// three, each a blurry little figure (render/flimmerview.js: see-through copies of it, a shell and a
// haze) well below the hero; it comes into focus to beat the player, its five blows landing one
// after the other, the last one shoving them away; while it shimmers a sword blow may go right
// through it (the roll pinned: always, never), while it beats you never; killed, it dissolves and
// no body is left.
import { paused } from './combat.js';
import { state, player } from '../../src/game/state.js';
import { updateEnemies, drawEnemies } from '../../src/game/enemies.js';
import { updatePlayer } from '../../src/game/update.js';
import { goTestRoom, leaveTestRoom } from '../../src/game/dev.js';
import { spawnAt } from '../../src/game/flow.js';
import { spawnEnemies, clearEnemies } from '../../src/game/devspawn.js';
import { rolls, hitWithSword } from '../../src/game/sword.js';
import { startSwing, cancelSwing } from '../../src/core/combat.js';
import { rigReady } from '../../src/render/figure.js';
import { groundY } from '../../src/physics/enemynav.js';
import { idx } from '../../src/core/util.js';
import { RENEW } from '../../src/core/enemies.js';

const check = (value, message) => { if (!value) throw Error(message); };
const step = (dt = 1 / 30) => { updatePlayer(dt); updateEnemies(dt); drawEnemies(dt); };
const run = (seconds, dt = 1 / 30, each = null) => { for (let t = 0; t < seconds; t += dt) { each?.(); step(dt); } };

export async function runFlimmerChecks() {
  return paused(async () => {
    const hero = { ...player }, evade = rolls.evade, out = {};
    try {
      await goTestRoom('enemies', 4);
      await rigReady;
      clearEnemies();
      const map = state.map, x = 8.5, z = 6.5, f = map.cols[idx(Math.floor(x), Math.floor(z))].at(-1), low = groundY(f, x, z);
      const heal = () => Object.assign(player, { hp: player.maxHp, ragdoll: null, stun: 0, vx: 0, vz: 0 });

      // a troop: three of one kind, each drawn blurry, well below the hero
      spawnAt(x, low, z); player.yaw = 0; heal();
      const troop = spawnEnemies('hazeflimmer', { level: 4, at: { x, y: low, z: z + 3 } });
      check(troop.length === 3 && troop.every(e => e.type === 'hazeflimmer'), `a troop of three: ${troop.map(e => e.type)}`);
      step();
      for (const e of troop) {
        const v = e.view;
        check(v?.flimmer && v.copies.length >= 3 && v.shell && v.haze, 'drawn as a Flimmer');
        check(e.profile.height < RENEW.height * 0.75, 'well below the hero');
        check(v.body.material.opacity < 0.8 && v.copies.some(c => c.mesh.visible), `blurry: ${v.body.material.opacity}`);
      }

      // its beating: in focus, five blows one after the other, the last one shoving the player away
      clearEnemies(); spawnAt(x, low, z); player.yaw = 0; heal();
      state.enemyGrace = 0;
      const [e] = spawnEnemies('flimmer', { level: 4, single: true, at: { x, y: low, z: z + 0.7 } });
      Object.assign(e, { x, z: z + 0.7, y: low, yaw: Math.PI, mode: 'attack', attack: 0, t: 0, bit: false, attacks: 1, cool: 0 });
      const a = e.profile.attacks[0], drops = [];
      let hp = player.hp;
      run(a.attackTime - 0.05, 1 / 60, () => {
        if (player.hp < hp) drops.push(hp - player.hp);
        hp = player.hp;
        player.x = x; player.z = z;   // (the player stands their ground)
      });
      check(drops.length === 5, `five blows: ${drops}`);
      check(drops[4] > drops[0], `the last one hardest: ${drops}`);
      check(e.view.focus > 0.8 && e.view.body.material.opacity > 0.9, `in focus while it beats you: ${e.view.focus.toFixed(2)}`);
      out.blows = drops;

      // a sword blow: through it while it shimmers (the roll pinned to always), landing in focus
      const swing = target => {
        cancelSwing(player, true);
        check(startSwing(player, Math.atan2(target.x - player.x, target.z - player.z)), 'a swing');
        player.sword.t = player.sword.stats.activeStart + 0.01;
        const before = target.hp;
        hitWithSword([target]);
        cancelSwing(player, true);
        return before - target.hp;
      };
      clearEnemies(); spawnAt(x, low, z); player.yaw = 0; heal();
      const [g] = spawnEnemies('flimmer', { level: 4, single: true, at: { x, y: low, z: z + 0.6 } });
      Object.assign(g, { x, z: z + 0.6, y: low, mode: 'chase', stun: 0 });
      rolls.evade = () => 0;
      check(swing(g) === 0 && g.flinch, 'shimmering: the blow went through it');
      Object.assign(g, { mode: 'attack', attack: 0, t: 0.2, bit: false, attacks: 2 });
      check(swing(g) > 0, 'beating you: in focus, every blow lands');
      Object.assign(g, { mode: 'chase', stun: 0 });
      rolls.evade = () => 0.99;
      check(swing(g) > 0, 'shimmering: most blows still land');

      // killed: it dissolves, nothing is left of it
      g.hp = 1; Object.assign(g, { mode: 'chase', stun: 0 });
      check(swing(g) > 0 && g.mode === 'dead', 'killed');
      run(g.profile.deathTime + 0.05);
      check(!g.view?.group.visible, 'dissolved');
      run(g.profile.corpseTime);
      check(!g.view, 'no body left');
      out.ok = true;
      return out;
    } finally {
      rolls.evade = evade;
      clearEnemies();
      cancelSwing(player, true);
      await leaveTestRoom();
      Object.assign(player, hero);
    }
  });
}
