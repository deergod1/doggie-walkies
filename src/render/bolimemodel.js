import { loadEnemyModel } from './enemymodel.js';
export const bolimeModel = loadEnemyModel('assets/bolime.glb', 1, { walk: 'BolimeHop', attack: { pounce: 'BolimePounce' }, death: 'BolimeDeath' });
