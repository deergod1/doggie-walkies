// Walking saves have their own version and namespace; dungeon heroes/worlds are untouched.
// v2: the continuous world — positions are world coordinates, and the pair's memory
// (explored cells, named places, journal) persists with the walk.
import { createWalk, setControl, setStyle } from './simulation.js';
import { buildWorld, cellKey, STREET } from './world.js';
import { walkable, distance, ropePath, ropeLength, LEASH } from './navigation.js';
export const SAVE_KEY = 'doggie-walkies.prototype.v1';
const finite = (n, lo, hi) => Number.isFinite(n) && n >= lo && n <= hi;
const unique = a => [...new Set(a)];
const idString = v => typeof v === 'string' && v.length <= 80 && /^[\w:., -]+$/.test(v);
const cellString = v => typeof v === 'string' && /^-?\d{1,6},-?\d{1,6}$/.test(v);

export function packWalk(s) {
  const actor = a => ({ x: a.x, z: a.z, yaw: a.yaw, attributes: a.attributes, personality: a.personality,
    needs: a.needs, state: a.state, skills: a.skills, relationships: a.relationships });
  return { version: 2, seed: s.seed, control: s.control, style: s.style,
    dog: actor(s.dog), handler: actor(s.handler), metrics: s.metrics, discovered: s.discovered,
    memory: { places: s.memory.places, journal: s.journal, cells: [...s.memory.cells] },
    route: { target: s.route.target, dir: s.route.dir, legs: s.route.legs } };
}
export function restoreWalk(data) {
  if (!data || data.version !== 2 || !Number.isInteger(data.seed) || !finite(data.seed, 0, 0xffffffff)) return null;
  const s = createWalk(data.seed);
  // Positions are world coordinates: rebuild the window around the pair's midpoint first.
  const mid = { x: (data.dog?.x ?? 0) / 2 + (data.handler?.x ?? 0) / 2, z: (data.dog?.z ?? 0) / 2 + (data.handler?.z ?? 0) / 2 };
  if (!finite(mid.x, -1e7, 1e7) || !finite(mid.z, -1e7, 1e7)) return null;
  s.wx = mid.x; s.wz = mid.z; s.map = buildWorld(s.seed, mid.x, mid.z);
  for (const name of ['dog', 'handler']) {
    const src = data[name], actor = s[name];
    if (!src || !walkable(s.map, src, actor.radius)) return null;
    actor.x = src.x; actor.z = src.z; actor.yaw = finite(src.yaw, -1e6, 1e6) ? src.yaw : 0;
    for (const section of ['state', 'needs', 'personality', 'skills']) for (const field of Object.keys(actor[section])) {
      if (finite(src[section]?.[field], 0, 1)) actor[section][field] = src[section][field];
    }
    for (const field of Object.keys(actor.attributes)) {
      if (finite(src.attributes?.[field], 0.1, field === 'speed' ? 5 : 1)) actor.attributes[field] = src.attributes[field];
    }
    const other = name === 'dog' ? 'handler' : 'dog';
    if (finite(src.relationships?.[other]?.trust, 0, 1)) actor.relationships[other].trust = src.relationships[other].trust;
  }
  s.leash = ropePath(s.map, s.dog, s.handler);
  if (ropeLength(s.leash) > LEASH.length + LEASH.give + 1e-6 || distance(s.dog, s.handler) < s.dog.radius + s.handler.radius) return null;
  setControl(s, data.control); setStyle(s, data.style);
  s.discovered = unique(Array.isArray(data.discovered) ? data.discovered.filter(idString).slice(0, 20000) : []);
  const memory = data.memory ?? {};
  s.memory.places = {};
  if (memory.places && typeof memory.places === 'object') {
    for (const [id, p] of Object.entries(memory.places)) {
      if (idString(id) && /^place:/.test(id) && finite(p?.x, -1e7, 1e7) && finite(p?.z, -1e7, 1e7) && finite(p?.at, 0, 1e9)) {
        s.memory.places[id] = { x: p.x, z: p.z, at: p.at, ...(idString(p?.name) ? { name: p.name } : {}) };
      }
    }
  }
  s.journal = (Array.isArray(memory.journal) ? memory.journal : []).filter(e => e && finite(e.t, 0, 1e9)
    && (e.kind === 'place' ? idString(e.name) : e.kind === 'scent' ? idString(e.label) : false)).slice(-300);
  s.memory.cells = new Set((Array.isArray(memory.cells) ? memory.cells : []).filter(cellString).slice(0, 8000));
  for (const field of Object.keys(s.metrics)) if (finite(data.metrics?.[field], 0, 1e9)) s.metrics[field] = data.metrics[field];
  const route = data.route ?? {};
  if (route.target && walkable(s.map, route.target, 0.3) && route.dir && finite(route.dir.dx, -1, 1) && finite(route.dir.dz, -1, 1)) {
    s.route = { target: { x: route.target.x, z: route.target.z }, dir: { dx: route.dir.dx, dz: route.dir.dz }, legs: finite(route.legs, 0, 1e6) ? route.legs : 0 };
  } else {
    const gx = Math.round(mid.x / STREET) * STREET, gz = Math.round(mid.z / STREET) * STREET;
    s.route = { target: { x: gx + 1.3, z: gz + 0.9 }, dir: { dx: 0, dz: 1 }, legs: 0 };
  }
  s.memory.cells.add(cellKey(s.dog.x, s.dog.z)); s.memory.cells.add(cellKey(s.handler.x, s.handler.z));
  return s;
}
export function readSave(storage) {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw || raw.length > 2e6) return null;
    return restoreWalk(JSON.parse(raw));
  } catch { return null; }
}
export function writeSave(storage, state) {
  try { storage.setItem(SAVE_KEY, JSON.stringify(packWalk(state))); return true; } catch { return false; }
}
