import { loadEnemyModel } from './enemymodel.js';
export const slugModel = loadEnemyModel('assets/slug.glb', 1, { walk: 'SlugCrawl', attack: 'SlugSpit', death: 'SlugDeath', props: ['SlugBall'] });
