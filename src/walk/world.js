// Continuous coordinate-hashed world: every tree, scent, facade and named corner is a pure
// function of (seed, world position), like the original game's cube world. There is no map
// boundary or hand-off. Streets are a guaranteed-clear backbone; blocks hold hashed scenery.
// The simulation only keeps a window of this world materialized around the pair.
import { hash32, mulberry32 } from '../core/util.js';
import { msg } from '../i18n/i18n.js';
import { walkable } from './navigation.js';

export const STREET = 26;      // distance between street centerlines
export const ROAD = 3.2;       // guaranteed clear corridor half-width
export const LOT_FROM = 4;     // block interior starts this far from a street line
export const LOT_TO = 22;      // and ends this far before the next one
export const WINDOW = 46;      // materialized content radius around the pair
export const REBUILD_AT = 10;  // slide the window after moving this far from its center

export const SCENTS = [msg('A very interesting tree'), msg('Someone was here'), msg('News from the flower bed'), msg('A mysterious little trail')];
// Place names are data (msg), so a walk saved in German greets an English player in English.
export const PLACE_NAMES = [
  msg('Home corner'), msg('The Willow Bend'), msg("Baker's Row"), msg('Fountain Square'),
  msg('The Quiet Corner'), msg('Lamplight Lane'), msg('The Old Orchard Gate'),
  msg('Puddle Junction'), msg('The Sunny Side'), msg('Whistlestop Corner'), msg('The Long Way Round'),
];

export const cellKey = (x, z) => `${Math.floor(x / 8)},${Math.floor(z / 8)}`;
export const intersection = (gx, gz) => ({ x: gx * STREET, z: gz * STREET });
const cellRandom = (seed, x, z, salt = 0) => mulberry32(hash32((seed + salt * 0x9e3779b9) ^ Math.imul(x, 73856093) ^ Math.imul(z, 19349663)));
const nearLine = v => Math.abs(v - Math.round(v / STREET) * STREET);

// Named corners are remembered by the pair (and persisted): the seed of the future memory fog.
// The origin is always home.
export function placeAt(seed, gx, gz) {
  if (gx === 0 && gz === 0) return { id: 'place:0,0', name: PLACE_NAMES[0], home: true };
  const R = cellRandom(seed, gx, gz, 7);
  if (R() >= 0.2) return null;
  return { id: `place:${gx},${gz}`, name: PLACE_NAMES[1 + Math.floor(R() * (PLACE_NAMES.length - 1))] };
}

function blockContent(seed, bx, bz, out, add) {
  const R = cellRandom(seed, bx, bz);
  const x0 = bx * STREET, z0 = bz * STREET;
  const placesNear = [[bx, bz], [bx + 1, bz], [bx, bz + 1], [bx + 1, bz + 1]].filter(([gx, gz]) => placeAt(seed, gx, gz));
  const clearOfPlaces = (x, z, r) => placesNear.every(([gx, gz]) => Math.hypot(x - gx * STREET, z - gz * STREET) > r + 6.5);
  // One shop or house front per block, facing its street; plazas keep their corners open.
  if (R() < 0.62) {
    const edge = Math.floor(R() * 4);
    const pair = edge === 0 ? [[bx, bz], [bx, bz + 1]] : edge === 1 ? [[bx + 1, bz], [bx + 1, bz + 1]]
      : edge === 2 ? [[bx, bz], [bx + 1, bz]] : [[bx, bz + 1], [bx + 1, bz + 1]];
    if (!pair.some(([gx, gz]) => placeAt(seed, gx, gz))) {
      const length = 4.6 + R() * 2.6, depth = 3.4 + R() * 1.2, h = 2.5 + R() * 1.1;
      const along = 5.5 + R() * 5 + length / 2;
      const house = edge === 0 ? { axis: 'x', sign: -1, x: x0 + LOT_FROM + depth / 2, z: z0 + along, w: length, d: depth, h }
        : edge === 1 ? { axis: 'x', sign: 1, x: x0 + LOT_TO - depth / 2, z: z0 + along, w: length, d: depth, h }
        : edge === 2 ? { axis: 'z', sign: -1, x: x0 + along, z: z0 + LOT_FROM + depth / 2, w: length, d: depth, h }
        : { axis: 'z', sign: 1, x: x0 + along, z: z0 + LOT_TO - depth / 2, w: length, d: depth, h };
      house.color = Math.floor(R() * 4);
      if (add(house.x, house.z)) {
        out.houses.push(house);
        out.obstacles.push({ x: house.x, z: house.z, w: house.axis === 'x' ? house.d : house.w, d: house.axis === 'x' ? house.w : house.d, kind: 'house' });
      }
    }
  }
  // Trees on lots and verges, never pinching the street corridor or a plaza.
  const trees = Math.floor(R() * 4);
  for (let i = 0; i < trees; i++) {
    const x = x0 + LOT_FROM + 0.8 + R() * (LOT_TO - LOT_FROM - 1.6);
    const z = z0 + LOT_FROM + 0.8 + R() * (LOT_TO - LOT_FROM - 1.6);
    if (Math.min(nearLine(x), nearLine(z)) < ROAD + 1.15) continue;
    if (!clearOfPlaces(x, z, 0)) continue;
    if (out.houses.some(b => Math.abs(x - b.x) < (b.axis === 'x' ? b.d : b.w) / 2 + 1.2 && Math.abs(z - b.z) < (b.axis === 'x' ? b.w : b.d) / 2 + 1.2)) continue;
    const tree = { x, z, size: 0.8 + R() * 0.5, hue: R() };
    if (add(x, z)) { out.trees.push(tree); out.obstacles.push({ x, z, w: 0.65, d: 0.65, kind: 'tree' }); }
  }
  // Scents live at tree bases, nosed toward the street so they read from the sidewalk.
  out.trees.filter(t => t.x >= x0 && t.x <= x0 + STREET && t.z >= z0 && t.z <= z0 + STREET).forEach((t, i) => {
    const distX = nearLine(t.x), distZ = nearLine(t.z);
    const alongX = distX < distZ;
    const g = Math.round((alongX ? t.x : t.z) / STREET) * STREET;
    const v = alongX ? t.x : t.z;
    const off = Math.max(2.6, Math.min(Math.abs(v - g) - 1.5, 3.0)) * Math.sign(v - g || 1);
    const scent = alongX ? { x: g + off, z: t.z } : { x: t.x, z: g + off };
    if (!clearOfPlaces(scent.x, scent.z, 1) || !add(scent.x, scent.z)) return;
    scent.id = `scent:${bx},${bz}:${i}`; scent.label = SCENTS[Math.floor(R() * SCENTS.length)];
    out.scents.push(scent);
  });
  // Flower drifts on the verges.
  for (let i = 0, n = 2 + Math.floor(R() * 3); i < n; i++) {
    const vertical = R() < 0.5, g = (vertical ? bx : bz) * STREET, v = g + (R() < 0.5 ? -1 : 1) * (ROAD + 0.55);
    const along = (vertical ? bz : bx) * STREET + 3 + R() * 20;
    const flower = vertical ? { x: v, z: along, color: Math.floor(R() * 3) } : { x: along, z: v, color: Math.floor(R() * 3) };
    if (add(flower.x, flower.z)) out.flowers.push(flower);
  }
}

// Materialize the content within `radius` of (cx, cz). Pure: same inputs, same world.
export function buildWorld(seed, cx, cz, radius = WINDOW) {
  const out = { seed, wx: cx, wz: cz, half: radius + 14,
    palette: Math.floor(cellRandom(seed, Math.floor(cx / STREET), Math.floor(cz / STREET), 21)() * 3),
    obstacles: [], trees: [], houses: [], lamps: [], flowers: [], scents: [], places: [] };
  const limit = radius + 8, add = (x, z) => Math.hypot(x - cx, z - cz) <= limit;
  for (let gx = Math.floor((cx - limit) / STREET) - 1; gx * STREET <= cx + limit + STREET; gx++) {
    for (let gz = Math.floor((cz - limit) / STREET) - 1; gz * STREET <= cz + limit + STREET; gz++) {
      const place = placeAt(seed, gx, gz);
      if (place && add(gx * STREET, gz * STREET)) {
        out.places.push({ ...place, x: gx * STREET, z: gz * STREET });
        if (!place.home) out.obstacles.push({ x: gx * STREET, z: gz * STREET, w: 1.7, d: 1.7, kind: 'fountain' });
      }
      const R = cellRandom(seed, gx, gz, 13);
      if (!place && R() < 0.85) {
        const qx = R() < 0.5 ? -1 : 1, qz = R() < 0.5 ? -1 : 1, lx = gx * STREET + qx * (ROAD + 1.4), lz = gz * STREET + qz * (ROAD + 1.4);
        if (add(lx, lz)) { out.lamps.push({ x: lx, z: lz }); out.obstacles.push({ x: lx, z: lz, w: 0.2, d: 0.2, kind: 'lamp' }); }
      }
    }
  }
  const b0x = Math.floor((cx - limit - LOT_TO) / STREET), b1x = Math.floor((cx + limit) / STREET) + 1;
  const b0z = Math.floor((cz - limit - LOT_TO) / STREET), b1z = Math.floor((cz + limit) / STREET) + 1;
  for (let bx = b0x; bx <= b1x; bx++) for (let bz = b0z; bz <= b1z; bz++) blockContent(seed, bx, bz, out, add);
  // The home corner: an open plaza with one old oak (the one obstacle it needs room for).
  if (Math.hypot(cx, cz) <= limit) {
    out.obstacles.push({ x: 2.6, z: 2.6, w: 0.85, d: 0.85, kind: 'oak' });
    const welcome = [{ x: 5, z: 0 }, { x: 0, z: 5 }, { x: -5, z: 0 }, { x: 0, z: -5 }]
      .find(p => walkable(out, p, 0.36));
    if (welcome && !out.scents.some(s => s.id === 'scent:welcome')) out.scents.unshift({ ...welcome, id: 'scent:welcome', label: SCENTS[1] });
  }
  return out;
}
