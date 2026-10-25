// The puzzles of the rotation (docs/trials.md "Puzzles"): one size table and one way to mount each in
// a slot. A puzzle is the same wherever it stands: its field, its tuning, its parts, its rules. Its
// own room mounts it in the whole room (with a walkway round it: shapePuzzle below); a combiner
// mounts it on a platform (the sunken room, cubegen/trials/sunken.js).
//
// A field is `long` x `short` cells (short at most 5: a deck with its rim or ring then takes 7 cells
// that way, and two decks side by side fit inside a room's 14).
//   slot: { towards (the point the way in comes from, cells), within (null: anywhere in the room;
//           else the platform: deck.js placeDeck), entrySide (the side the way comes in; null: the one
//           facing `towards`), goalSides (where a slide's goal may lie; null: any but the entry's),
//           short ('x' or 'z': the axis the field's short side lies along) }
import { N } from '../../core/constants.js';
import { buildSlide } from './slide.js';
import { buildGrid, gridGoal } from './grid.js';

// the field and the tuning of each kind at depth d
export const PUZZLE_SIZE = {
  slide: d => d >= 10 ? { long: 7, short: 5, band: [6, 9], decoys: 3 } : { long: 6, short: 5, band: [4, 6], decoys: 3 },
  mirror: d => d >= 10 ? { long: 7, short: 5, band: [4, 6], turns: 5, lenses: 2 } : { long: 6, short: 5, band: [3, 4], turns: 4, lenses: 1 },
  braziers: d => ({ long: 5, short: 5, band: d >= 10 ? [4, 6] : [3, 4] }),
  crates: d => d >= 10 ? { long: 7, short: 5, band: [16, 26], crates: 3 } : { long: 6, short: 5, band: [10, 18], crates: 3 },
  runes: () => ({ long: 5, short: 5 }),
};

// the deck's size (field and rim or ring) across the short side and along the long one
export const deckSpan = (kind, d) => { const s = PUZZLE_SIZE[kind](d); return { short: s.short + 2, long: s.long + 2 }; };

// Mount puzzle `kind` at depth d in `slot`: { kind, deck, ... (as its builder makes it), goalCell }, or null
export function mountPuzzle(ctx, kind, d, slot) {
  const size = PUZZLE_SIZE[kind](d), short = slot.short ?? (ctx.R() < 0.5 ? 'x' : 'z');
  const w = short === 'x' ? size.short : size.long, h = short === 'x' ? size.long : size.short;
  const at = { ...size, w, h, towards: slot.towards, within: slot.within ?? null, entrySide: slot.entrySide ?? null };
  const pz = kind === 'slide' ? buildSlide(ctx, { ...at, goalSides: slot.goalSides ?? null }) : buildGrid(ctx, kind, at);
  if (!pz) return null;
  if (kind !== 'slide') pz.goalCell = gridGoal(pz);
  return pz;
}

// a puzzle's own room: the one puzzle, anywhere in it as far from the portals as it fits, facing the
// way in (its field either way round)
export function shapePuzzle(ctx) {
  const { spec } = ctx, kind = spec.trial.kind;
  ctx.trialBuild = { kind, failed: true, keep: [] };
  ctx.stats.mode = `${spec.kind} / ${kind}`;
  const entry = spec.portals.find(p => p.dir === spec.trial.entry);
  const towards = entry ? [[N - 1, entry.pos], [0, entry.pos], [entry.pos, N - 1], [entry.pos, 0]][entry.dir] : [N / 2, N / 2];
  const pz = mountPuzzle(ctx, kind, spec.depth, { towards });
  if (!pz) return;
  Object.assign(ctx.trialBuild, { failed: false, puzzles: [pz], keep: [...ctx.trialKeep] });
}
