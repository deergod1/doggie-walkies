import { state } from './state.js';
import { FLIMMER, makeEnemy } from '../core/enemies.js';
import { enemySpots } from './enemyspawn.js';
import { stepEnemies } from './enemyai.js';
import { removeEnemyViews } from '../render/enemies.js';

// the Flimmers of a cube's roster, three to a troop (their beating is the shared AI's: a blow with
// `more` blows after it, game/enemyai.js; their blur render/flimmerview.js)
export let flimmers = [];
export function resetFlimmers() {
  removeEnemyViews(flimmers);
  flimmers = enemySpots(state.map, FLIMMER).filter(spot => !state.run.defeated.has(spot.id)).map((spot, i) => makeEnemy(spot, spot.kind ?? FLIMMER, i));
}
export function updateFlimmers(dt) {
  stepEnemies(flimmers, dt);
  flimmers = flimmers.filter(e => e.mode !== 'dead' || e.deadT < e.profile.corpseTime || (removeEnemyViews([e]), false));
}
export function detachFlimmers() { const list = flimmers; flimmers = []; return list; }
