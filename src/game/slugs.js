import { state } from './state.js';
import { SLUG, makeEnemy } from '../core/enemies.js';
import { enemySpots } from './enemyspawn.js';
import { stepEnemies } from './enemyai.js';
import { removeEnemyViews } from '../render/enemies.js';

// the Slugs of a cube's roster (their slime balls are the shared AI's projectiles, their trail
// render/trails.js)
export let slugs = [];
export function resetSlugs() {
  removeEnemyViews(slugs);
  slugs = enemySpots(state.map, SLUG).filter(spot => !state.run.defeated.has(spot.id)).map((spot, i) => makeEnemy(spot, spot.kind ?? SLUG, i));
}
export function updateSlugs(dt) {
  stepEnemies(slugs, dt);
  slugs = slugs.filter(e => e.mode !== 'dead' || e.deadT < e.profile.corpseTime || (removeEnemyViews([e]), false));
}
export function detachSlugs() { const list = slugs; slugs = []; return list; }
