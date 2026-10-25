// The slime marsh's slime holds the feet (core/footing.js mireOf, its theme's `mire`): the player
// (physics/move.js) and the enemies that walk (game/enemyai.js) go a little slower on it, a jump
// off it no quicker; bridges and stairs, other themes and the slime's own creatures are not held.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { N, WALK_SPEED, RUN_SPEED } from '../src/core/constants.js';
import { flatMap } from './fixtures.js';
import { player } from '../src/game/state.js';
import { movePlayer, mired as playerMired, jumpPowers } from '../src/physics/move.js';
import { mireOf, surfaceAt, enemyMire } from '../src/core/footing.js';
import { themeById } from '../src/themes/depth.js';

const DT = 1 / 60, slime = themeById('slime');
function stand(biome, run = null) {
  const m = flatMap();
  m.biome = biome;
  const support = run ? { kind: 'bridge', run: { kind: 'bridge', style: 'plank' } } : m.floors[8 * N + 2];
  Object.assign(player, { x: 2.5, z: 8.5, y: 0, vx: 0, vy: 0, vz: 0, grounded: true, swimming: false,
    fluid: 0, support, stun: 0, coyote: 0, jumpBuf: 0, chilled: null, mire: 1 });
  return m;
}
const speed = () => Math.hypot(player.vx, player.vz);

test('the slime holds the feet: a little slower, only on its own ground', () => {
  assert.ok(slime.mire > 0.8 && slime.mire < 0.95, 'a tiny bit slower');
  assert.equal(surfaceAt({ top: 4, link: [] }, null, 'slime', 0, 0), 'slime');
  assert.equal(mireOf('slime', slime), slime.mire);
  for (const s of ['grass', 'mud', 'stone', 'wood']) assert.equal(mireOf(s, slime), 1);
  assert.equal(mireOf('slime', themeById('meadow')), 1);
});

test('the player walks and runs slower over slime, a jump off it is no faster', () => {
  for (const [run, top] of [[false, WALK_SPEED], [true, RUN_SPEED]]) {
    stand('slime');
    for (let i = 0; i < 90; i++) movePlayer(DT, 1, 0, run, false);
    assert.ok(Math.abs(speed() - top * slime.mire) < 1e-6, `${run ? 'runs' : 'walks'} at ${speed()}`);
    stand('meadow');
    for (let i = 0; i < 90; i++) movePlayer(DT, 1, 0, run, false);
    assert.ok(Math.abs(speed() - top) < 1e-6, 'elsewhere at full speed');
  }
  // on a bridge over the marsh: not held
  stand('slime', true);
  assert.equal(playerMired(player), 1);
  // in the air it keeps what it had underfoot
  stand('slime');
  assert.equal(playerMired(player), slime.mire);
  player.grounded = false;
  assert.equal(playerMired(player), slime.mire);
  // the jumps click to move plans with go by it too
  assert.ok(Math.abs(jumpPowers(player).run - RUN_SPEED * slime.mire) < 1e-9);
});

test('the slime holds the enemies that walk, not its own nor what floats', () => {
  const m = stand('slime'), f = m.floors[8 * N + 2], enemyMired = e => enemyMire(e, m, themeById(m.biome));
  const enemy = (profile, extra = {}) => ({ x: 2.5, z: 8.5, y: 0, f, profile, ...extra });
  assert.equal(enemyMired(enemy({})), slime.mire);
  assert.equal(enemyMired(enemy({ slimeborn: true })), 1);
  assert.equal(enemyMired(enemy({ hover: true })), 1);
  assert.equal(enemyMired(enemy({}, { riding: {} })), 1);
  assert.equal(enemyMire(enemy({}), m, themeById('meadow')), 1);
});
