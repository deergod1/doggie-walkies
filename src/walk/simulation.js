// Pure fixed-step walking simulation over a continuous coordinate-hashed world. No DOM,
// rendering, dungeon player singleton or network. The pair's shared memory (explored cells,
// named places, journal) is part of the state and persists: it is the substrate of the
// future memory fog — what the dog and person know is what the world has shown them.
import { clamp, hash32, mulberry32 } from '../core/util.js';
import { msg } from '../i18n/i18n.js';
import { createActor, updateNeeds, pace } from './characters.js';
import { buildWorld, cellKey, STREET, REBUILD_AT } from './world.js';
import { distance, point, mix, toward, slide, findPath, ropePath, ropeLength, constrainPair, LEASH } from './navigation.js';

export function createWalk(seed = 2026) {
  const dog = createActor('dog', 'dog', 0.8, 2.4, true), handler = createActor('handler', 'person', -0.8, 3.8, true);
  dog.relationships.handler = { trust: 0.7 }; handler.relationships.dog = { trust: 0.7 };
  const s = { seed: seed >>> 0, wx: 0, wz: 0, map: buildWorld(seed, 0, 0), dog, handler, npcs: [], time: 0,
    control: 'handler', style: 'sniffari', resting: false, paused: false, clickGoal: null,
    sniff: null, sniffCooldown: 0, cooperateUntil: 0, waitingUntil: 0,
    tension: 0, disagreement: 0, stuck: 0, leash: [],
    route: { target: { x: 1.3, z: STREET + 0.9 }, dir: { dx: 0, dz: 1 }, legs: 0 },
    discovered: [], journal: [],
    memory: { places: { 'place:0,0': { x: 0, z: 0, at: 0, name: msg('Home corner') } }, cells: new Set() },
    metrics: { distance: 0, sniffs: 0, relaxed: 0 }, event: null, revision: 0 };
  for (const a of [dog, handler]) s.memory.cells.add(cellKey(a.x, a.z));
  const squirrel = createActor('squirrel', 'squirrel', 4.8, 4.8);
  squirrel.home = { x: 4.8, z: 4.8 }; squirrel.goal = { kind: 'forage', target: squirrel.home };
  const person = createActor('neighbor', 'person', 1.2, 10);
  person.goal = { kind: 'stroll', target: { x: 1.2, z: -10 } };
  s.npcs = [squirrel, person]; s.leash = ropePath(s.map, s.dog, s.handler); return s;
}
// The world is infinite; only a window around the pair is materialized. Content is a pure
// function of position, so sliding the window never changes what exists — new scenery only
// ever appears far ahead, never on top of the pair.
function ensureWindow(s) {
  const mid = { x: (s.dog.x + s.handler.x) / 2, z: (s.dog.z + s.handler.z) / 2 };
  if (distance(mid, { x: s.wx, z: s.wz }) < REBUILD_AT) return;
  s.wx = mid.x; s.wz = mid.z;
  s.map = buildWorld(s.seed, mid.x, mid.z);
  s.leash = ropePath(s.map, s.dog, s.handler); s.revision++;
  // Creatures live in the world, not at the spawn corner: relocate distant ones deterministically.
  const R = mulberry32(hash32(s.seed ^ Math.imul(Math.round(mid.x / 8), 73856093) ^ Math.imul(Math.round(mid.z / 8), 19349663)));
  const squirrel = s.npcs[0], person = s.npcs[1];
  if (distance(squirrel, mid) > 42) {
    const tree = s.map.trees[Math.floor(R() * s.map.trees.length)];
    Object.assign(squirrel, tree ? { x: tree.x + 0.8, z: tree.z + 0.8 } : { x: mid.x + 5, z: mid.z + 5 });
    squirrel.home = { x: squirrel.x, z: squirrel.z }; squirrel.goal = { kind: 'forage', target: squirrel.home };
  }
  if (distance(person, mid) > 42) {
    const gz = Math.round(mid.z / STREET) * STREET;
    Object.assign(person, { x: mid.x, z: gz + 8 });
    person.goal = { kind: 'stroll', target: { x: mid.x, z: gz - 8 } };
  }
}
export function setControl(s, mode) {
  if (!['dog', 'handler', 'auto'].includes(mode)) return;
  s.control = mode; s.clickGoal = null; s.stuck = 0;
}
export function setStyle(s, style) {
  if (!['sniffari', 'exercise'].includes(style)) return;
  s.style = style; s.dog.goal = null;
  s.dog.motivations.exercise = s.handler.motivations.exercise = style === 'exercise' ? 0.85 : 0.3;
  s.dog.motivations.explore = style === 'exercise' ? 0.45 : 0.9;
  s.handler.motivations.explore = style === 'exercise' ? 0.2 : 0.75;
}
export function setDestination(s, target) {
  const actor = s.control === 'handler' ? s.handler : s.dog;
  if (!findPath(s.map, actor, target, actor.radius)) return false;
  if (s.control === 'auto') setControl(s, 'dog');
  s.resting = false; s.clickGoal = point(target); return true;
}
export function together(s) {
  s.cooperateUntil = s.time + 7; s.sniffCooldown = s.time + 8;
  s.sniff = null; s.dog.goal = null; s.resting = false; s.event = 'together';
}
export function rest(s) { s.resting = !s.resting; s.clickGoal = null; }
export function nearbyScent(s) {
  return s.map.scents.filter(p => !s.discovered.includes(p.id) && distance(s.dog, p) < 1.2)
    .sort((a, b) => distance(s.dog, a) - distance(s.dog, b))[0] ?? null;
}
export function startSniff(s, scent = nearbyScent(s)) {
  if (!scent || s.sniff || distance(s.dog, scent) > 1.2 || s.discovered.includes(scent.id)) return false;
  s.sniff = { id: scent.id, label: scent.label, remaining: 3.2, duration: 3.2, target: point(scent) };
  s.dog.goal = { kind: 'sniff', target: point(scent), id: scent.id };
  s.waitingUntil = s.time + 4; s.clickGoal = null; s.event = 'sniff'; return true;
}
const intent = (actor, kind, target = null) => { actor.intent = { kind, target: target ? point(target) : null }; };
function follow(s, actor, other, stop = 1.35) {
  const path = findPath(s.map, actor, other, actor.radius);
  if (!path) {
    // A dog can stand slightly closer to a tree than a person. The follower needs a safe
    // nearby destination, not a path ending inside its own clearance envelope.
    const candidates = Array.from({ length: 12 }, (_, i) => ({ x: other.x + Math.cos(i * Math.PI / 6) * stop, z: other.z + Math.sin(i * Math.PI / 6) * stop }))
      .sort((a, b) => distance(actor, a) - distance(actor, b));
    const target = candidates.find(p => findPath(s.map, actor, p, actor.radius));
    intent(actor, target ? 'following' : 'waiting', target); return;
  }
  // Follow the first segment of a real path, but do not crowd the partner at its end.
  let remaining = path.slice(1).reduce((n, p, i) => n + distance(path[i], p), 0) - stop;
  if (remaining <= 0) { intent(actor, 'waiting'); return; }
  let target = point(actor);
  for (const next of path.slice(1)) {
    const d = distance(target, next);
    if (remaining <= d) { target = mix(target, next, remaining / d); break; }
    remaining -= d; target = next;
  }
  intent(actor, 'following', target);
}
function dogGoal(s) {
  const d = s.dog;
  if (s.sniff || s.time < s.sniffCooldown || s.time < s.cooperateUntil) return;
  if (d.goal?.kind === 'investigate' && distance(d, d.goal.target) < 7 && !s.discovered.includes(d.goal.id)) return;
  const range = s.style === 'sniffari' ? 4.8 : 2.4;
  const scored = s.map.scents.filter(p => !s.discovered.includes(p.id) && distance(d, p) < range && distance(s.handler, p) < 6)
    .map(p => ({ p, score: (d.personality.curiosity + d.needs.stimulation) * 3 - distance(d, p) }))
    .sort((a, b) => b.score - a.score);
  d.goal = scored[0]?.score > 0 ? { kind: 'investigate', id: scored[0].p.id, target: point(scored[0].p) } : null;
}
// The person's exercise route wanders from intersection to intersection, forever, with a
// deterministic preference for strolling straight on through the occasional turn.
function advanceRoute(s) {
  const route = s.route, h = s.handler;
  if (distance(h, route.target) >= 2.4) return;
  const R = mulberry32(hash32(s.seed ^ Math.imul(route.legs + 1, 2246822519)));
  if (route.legs > 0 && R() < 0.45) { const t = R() < 0.5 ? 1 : -1; route.dir = { dx: -route.dir.dz * t, dz: route.dir.dx * t }; }
  route.legs++;
  route.target = { x: route.target.x + route.dir.dx * STREET, z: route.target.z + route.dir.dz * STREET };
}
function chooseIntents(s, input) {
  const { dog: d, handler: h } = s;
  advanceRoute(s);
  h.goal = { kind: 'route', target: s.route.target };
  dogGoal(s);
  if (s.resting) { intent(d, 'resting'); intent(h, 'resting'); return; }
  const cooperating = s.time < s.cooperateUntil;
  if (s.sniff) intent(d, 'sniffing', s.sniff.target);
  else if (!cooperating && d.goal?.kind === 'investigate') intent(d, 'investigating', d.goal.target);
  else if (s.control === 'auto') intent(d, 'walking', h.goal.target);
  else follow(s, d, h, s.style === 'exercise' ? 0.95 : 1.45);

  if (s.control === 'auto' && !(s.style === 'sniffari' && (d.goal || s.sniff))) intent(h, 'walking', h.goal.target);
  else if (s.sniff && s.time < s.waitingUntil) intent(h, 'waiting');
  else follow(s, h, d, 1.4);

  // A handler-led exercise walk uses a close side position, not a dog directly behind.
  if (s.control === 'handler' && !s.sniff && (!d.goal || cooperating)) {
    const heel = { x: h.x + Math.cos(h.yaw) * 0.9, z: h.z - Math.sin(h.yaw) * 0.9 };
    if (findPath(s.map, d, heel, d.radius)) intent(d, 'heeling', heel);
  }
  // Persistence allows a little disagreement, then the un-driven partner compromises.
  // This isn't an automatic control switch. The player can also explicitly invite cooperation.
  if (s.stuck > 0.8 + (s.control === 'handler' ? d : h).personality.persistence * 2 && !s.sniff) {
    if (s.control === 'handler' || (s.control === 'auto' && s.style === 'exercise')) {
      d.goal = null; s.sniffCooldown = s.time + 3; follow(s, d, h, 1.1);
    } else follow(s, h, d, 1.25);
  }
  if (s.control !== 'auto') {
    const active = s.control === 'handler' ? h : d;
    if (input.x || input.z) {
      s.clickGoal = null;
      if (active === d && s.sniff) { s.sniff = null; s.sniffCooldown = s.time + 2; }
      intent(active, 'driving');
    } else if (s.clickGoal) {
      if (distance(active, s.clickGoal) < 0.2) s.clickGoal = null;
      intent(active, s.clickGoal ? 'walking' : 'waiting', s.clickGoal);
    } else if (active !== d || !s.sniff) intent(active, 'waiting');
  }
}
function propose(s, actor, dt, input) {
  const speed = pace(actor, s.style), active = s.control === actor.id;
  if (active && (input.x || input.z) && !s.resting) {
    const length = Math.hypot(input.x, input.z);
    return slide(s.map, actor, input.x / Math.max(1, length) * speed * dt, input.z / Math.max(1, length) * speed * dt);
  }
  if (!actor.intent.target || ['sniffing', 'waiting', 'resting'].includes(actor.intent.kind)) return point(actor);
  return toward(s.map, actor, actor.intent.target, speed * dt);
}
function giveRoom(s, follower, leader, leaderNext, followerNext, dt) {
  const gap = distance(follower, leader), dx = leaderNext.x - leader.x, dz = leaderNext.z - leader.z;
  const step = Math.hypot(dx, dz);
  if (gap > 1.35 || gap < 1e-6 || step < 1e-6 || s.resting || (follower === s.dog && s.sniff)) return followerNext;
  const ux = dx / step, uz = dz / step, rx = (follower.x - leader.x) / gap, rz = (follower.z - leader.z) / gap;
  if (ux * rx + uz * rz < 0.3) return followerNext;
  const side = ux * rz - uz * rx >= 0 ? 1 : -1;
  for (const sign of [side, -side]) {
    const vx = rx * 0.75 - uz * sign, vz = rz * 0.75 + ux * sign, len = Math.hypot(vx, vz);
    const speed = pace(follower, s.style);
    const next = slide(s.map, follower, vx / len * speed * dt, vz / len * speed * dt);
    if (distance(follower, next) > 0.001) { intent(follower, 'makingRoom', next); return next; }
  }
  return followerNext;
}
function apply(actor, next, dt) {
  const dx = next.x - actor.x, dz = next.z - actor.z;
  actor.speed = Math.hypot(dx, dz) / dt;
  if (actor.speed > 0.05) {
    const target = Math.atan2(dx, dz);
    actor.yaw += Math.atan2(Math.sin(target - actor.yaw), Math.cos(target - actor.yaw)) * Math.min(1, dt * 12);
  }
  actor.x = next.x; actor.z = next.z;
}
function updateNPCs(s, dt) {
  for (const npc of s.npcs) {
    if (distance(npc, s.dog) > 22) continue;
    if (npc.species === 'squirrel') {
      const near = distance(npc, s.dog) < 3.8;
      if (near) { npc.state.arousal = 0.85; npc.fleeUntil = s.time + 4; }
      const fleeing = s.time < (npc.fleeUntil ?? 0);
      npc.goal = { kind: fleeing ? 'retreat' : 'forage', target: fleeing ? npc.home : npc.home };
      intent(npc, fleeing ? 'retreating' : 'foraging', npc.goal.target);
    } else {
      if (distance(npc, npc.goal.target) < 0.3) {
        const gz = Math.round(npc.z / STREET) * STREET;
        npc.goal.target = { x: npc.x, z: npc.goal.target.z > gz ? gz - 9 : gz + 9 };
      }
      intent(npc, 'strolling', npc.goal.target);
    }
    const next = toward(s.map, npc, npc.intent.target, npc.attributes.speed * dt * (npc.intent.kind === 'retreating' ? 1 : 0.45));
    // Neighborhood creatures give the pair space rather than pushing them around.
    if (distance(next, s.dog) > npc.radius + s.dog.radius && distance(next, s.handler) > npc.radius + s.handler.radius) apply(npc, next, dt);
    else npc.speed = 0;
    updateNeeds(npc, dt, npc.speed > 0.1);
  }
}
// The pair's shared memory: what they have walked and what they have named. Persisted, and
// the future fog of exploration is drawn from exactly this — the world does not reveal
// itself; the pair remembers it.
function remember(s) {
  const mid = { x: (s.dog.x + s.handler.x) / 2, z: (s.dog.z + s.handler.z) / 2 };
  for (const a of [s.dog, s.handler]) s.memory.cells.add(cellKey(a.x, a.z));
  for (const place of s.map.places) {
    if (s.memory.places[place.id] || distance(mid, place) > 5.5) continue;
    s.memory.places[place.id] = { x: place.x, z: place.z, at: s.time, name: place.name };
    s.journal.push({ t: s.time, kind: 'place', id: place.id, name: place.name });
    if (s.journal.length > 300) s.journal.shift();
    s.event = 'place';
  }
}

export function stepWalk(s, dt, input = { x: 0, z: 0 }) {
  if (s.paused || !Number.isFinite(dt) || dt <= 0) return;
  // Public calls may be larger than the renderer's fixed timestep; preserve the collision bound.
  if (dt > 1 / 30 + 1e-8) {
    const steps = Math.ceil(dt / (1 / 30));
    for (let i = 0; i < steps; i++) stepWalk(s, dt / steps, input);
    return;
  }
  s.time += dt;
  chooseIntents(s, input);
  if (!s.resting && s.control !== 'dog' && s.dog.goal?.kind === 'investigate' && distance(s.dog, s.dog.goal.target) < 0.7) {
    startSniff(s, s.map.scents.find(p => p.id === s.dog.goal.id));
  }
  if (s.sniff && !s.resting) {
    // A sniff only progresses while the nose stays at the interest. No remote completion.
    if (distance(s.dog, s.sniff.target) > 1.3) s.sniff = null;
    else {
      s.sniff.remaining -= dt;
      if (s.sniff.remaining <= 0) {
        if (!s.discovered.includes(s.sniff.id)) {
          s.discovered.push(s.sniff.id); s.metrics.sniffs++;
          s.journal.push({ t: s.time, kind: 'scent', id: s.sniff.id, label: s.sniff.label });
          if (s.journal.length > 300) s.journal.shift();
        }
        s.dog.relationships.handler.trust = clamp(s.dog.relationships.handler.trust + 0.01, 0, 1);
        s.sniff = null; s.dog.goal = null; s.sniffCooldown = s.time + 2; s.event = 'discovered';
      }
    }
  }
  let d = propose(s, s.dog, dt, input), h = propose(s, s.handler, dt, input);
  if (s.control === 'handler') d = giveRoom(s, s.dog, s.handler, h, d, dt);
  else h = giveRoom(s, s.handler, s.dog, d, h, dt);
  const next = constrainPair(s.map, s.dog, s.handler, d, h);
  const attempted = distance(s.dog, d) + distance(s.handler, h);
  const moved = distance(s.dog, next.dog) + distance(s.handler, next.handler);
  const length = ropeLength(next.path), stretch = clamp((length - (LEASH.length - 0.45)) / (0.45 + LEASH.give), 0, 1);
  s.tension += (stretch - s.tension) * Math.min(1, dt * 9);
  // Disagreement measures prevented intentions, not simply distance between the pair.
  const conflict = next.blocked && attempted > 0.01 && moved < attempted * 0.65;
  s.disagreement = clamp(s.disagreement + dt * (conflict ? 0.55 : -0.5), 0, 1);
  s.stuck = conflict ? s.stuck + dt : Math.max(0, s.stuck - dt * 0.25);
  s.metrics.distance += distance(s.dog, next.dog);
  if (s.tension < 0.3 && moved > 0.005) s.metrics.relaxed += dt;
  apply(s.dog, next.dog, dt); apply(s.handler, next.handler, dt); s.leash = next.path;
  for (const actor of [s.dog, s.handler]) updateNeeds(actor, dt, actor.speed > 0.1, actor === s.dog && !!s.sniff && !s.resting);
  updateNPCs(s, dt);
  remember(s);
  ensureWindow(s);
}
