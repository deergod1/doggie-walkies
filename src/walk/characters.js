// Shared, data-only character model. Species select capabilities; NPCs omit full RPG layers.
import { clamp } from '../core/util.js';
export const PROFILES = {
  dog: { radius: 0.3, speed: 2.25, curiosity: 0.85, persistence: 0.7, caution: 0.3 },
  person: { radius: 0.34, speed: 2.1, curiosity: 0.35, persistence: 0.65, caution: 0.4 },
  squirrel: { radius: 0.18, speed: 3.2, curiosity: 0.5, persistence: 0.4, caution: 0.95 },
  cat: { radius: 0.23, speed: 2.4, curiosity: 0.55, persistence: 0.8, caution: 0.7 },
};
export function createActor(id, species, x, z, full = false) {
  const p = PROFILES[species];
  if (!p) throw new Error(`Unknown walking species: ${species}`);
  return { id, species, x, z, radius: p.radius, yaw: Math.PI, speed: 0,
    attributes: { speed: p.speed, endurance: species === 'dog' ? 0.8 : 0.7 },
    personality: { curiosity: p.curiosity, persistence: p.persistence, caution: p.caution },
    needs: { rest: 0.12, stimulation: species === 'dog' ? 0.6 : 0.25 },
    state: { energy: 0.88, arousal: 0.2, confidence: 0.75 },
    goal: null, intent: { kind: 'idle', target: null },
    ...(full ? { skills: { cooperation: 0.45 }, relationships: {}, motivations: { explore: p.curiosity, exercise: 0.5 } } : {}),
  };
}
export function updateNeeds(actor, dt, active, sniffing = false) {
  const e = actor.state, n = actor.needs;
  e.energy = clamp(e.energy + dt * (active ? -0.0018 / actor.attributes.endurance : 0.003), 0.08, 1);
  n.rest = 1 - e.energy;
  n.stimulation = clamp(n.stimulation + dt * (sniffing ? -0.13 : 0.0015), 0, 1);
  e.arousal = clamp(e.arousal + dt * (sniffing ? -0.04 : -0.008), 0.05, 1);
}
export function pace(actor, style) {
  return actor.attributes.speed * (style === 'exercise' ? 1.12 : 0.78) * (0.65 + actor.state.energy * 0.35);
}
