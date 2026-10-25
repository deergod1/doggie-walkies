// The Slug (core/enemies.js SLUG): the slime marsh's own, very slow, a trail of slime behind it,
// slime balls that slow (core/status.js) what they hit; it lives only in the slime marsh.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SLUG, SPOTTED_SLUG, BLACK_SLUG, ENEMY_KINDS, blowOf } from '../src/core/enemies.js';
import { DEPTH_SPAWNS } from '../src/core/spawns.js';
import { enemyMire } from '../src/core/footing.js';

test('the Slug crawls slowly, leaves a trail and spits slime that slows only the body', () => {
  assert.ok(SLUG.chase < 1 && SLUG.wander < SLUG.chase, 'very slow');
  assert.ok(SLUG.slimeborn && SLUG.trail);
  assert.equal(SLUG.style, 'ranged');
  const blow = blowOf(SLUG, SLUG);
  assert.equal(blow.slow.source, 'slime');
  assert.ok(blow.slow.slow < 1 && blow.slow.time > 1 && !blow.slow.weapons, 'the body, not the weapon');
  // the Black slug's slime holds longer and harder
  assert.ok(blowOf(BLACK_SLUG, BLACK_SLUG).slow.slow < blow.slow.slow && blowOf(BLACK_SLUG, BLACK_SLUG).slow.time > blow.slow.time);
  assert.ok(BLACK_SLUG.chase < SLUG.chase && BLACK_SLUG.hp > SPOTTED_SLUG.hp && SPOTTED_SLUG.hp > SLUG.hp);
  // the marsh's slime does not hold its own
  assert.equal(enemyMire({ profile: SLUG, f: { top: 2, link: [] }, x: 0, z: 0 }, null, { props: 'slime', mire: 0.88 }), 1);
});

test('Slugs live only in the slime marsh', () => {
  const rows = DEPTH_SPAWNS.flatMap((d, depth) => d.roster.map(r => ({ ...r, depth })));
  const slugs = rows.filter(r => r.type === 'slug');
  assert.deepEqual(slugs.map(r => r.depth), [4, 5]);
  for (const r of slugs) {
    assert.deepEqual(r.where, ['slime']);
    for (const k of Object.keys(r.kinds)) assert.equal(ENEMY_KINDS[k].species, 'slug');
  }
});
