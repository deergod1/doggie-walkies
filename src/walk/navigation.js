// Pure XZ navigation for a tethered pair. Rectangles are expanded by body/rope radius.
// Visibility graphs are cached per clearance; the two moving endpoints are added per query.
export const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const point = a => ({ x: a.x, z: a.z });
export const mix = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
export const pathLength = path => path.slice(1).reduce((sum, p, i) => sum + distance(path[i], p), 0);
const EPS = 0.0001;
const caches = new WeakMap();

function boxes(map, radius) {
  return map.obstacles.map(o => ({ minX: o.x - o.w / 2 - radius, maxX: o.x + o.w / 2 + radius,
    minZ: o.z - o.d / 2 - radius, maxZ: o.z + o.d / 2 + radius }));
}
const inside = (p, b) => p.x > b.minX && p.x < b.maxX && p.z > b.minZ && p.z < b.maxZ;
function intersects(a, b, box) {
  let lo = 0, hi = 1;
  for (const [axis, min, max] of [['x', box.minX, box.maxX], ['z', box.minZ, box.maxZ]]) {
    const d = b[axis] - a[axis];
    if (Math.abs(d) < 1e-10) { if (a[axis] <= min || a[axis] >= max) return false; }
    else {
      const t1 = (min - a[axis]) / d, t2 = (max - a[axis]) / d;
      lo = Math.max(lo, Math.min(t1, t2)); hi = Math.min(hi, Math.max(t1, t2));
      if (hi <= lo) return false;
    }
  }
  return hi > 0 && lo < 1;
}
const visible = (a, b, obstacles) => !obstacles.some(o => intersects(a, b, o));

function graph(map, radius) {
  let all = caches.get(map);
  if (!all) caches.set(map, all = new Map());
  if (all.has(radius)) return all.get(radius);
  const rects = boxes(map, radius), nodes = [], limit = map.half - radius;
  const cx = map.wx ?? 0, cz = map.wz ?? 0;
  for (const b of rects) for (const x of [b.minX - EPS, b.maxX + EPS]) for (const z of [b.minZ - EPS, b.maxZ + EPS]) {
    const p = { x, z };
    if (Math.abs(x - cx) < limit && Math.abs(z - cz) < limit && !rects.some(r => inside(p, r))) nodes.push(p);
  }
  const edges = nodes.map(() => []);
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    if (!visible(nodes[i], nodes[j], rects)) continue;
    const d = distance(nodes[i], nodes[j]); edges[i].push([j, d]); edges[j].push([i, d]);
  }
  const result = { rects, nodes, edges }; all.set(radius, result); return result;
}
export function walkable(map, p, radius = 0.3) {
  return Number.isFinite(p.x) && Number.isFinite(p.z)
    && Math.abs(p.x - (map.wx ?? 0)) < map.half - radius && Math.abs(p.z - (map.wz ?? 0)) < map.half - radius
    && !graph(map, radius).rects.some(b => inside(p, b));
}
export function clearSegment(map, a, b, radius = 0.3) {
  return walkable(map, a, radius) && walkable(map, b, radius) && visible(a, b, graph(map, radius).rects);
}

// null means unreachable; never pretend an obstructed straight line is a valid path.
export function findPath(map, from, to, radius = 0.3) {
  if (!walkable(map, from, radius) || !walkable(map, to, radius)) return null;
  const g = graph(map, radius);
  if (visible(from, to, g.rects)) return [point(from), point(to)];
  const nodes = [...g.nodes, point(from), point(to)], start = nodes.length - 2, end = start + 1;
  const edges = g.edges.map(e => [...e]); edges.push([], []);
  for (const at of [start, end]) for (let i = 0; i < start; i++) if (visible(nodes[at], nodes[i], g.rects)) {
    const d = distance(nodes[at], nodes[i]); edges[at].push([i, d]); edges[i].push([at, d]);
  }
  const costs = nodes.map(() => Infinity), prev = nodes.map(() => -1), done = new Set(); costs[start] = 0;
  while (true) {
    let at = -1, best = Infinity;
    for (let i = 0; i < nodes.length; i++) if (!done.has(i) && costs[i] < best) { best = costs[i]; at = i; }
    if (at < 0) return null;
    if (at === end) break;
    done.add(at);
    for (const [next, d] of edges[at]) if (costs[at] + d < costs[next]) { costs[next] = costs[at] + d; prev[next] = at; }
  }
  const path = [];
  for (let i = end; i !== -1; i = prev[i]) path.unshift(nodes[i]);
  return path;
}

export function toward(map, actor, target, step) {
  const path = findPath(map, actor, target, actor.radius);
  if (!path) return point(actor);
  // Stop at a corner for this tick: returning a point on the *next* segment would make
  // the swept pair solver see a straight chord cutting through the obstacle's corner.
  for (const next of path.slice(1)) {
    const d = distance(actor, next);
    if (d < 1e-9) continue;
    return mix(actor, next, Math.min(1, step / d));
  }
  return point(actor);
}

// Swept, axis-sliding movement. No tunnelling on a large timestep.
export function slide(map, actor, dx, dz) {
  const start = point(actor), want = { x: start.x + dx, z: start.z + dz }, r = actor.radius;
  if (clearSegment(map, start, want, r)) return want;
  let p = start;
  for (const delta of [{ x: dx, z: 0 }, { x: 0, z: dz }]) {
    const next = { x: p.x + delta.x, z: p.z + delta.z };
    if (clearSegment(map, p, next, r)) p = next;
  }
  return p;
}

export const LEASH = Object.freeze({ length: 2.7, give: 0.08, clearance: 0.08, heightDifference: 0.45 });
export function ropePath(map, dog, handler) { return findPath(map, dog, handler, LEASH.clearance); }
export const ropeLength = path => path ? Math.hypot(pathLength(path), LEASH.heightDifference) : Infinity;

// Keep only the feasible fraction of a proposed pair step. Swept collision checks and routed
// rope length both apply; nobody is teleported to repair a constraint after the fact.
export function constrainPair(map, dog, handler, dogNext, handlerNext) {
  const valid = (d, h) => clearSegment(map, dog, d, dog.radius) && clearSegment(map, handler, h, handler.radius)
    && distance(d, h) >= dog.radius + handler.radius
    && ropeLength(ropePath(map, d, h)) <= LEASH.length + LEASH.give;
  let d = dogNext, h = handlerNext, blocked = false;
  if (!valid(d, h)) {
    blocked = true;
    // Remove outward motion when taut, retaining lateral movement around the partner.
    const path = ropePath(map, dog, handler);
    if (path && ropeLength(path) > LEASH.length - 0.08) {
      const tangent = (a, b, next) => {
        const len = distance(a, b), ux = (b.x - a.x) / len, uz = (b.z - a.z) / len;
        const dx = next.x - a.x, dz = next.z - a.z, away = Math.min(0, dx * ux + dz * uz);
        return { x: next.x - ux * away, z: next.z - uz * away };
      };
      d = tangent(dog, path[1], d); h = tangent(handler, path.at(-2), h);
    }
    if (!valid(d, h)) {
      // A blocked leader must not freeze a follower who is already taking a safe step to
      // make room. Try those independent steps before clipping the simultaneous proposal.
      const dOnly = valid(d, handler), hOnly = valid(dog, h);
      if (dOnly || hOnly) {
        if (hOnly && (!dOnly || distance(handler, h) > distance(dog, d))) d = point(dog);
        else h = point(handler);
      }
    }
    if (!valid(d, h)) {
      let lo = 0, hi = 1;
      for (let i = 0; i < 14; i++) {
        const mid = (lo + hi) / 2;
        if (valid(mix(dog, d, mid), mix(handler, h, mid))) lo = mid; else hi = mid;
      }
      d = mix(dog, d, lo); h = mix(handler, h, lo);
    }
  }
  return { dog: d, handler: h, path: ropePath(map, d, h), blocked };
}
