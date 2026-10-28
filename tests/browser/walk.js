// Run in the walking page's developer console (uses a temporary walk, restores yours):
// await (await import('./tests/browser/walk.js')).runWalkChecks()
import { createWalk, stepWalk, setControl, setDestination, startSniff } from '../../src/walk/simulation.js';
import { packWalk, restoreWalk } from '../../src/walk/save.js';
import { distance, ropeLength, walkable, ropePath, LEASH } from '../../src/walk/navigation.js';
const check = (ok, message) => { if (!ok) throw new Error(message); };

export async function runWalkChecks() {
  const api = window.__walk;
  check(api, 'Open walk.html first');
  check(!api.view.renderer.getContext().isContextLost(), 'WebGL context is live');
  const snapshot = packWalk(api.state), results = [];
  try {
    const s = api.state, revision = s.revision + 1;
    Object.assign(s, createWalk(2026)); s.revision = revision; setControl(s, 'dog');
    const assertPair = () => {
      check(walkable(s.map, s.dog, s.dog.radius) && walkable(s.map, s.handler, s.handler.radius), 'Both bodies clear obstacles');
      check(ropeLength(s.leash) <= LEASH.length + LEASH.give + 1e-7, 'Leash is bounded');
    };
    const go = target => {
      check(setDestination(s, target), 'Destination reachable');
      for (let i = 0; i < 3600 && distance(s.dog, target) > 0.4; i++) { stepWalk(s, 1 / 60); assertPair(); }
      check(distance(s.dog, target) < 0.5, 'Arrived with the pair intact');
    };
    go(s.map.scents[0]); check(startSniff(s), 'Sniff starts nearby');
    for (let i = 0; i < 220; i++) stepWalk(s, 1 / 60);
    check(s.metrics.sniffs === 1, 'Sniff completes once'); results.push('Scent discovery');
    // A named corner nearby is discovered and journaled.
    const place = s.map.places.find(p => !s.memory.places[p.id]);
    if (place) {
      go({ x: place.x + 3, z: place.z + 0.5 });
      for (let i = 0; i < 30; i++) stepWalk(s, 1 / 60);
      check(s.memory.places[place.id], 'Place enters memory');
      check(s.journal.some(e => e.kind === 'place' && e.id === place.id), 'Place journaled');
      results.push('Place discovery and memory');
    }
    go({ x: s.dog.x + 18, z: 0.5 }); go({ x: s.dog.x - 18, z: s.dog.z });
    check(Math.abs(s.wx) > 5 || Math.abs(s.wz) > 5, 'The world window slid');
    check(s.memory.cells.size > 4, 'Explored ground is remembered');
    results.push('Continuous walking, corners and reversal');
    s.paused = true; api.view.render(s, 1 / 60);
    check(api.view.renderer.info.render.triangles > 1000, 'Walking world rendered');
    check(document.querySelectorAll('[data-control]').length === 3, 'All control modes available');
    results.push('WebGL and controls');
    return results;
  } finally {
    const revision = api.state.revision + 1;
    const restored = restoreWalk(snapshot);
    check(restored, 'Snapshot restores');
    Object.assign(api.state, restored); api.state.revision = revision;
    api.view.render(api.state, 1 / 60);
  }
}
