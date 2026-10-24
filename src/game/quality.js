// The look the settings ask for (game/settings.js graphics), for the whole game:
//   full    every fixed light with its baked shadow (render/bake.js), up to CELL_MAX lights a
//           point (render/lighthook.js), the hero's lamp casting shadows (render/character.js),
//           the sun's shadow map at 2048
//   simple  for weak devices (phones, old laptops): no cube is baked (no bake on entering, none of
//           its memory, no shadow lookups in the shaders), every light shining without a shadow,
//           the six strongest a point at most, a lamp without shadows, the cube in three's shadow
//           map of the sun (1024) like everything else, half the motes in the air
// Changing it recompiles the lit shaders once (the lamp's shadow comes or goes).
import { graphics, onSettingsChange } from './settings.js';
import { setShadowsBaked } from '../render/bake.js';
import { BAKE, CELL_MAX } from '../render/lighthook.js';
import { setLampShadow } from '../render/character.js';
import { sun } from '../render/scene.js';
import { setMoteRate } from '../render/motes.js';

// learn: light.html#looks #looks-code (see learn/README.md)
export const LOOKS = {
  full: { baked: true, cells: CELL_MAX, lamp: true, sunMap: 2048, motes: 1 },
  simple: { baked: false, cells: 6, lamp: false, sunMap: 1024, motes: 0.5 },
};
let current = null;
// learn: light.html#looks-code (see learn/README.md)
function apply() {
  const g = graphics();
  if (g === current) return;
  current = g;
  const L = LOOKS[g];
  setShadowsBaked(L.baked);
  BAKE.uBakeK.value = L.cells;
  setLampShadow(L.lamp);
  if (sun.shadow.mapSize.x !== L.sunMap) {
    sun.shadow.mapSize.set(L.sunMap, L.sunMap);
    sun.shadow.map?.dispose(); sun.shadow.map = null;   // (three makes it anew at the new size)
  }
  setMoteRate(L.motes);
}
apply();
onSettingsChange(apply);
