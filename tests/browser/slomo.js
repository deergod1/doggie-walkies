// In devtools (?dev=1): await (await import('./tests/browser/slomo.js')).runSlomoChecks()
// Slomo's whole fight in his slime bowl (docs/bosses.md), always at night: phase 1 he throws his
// slug arms (they come to life where they land, crawl after the player, latch on and drop off dead;
// the arm grows a new slug) and spits meteorites that come down round the player; at two thirds
// he grows legs: he jumps up high onto the player (the landing sends out two shockwaves) and floods
// the bowl with slime from a side (never over the head, slowing, draining in 10 s); at a third the
// blob bursts and the slug fights on, spitting slime, calling Ooze slugs, Ooze bolimes (up to five)
// and Slime squirtles (up to two), still flooding; his death drains the flood and opens the well.
import { paused } from './combat.js';
import { state, player } from '../../src/game/state.js';
import { LH, HEAD_Y, JUMP_V } from '../../src/core/constants.js';
import { damageEnemy } from '../../src/core/combat.js';
import { allEnemies, updateEnemies } from '../../src/game/enemies.js';
import { updatePlayer } from '../../src/game/update.js';
import { updateMeteors, meteorsNow } from '../../src/game/meteors.js';
import { projectiles } from '../../src/game/projectiles.js';
import { goBoss } from '../../src/game/dev.js';
import { spawnAt } from '../../src/game/flow.js';
import { skyOf } from '../../src/game/daycycle.js';
import { loadSpecies } from '../../src/render/enemies.js';
import { standingAt, tideFluid } from '../../src/physics/fluid.js';
import { floorY } from '../../src/core/surfaces.js';
import { gateLocked } from '../../src/core/guardians.js';
import { SLOMO_FIGHT, dodge } from '../../src/core/slomo.js';

const check = (value, message) => { if (!value) throw Error(message); };
const step = (dt, also) => { updatePlayer(dt); updateEnemies(dt); updateMeteors(dt); also(); };
const run = (seconds, also = () => {}, dt = 1 / 30) => { for (let t = 0; t < seconds; t += dt) step(dt, also); };
const until = (seconds, done, also = () => {}, dt = 1 / 30) => {
  for (let t = 0; t < seconds; t += dt) { step(dt, also); if (done()) return t; }
  return Infinity;
};
const boss = () => allEnemies().find(e => e.boss === 'slomo');
const living = type => allEnemies().filter(e => e.type === type && e.mode !== 'dead' && e.mode !== 'gone');
const tough = () => { player.hp = player.maxHp = 1e6; player.ragdoll = null; };
// stand on the basin's floor about d cells from him
function standNear(b, d) {
  const low = Math.min(...state.map.floors.filter(f => f.encounter).map(f => f.top));
  const f = state.map.floors.filter(g => g.encounter && g.top === low)
    .sort((p, q) => Math.abs(Math.hypot(p.x + .5 - b.x, p.z + .5 - b.z) - d) - Math.abs(Math.hypot(q.x + .5 - b.x, q.z + .5 - b.z) - d))[0];
  spawnAt(f.x + .5, floorY(f, .5, .5), f.z + .5);
  return f;
}

export async function runSlomoChecks() {
  return paused(async () => {
    const out = [];
    await goBoss('slomo');
    await loadSpecies(['slomo', 'slug', 'bolime', 'squirtle']);
    const map = state.map, b = boss();
    check(map.arena.type === 'bowl' && map.tide?.flood && b, 'his slime bowl, and him in it');
    check(skyOf(map) === 'midnight', 'always night in his bowl');
    tough(); state.enemyGrace = 0;
    // coming close to his post wakes him (game/defence.js); then he fights on wherever the player goes
    standNear(b, 3.5);
    check(until(3, () => b.mode === 'chase' || b.mode === 'attack', tough) < 3, 'he wakes as the player comes close');
    check(until(8, () => b.attacks > 0, tough) < 8, 'and strikes');
    const basin = standNear(b, 5);
    // phase 1: slug arms thrown (coming to life, latching on), meteorites round the player
    let threw = false, armless = false, crawled = false, latched = false, bitten = false, rained = false;
    run(30, () => {
      tough();
      if (projectiles.some(p => p.kind === 'slugarm')) threw = true;
      if (b.arms.some(a => a < 1)) armless = true;
      if (living('armslug').some(m => m.mode === 'chase')) crawled = true;
      if (living('armslug').some(m => m.mode === 'split')) latched = true;
      if (/Arm slug/.test(player.lastHurt?.reason ?? '')) bitten = true;
      if (meteorsNow().some(m => m.blow && Math.hypot(m.at.x - player.x, m.at.z - player.z) < 4.5)) rained = true;
      if (Math.hypot(player.x - b.x, player.z - b.z) > 7) standNear(b, 5);
    });
    check(threw && armless, 'he throws his slug arms');
    check(crawled, 'a thrown slug comes to life and crawls after the player');
    check(latched && bitten, 'it latches on and bites');
    check(rained, 'his meteorites come down round the player');
    const low = [false, false];
    const grew = until(12, () => b.arms.some((a, i) => (low[i] ||= a < 0.5) && a === 1), tough);
    check(grew < 12, 'a slug arm he threw grows back: ' + b.arms);
    out.push('phase 1: slug arms thrown, latched on, grown back; meteorites');
    // two thirds: he grows legs (nothing hurts him meanwhile)
    damageEnemy(b, b.hp);
    check(b.hp === b.hpFloor && b.hp === Math.ceil(b.profile.hp * 2 / 3), 'no blow takes him below two thirds');
    run(0.5, tough);
    const hp = b.hp;
    damageEnemy(b, 50);
    check(b.mode === 'split' && b.hp === hp, 'nothing hurts him while he changes');
    until(SLOMO_FIGHT.morphTime + 1, () => b.stage === 2, tough);
    check(b.stage === 2 && b.profile.type === 'slomolegs', 'on legs');
    // his flood: from a side, across the bowl, never over the head, slowing; then 10 s to drain
    const floor = basin.top * LH;   // (the basin's floor, flat)
    let partial = false, high = -Infinity, slowed = false;
    const came = until(30, () => b.front >= 1, () => {
      tough(); standNear(b, 5);
      const t = tideFluid();
      if (t && b.front > 0.2 && b.front < 0.8) {
        const [x0, z0, x1, z1] = t.box;
        partial ||= (x1 - x0) < 11 || (z1 - z0) < 11;
      }
    });
    check(came < 30, 'he floods the bowl');
    check(partial, 'it comes in from a side');
    run(1, () => { tough(); high = Math.max(high, (state.tide ?? -Infinity) * LH); if (player.slowed) slowed = true; });
    check(high - floor > 0.2 && high - floor < HEAD_Y - 0.15, `it stands over the basin, under the head: ${(high - floor).toFixed(2)}`);
    check(standingAt(basin.x + .5, basin.z + .5) === tideFluid(), 'the basin is in it');
    check(slowed, 'its slime slows the player');
    const drained = until(20, () => state.tide === null, tough);
    check(drained > SLOMO_FIGHT.flood.drain - 2 && drained < SLOMO_FIGHT.flood.drain + SLOMO_FIGHT.flood.high + 2, 'it drains in about 10 s: ' + drained.toFixed(1));
    out.push(`flood from side ${b.floodSide}, ${(high - floor).toFixed(2)} deep, drained in ${drained.toFixed(1)} s`);
    // his jump: up high, down on the player, two shockwaves
    let top = 0;
    let leap = -1;
    const jumped = until(25, () => leap === b.attacks && b.rings === 2, () => {
      tough(); top = Math.max(top, b.y - floor);
      if (b.y - floor > 6) leap = b.attacks;
    });
    check(jumped < 25 && top > 6, `he jumps up high (${top.toFixed(1)}) and lands with two shockwaves`);
    out.push(`jump: ${top.toFixed(1)} cells up`);
    // dodging it: out of his shadow as it holds still, a jump as he comes down and another a second
    // later (core/slomo.js dodge); standing still the shockwave throws one off one's feet
    const J = b.profile.attacks.find(a => a.jump), D = dodge(J.wave, J.beam.radius);
    for (const jumping of [true, false]) {
      let out_ = false, jumps = 0, thrown = false, squashed = false, landed = -1;
      player.lastHurt = null;
      const due = [D.from + D.to, J.wave.gap * 2 + D.from + D.to].map(t => t / 2);   // (s from his landing: the middles of the windows)
      const done = until(30, () => landed > J.wave.gap + 1.5, () => {
        player.hp = player.maxHp = 1e6;
        const a = b.mode === 'attack' && b.profile.attacks[b.attack];
        if (landed >= 0) landed += 1 / 30;
        else if (a?.jump) {
          if (!out_ && b.beam && b.t >= J.hitAt - J.beam.lock) {   // out of the shadow, beside it
            out_ = true;
            const away = state.map.floors.filter(f => f.encounter && Math.abs(Math.hypot(f.x + .5 - b.beam.ax, f.z + .5 - b.beam.az) - (J.beam.radius + 0.5)) < 0.5)[0];
            spawnAt(away.x + .5, floorY(away, .5, .5), away.z + .5);
          }
          if (b.t >= J.hitAt) landed = b.t - J.hitAt;
        }
        // jump as he lands, and again as the second ring comes
        if (jumping && landed >= 0 && jumps < 2 && landed >= due[jumps] && player.grounded) { player.vy = JUMP_V; player.grounded = false; jumps++; }
        if (/shockwave/.test(player.lastHurt?.reason ?? '')) thrown = true;
        if (/Squashed/.test(player.lastHurt?.reason ?? '')) squashed = true;
      });
      check(done < 30 && out_ && !squashed, 'out of his shadow before he lands');
      if (jumping) check(jumps === 2 && !thrown, `jumping over both rings: not thrown (${jumps} jumps)`);
      else check(thrown, 'standing still: thrown off one\'s feet');
      player.ragdoll = null;
    }
    out.push(`jumped over both shockwaves (window ${D.window.toFixed(2)} s, rings ${J.wave.gap} s apart)`);
    // a third: the blob bursts, the slug fights on
    damageEnemy(b, b.hp);
    check(b.hp === Math.ceil(b.profile.hp / 3), 'no blow takes him below a third');
    until(SLOMO_FIGHT.morphTime + 1, () => b.stage === 3, tough);
    check(b.stage === 3 && b.profile.type === 'slomoslug', 'the slug');
    let spat = false, slimes = 0, squirtles = 0, floods = new Set([b.floodSide]);
    run(40, () => {
      tough();
      if (Math.hypot(player.x - b.x, player.z - b.z) > 8) standNear(b, 5);
      if (projectiles.some(p => p.kind === 'slimeball' && p.profile?.type === 'slomoslug')) spat = true;
      slimes = Math.max(slimes, living('oozeslug').length + living('oozebolime').length);
      squirtles = Math.max(squirtles, living('slimesquirtle').length);
      if (b.front > 0) floods.add(b.floodSide);
    });
    check(spat, 'he spits slime');
    check(slimes > 0 && slimes <= SLOMO_FIGHT.minions.slimes, 'he calls slimes, five at most: ' + slimes);
    check(squirtles > 0 && squirtles <= SLOMO_FIGHT.minions.squirtles, 'and Slime squirtles, two at most: ' + squirtles);
    check(floods.size >= 2, 'he floods again, from another side');
    out.push(`phase 3: up to ${slimes} slimes, ${squirtles} squirtles, floods from ${floods.size} sides (${[...floods]})`);
    // his death takes his minions along, drains the flood and opens the well
    until(10, () => b.mode === 'dead', () => { tough(); if (b.mode !== 'split' && b.mode !== 'dead') damageEnemy(b, b.hp); });
    check(b.mode === 'dead', 'he dies');
    const trace = [];
    for (let i = 0; i < 12; i++) { run(1, tough); trace.push(`${state.cubeKey} ${b.deadT?.toFixed(1)} ${b.tide?.toFixed(2)} ${allEnemies().includes(b)}`); }
    check(!allEnemies().some(e => e !== b && e.mode !== 'dead' && e.mode !== 'gone'), 'his minions go with him');
    check(state.tide === null, `the flood is gone: ${state.tide} [${trace.join(' | ')}] (${allEnemies().map(e => `${e.type} ${e.mode} ${e.tide}`).join(', ')})`);
    check(!gateLocked(map, state.run), 'the well is open');
    out.push('dead: minions gone, flood drained, well open');
    return out;
  });
}
