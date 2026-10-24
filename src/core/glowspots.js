// Where a glowing prop's light comes from: the spots of its glowing geometry (its `_glow`
// material's triangles: a lantern's glass, a window, a fire's flames, a mushroom's gills).
// Now that every light casts a baked shadow (render/bake.js), a light at the prop's origin would
// sit inside the prop (a shed's walls, a tree's trunk, a furnace) and light nothing round it.
//
// The glowing triangles fall into pieces (those sharing corners), a big piece into parts of SPLIT
// (a toadstool's glowing gills, a ring wider than the stem in its middle); each one's centre (by
// area) is a spot; spots nearer than MERGE are one (the candles of a candelabra, the lantern's panes);
// a prop gives at most MAX (the lantern tree's lanterns), the nearest merged first. A spot then
// moves OUT along the way its glow faces on the whole: a ring of glowing gills faces down (its
// middle is inside the stem: the light goes under the cap), a window out of its wall, runes up
// off their stone; a lantern's glass faces every way and its light stays in it.
export const MERGE = 0.5;
export const MAX = 6;
export const OUT = 0.35;
export const SPLIT = 0.8;

// meshes: [{ pos: Float32Array (x, y, z per corner), index?: Uint16Array | Uint32Array }]
// -> [{ x, y, z, w }] (w: the glowing area the spot stands for), the biggest first; [] if none
export function glowSpots(meshes, { merge = MERGE, max = MAX } = {}) {
  const pieces = [];
  for (const { pos, index } of meshes) {
    const tris = (index ? index.length : pos.length / 3) / 3, at = k => index ? index[k] : k;
    // corners are one where they are in the same place (the exporters split them by face)
    const ids = new Map(), parent = [];
    const id = v => {
      const k = `${pos[v * 3].toFixed(3)},${pos[v * 3 + 1].toFixed(3)},${pos[v * 3 + 2].toFixed(3)}`;
      let i = ids.get(k);
      if (i === undefined) { ids.set(k, i = parent.length); parent.push(i); }
      return i;
    };
    const find = i => { while (parent[i] !== i) i = parent[i] = parent[parent[i]]; return i; };
    const corner = [];
    for (let t = 0; t < tris; t++) {
      const c = [id(at(t * 3)), id(at(t * 3 + 1)), id(at(t * 3 + 2))];
      corner.push(c);
      parent[find(c[1])] = find(c[0]); parent[find(c[2])] = find(c[0]);
    }
    const byRoot = new Map();
    for (let t = 0; t < tris; t++) {
      const [a, b, c] = [0, 1, 2].map(j => at(t * 3 + j) * 3);
      const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
      const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, area = Math.hypot(nx, ny, nz) / 2 + 1e-9;
      const cx = (pos[a] + pos[b] + pos[c]) / 3, cy = (pos[a + 1] + pos[b + 1] + pos[c + 1]) / 3, cz = (pos[a + 2] + pos[b + 2] + pos[c + 2]) / 3;
      const r = `${find(corner[t][0])}|${Math.floor(cx / SPLIT)},${Math.floor(cy / SPLIT)},${Math.floor(cz / SPLIT)}`;
      let s = byRoot.get(r);
      if (!s) byRoot.set(r, s = { x: 0, y: 0, z: 0, w: 0, nx: 0, ny: 0, nz: 0 });
      s.x += (pos[a] + pos[b] + pos[c]) / 3 * area; s.y += (pos[a + 1] + pos[b + 1] + pos[c + 1]) / 3 * area;
      s.z += (pos[a + 2] + pos[b + 2] + pos[c + 2]) / 3 * area; s.w += area;
      s.nx += nx / 2; s.ny += ny / 2; s.nz += nz / 2;   // (its facing, by area)
    }
    for (const s of byRoot.values()) pieces.push({ x: s.x / s.w, y: s.y / s.w, z: s.z / s.w, w: s.w, nx: s.nx, ny: s.ny, nz: s.nz });
  }
  // near pieces are one spot, then the nearest spots merged while there are too many
  const spots = [];
  const join = (a, b) => {
    const w = a.w + b.w;
    a.x = (a.x * a.w + b.x * b.w) / w; a.y = (a.y * a.w + b.y * b.w) / w; a.z = (a.z * a.w + b.z * b.w) / w; a.w = w;
    a.nx += b.nx; a.ny += b.ny; a.nz += b.nz;
  };
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  for (const p of pieces.sort((a, b) => b.w - a.w)) {
    const near = spots.find(s => dist(s, p) < merge);
    if (near) join(near, p); else spots.push({ ...p });
  }
  while (spots.length > max) {
    let best = null;
    for (let i = 0; i < spots.length; i++) for (let j = i + 1; j < spots.length; j++) {
      const d = dist(spots[i], spots[j]);
      if (!best || d < best.d) best = { i, j, d };
    }
    join(spots[best.i], spots[best.j]);
    spots.splice(best.j, 1);
  }
  // out along its facing (as much as its glow faces one way: 0..1 of OUT)
  return spots.sort((a, b) => b.w - a.w).map(({ x, y, z, w, nx, ny, nz }) =>
    ({ x: x + nx / w * OUT, y: y + ny / w * OUT, z: z + nz / w * OUT, w }));
}
