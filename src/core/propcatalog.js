// Pure asset catalog shared by generation, placement and rendering. No GLTF/Three dependency.
// The catalog is complete from the start: every prop's metadata (tools/prop-metadata.mjs) is in
// it, so placement and colliders never wait for a download. Rendering loads a prop set's
// geometry when a cube needs it (render/props.js loadPropSets) and adds it to the entries.
import { PROP_METADATA } from './propmetadata.js';

// Focal props are placed by site recipes, not a uniform scatter draw. Asset priority is
// unrelated to reward prestige. Older architectural props also need deliberate placement, and so do
// landmarks and vignettes (assets/themes/: bigger than a cell) and string segments (attach 'line').
const SIGNATURES = new Set(['altar', 'broken_altar', 'ritual_circle', 'weapon_graveyard',
  'collapsed_arch', 'frozen_adventurer', 'adventurer_remains', 'abandoned_pack', 'old_campfire',
  'signpost', 'sword_in_ground', 'sarcophagus', 'statue', 'mine_rail', 'rail', 'support_frame']);
// How much clutter there is: a factor on every ambient scatter pass (render/propplace.js), on the
// guardian arenas' cover and loose things (cubegen/arenaprops.js) and on the town's ground cover
// (world/town.js). Authored set pieces are not affected.
export const CLUTTER = 0.75;
export const signatureProp = p => p.landmark || p.vignette || SIGNATURES.has(p.base) || /rail|frame/.test(p.base);
export const propMetadata = new Map(PROP_METADATA.map(p => [p.name, p]));
export const props = { byName: new Map(), sets: new Map() };

// the props that burn (by base name): their models' glowing spikes are drawn as flames, their
// light flickers with them (render/flames.js)
export const FIRES = new Set(['brazier', 'torch_sconce', 'tiki_torch', 'copal_bowl', 'fire_shrine', 'wall_brazier', 'oil_lamps',
  'temple_gate']);

// How the light of the older libraries' glowing props lives (the theme library's own say so in
// their `flicker`, assets/themes/manifest.json): 'flame' flickers like a fire (candles, lanterns,
// lamps), 'pulse' breathes slowly (crystals, runes, fungus, magma, the sea's glow). Fires flicker
// with their flames anyway (render/flames.js); the town's windows and the trials' parts stay still.
const words = s => s.split(' ');
export const FLICKER = Object.fromEntries([
  ...words('lantern hanging_lantern wall_lantern headframe hanging_censer luminaria crucible furnace butter_lamps chorten_great'
    + ' sang_burner wax_candles stone_lantern wall_shrine bone_chandelier bone_lantern candelabra candle_niche candle_stubs'
    + ' crypt_shrine witch_hut').map(b => [b, 'flame']),
  ...words('rune_stone ritual_circle void_crystal wall_runes chained_obelisk void_throne ice_crystal ice_throne crystal_cluster'
    + ' ore_vein giant_geode glow_mushroom mushroom_shelf spore_pod acid_foam fungal_tree swamp_lilies tiny_glowcaps'
    + ' giant_toadstool magma_rock cinders fire_crystal lava_crust lava_stalactite magma_seep fumarole glowworm_threads'
    + ' rainbow_crystal storm_jar gauge_panel slag_bits slag_raft anemone coral_wall giant_clam giant_shell glow_strands'
    + ' jelly_lantern jellyfish sea_glass comb_mound comb_tower royal_cell wall_comb glow_spores glow_eggs pale_fungus'
    + ' dew_web glow_silk glyph_stone').map(b => [b, 'pulse']),
]);

// a prop's catalog entry from its metadata: the extras the exporters may leave out get their defaults
export const catalogEntry = m => ({ attach: 'ground', radius: 0.3, intensity: 1, sway: 0, priority: 1, drop: 0, ...m,
  blocking: !!m.blocking, cover: !!m.cover, shore: !!m.shore,
  ...(m.light && !m.flicker && FLICKER[m.base] ? { flicker: FLICKER[m.base] } : {}) });

// add an entry, or replace one in its place (placement draws from the sets in their order)
export function catalogProp(p) {
  const old = props.byName.get(p.name), key = p.set + '/' + p.attach;
  props.byName.set(p.name, p);
  if (old) {
    const list = props.sets.get(old.set + '/' + old.attach), i = list.indexOf(old);
    if (old.set + '/' + old.attach === key) { list[i] = p; return; }
    list.splice(i, 1);
  }
  if (!props.sets.has(key)) props.sets.set(key, []);
  props.sets.get(key).push(p);
}

for (const m of PROP_METADATA) catalogProp(catalogEntry(m));
