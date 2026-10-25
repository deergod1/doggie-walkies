// In devtools (?dev=1&theme=slime): await (await import('./tests/browser/meteors.js')).runMeteorChecks()
// Slime meteorites (game/meteors.js) in a slime marsh cube (act II): none by day; at the world's night
// their shadows show, they fall and land; one aimed at the player hits and slows them, one that
// lands on an enemy hurts it, and the splat it leaves slows whoever wades through it.
import { paused } from './combat.js';
import { state, player } from '../../src/game/state.js';
import { goHorde } from '../../src/game/dev.js';
import { clearEnemies, spawnEnemies } from '../../src/game/devspawn.js';
import { updateMeteors, meteorsNow, splatsNow, clearMeteors } from '../../src/game/meteors.js';
import { updateEnemies } from '../../src/game/enemies.js';
import { updatePlayer } from '../../src/game/update.js';
import { nightMeteors, METEOR } from '../../src/core/meteors.js';
import { DAY } from '../../src/core/daycycle.js';
import { themeOf } from '../../src/themes/depth.js';
import { moveFactor } from '../../src/core/status.js';
import { ceilingAt } from '../../src/physics/collide.js';
import { floorY } from '../../src/core/surfaces.js';

const check = (value, message) => { if (!value) throw Error(message); };

export async function runMeteorChecks() {
  await goHorde(state.cubes.layout.themes.find(s => s.theme.props === 'slime')?.at ?? 7);
  return paused(async () => {
    const hero = { ...player }, clock = state.run.clock, shift = state.dayShift, out = {};
    try {
      const theme = themeOf(state.map);
      check(theme.meteors && theme.sky === 'hazy', 'in the slime marsh');
      clearEnemies();
      const step = (dt = 1 / 30) => { state.run.clock += dt; updatePlayer(dt); updateEnemies(dt); updateMeteors(dt); };
      // (the time of day's clock is the world's play time: no dev shift meanwhile)
      const period = DAY.length, night = Math.floor(clock / period) + 1;
      state.dayShift = 0;
      // by day: none
      state.run.clock = night * period + 5;
      for (let i = 0; i < 60; i++) step();
      check(!meteorsNow().length, 'none by day');
      // at night: one aimed at the player comes down beside them
      const list = nightMeteors(state.map.seed, state.cubeKey, night), aimed = list.find(m => m.aimed);
      check(aimed, 'an aimed one tonight');
      // (out in the open, away from the portals: under the sky)
      const f = state.map.floors.find(g => !g.fluid && !g.kind && g.x > 5 && g.x < 11 && g.z > 5 && g.z < 11
        && state.map.cols[g.c].at(-1) === g && ceilingAt(g.x + 0.5, g.z + 0.5, floorY(g, 0.5, 0.5) + 0.2) === Infinity);
      check(f, 'a floor under the sky');
      const x = f.x + 0.5, z = f.z + 0.5;
      Object.assign(player, { x, z, y: floorY(f, 0.5, 0.5), vx: 0, vy: 0, vz: 0, grounded: true, support: f, hp: player.maxHp, slowed: null, chilled: null });
      state.run.clock = aimed.t - METEOR.warn + 0.01;
      step();
      const v = meteorsNow().find(s => s.m.id === aimed.id);
      check(v?.at && Math.hypot(v.at.x - x, v.at.z - z) <= METEOR.near + 0.01, 'its shadow beside the player');
      const hp = player.hp;
      for (let t = 0; t < METEOR.warn + 0.1; t += 1 / 30) { Object.assign(player, { x, z }); step(); }
      check(v.landed && player.hp < hp, 'it landed on the player');
      check(moveFactor(player) < 1, 'slowed');
      out.hit = hp - player.hp;
      check(splatsNow().length, 'a splat left');
      // another, onto an enemy: it hurts it
      const other = list.find(m => !m.aimed && m.t > aimed.t);
      state.run.clock = other.t - METEOR.warn + 0.01;
      step();
      const w = meteorsNow().find(s => s.m.id === other.id);
      if (w?.at) {
        const [e] = spawnEnemies('snake', { level: 4, at: { x: w.at.x, y: w.at.y, z: w.at.z } });
        Object.assign(e, { x: w.at.x, z: w.at.z, y: w.at.y, mode: 'idle', dormant: true });
        // (the player back on the floor under the sky, standing: off it they could fall out of the cube)
        Object.assign(player, { x, z, y: floorY(f, 0.5, 0.5), vx: 0, vy: 0, vz: 0, grounded: true, support: f });
        const before = e.hp;
        for (let t = 0; t < METEOR.warn + 0.1; t += 1 / 30) { Object.assign(e, { x: w.at.x, z: w.at.z }); step(); }
        check(e.hp < before, 'it hurt the enemy it landed on');
        out.enemy = before - e.hp;
      }
      out.ok = true;
      return out;
    } finally {
      clearEnemies(); clearMeteors();
      state.run.clock = clock; state.dayShift = shift;
      Object.assign(player, hero);
    }
  });
}
