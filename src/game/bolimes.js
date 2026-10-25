import { state } from './state.js';
import { BOLIME, makeEnemy } from '../core/enemies.js';
import { enemySpots } from './enemyspawn.js';
import { stepEnemies } from './enemyai.js';
import { removeEnemyViews } from '../render/enemies.js';

// the Bolimes of a cube's roster (their pounce is the shared AI's ride and stomp shadow, what they
// swallow game/engulf.js)
export let bolimes = [];
export function resetBolimes() {
  removeEnemyViews(bolimes);
  bolimes = enemySpots(state.map, BOLIME).filter(spot => !state.run.defeated.has(spot.id)).map((spot, i) => makeEnemy(spot, spot.kind ?? BOLIME, i));
}
export function updateBolimes(dt) {
  stepEnemies(bolimes, dt);
  bolimes = bolimes.filter(e => e.mode !== 'dead' || e.deadT < e.profile.corpseTime || (removeEnemyViews([e]), false));
}
export function detachBolimes() { const list = bolimes; bolimes = []; return list; }
