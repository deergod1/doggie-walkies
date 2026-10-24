// Which of a cube's fixed lights each cell of its ground takes (render/lighthook.js walks only
// the point's cell's): the cube in cells of a unit, `cells` a side from `from` (a little round the
// cube), each with the lights whose reach comes into it, the strongest there first (by how bright
// each is at the cell's nearest point), `max` at most. lights: [{ x, z, reach, intensity }] ->
// Float32Array: per cell `max` indices into the lights, -1 after the last.
export function lightCells(lights, { cells, from, max }) {
  const out = new Float32Array(cells * cells * max).fill(-1);
  for (let cz = 0; cz < cells; cz++) for (let cx = 0; cx < cells; cx++) {
    const x0 = from + cx, z0 = from + cz, near = [];
    lights.forEach((l, i) => {
      const dx = Math.max(x0 - l.x, 0, l.x - x0 - 1), dz = Math.max(z0 - l.z, 0, l.z - z0 - 1), d2 = dx * dx + dz * dz;
      if (d2 < l.reach * l.reach) near.push({ i, w: l.intensity / Math.max(d2, 0.25) * (1 - Math.sqrt(d2) / l.reach) });
    });
    near.sort((a, b) => b.w - a.w || a.i - b.i);
    for (let k = 0; k < Math.min(max, near.length); k++) out[(cz * cells + cx) * max + k] = near[k].i;
  }
  return out;
}
