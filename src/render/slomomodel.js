import { loadEnemyModel } from './enemymodel.js';
export const slomoModel = loadEnemyModel('assets/slomo.glb', 1, {
  walk: 'SlomoOoze', attack: { armL: 'SlomoArmL', armR: 'SlomoArmR', meteor: 'SlomoMeteor', jump: 'SlomoJump', flood: 'SlomoFlood',
    meteorLegs: 'SlomoMeteorLegs', spit: 'SlomoSpit', summon: 'SlomoSummon', meteorSlug: 'SlomoMeteorSlug', floodSlug: 'SlomoFloodSlug' },
  death: 'SlomoDeath', gaits: { stride: 'SlomoStride', crawl: 'SlomoCrawl' }, props: ['SlomoArmSlug'],
});
