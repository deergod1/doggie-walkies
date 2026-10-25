// The ice slide (docs/trials.md, `slide`): a deck (cubegen/trials/deck.js) whose field is ice with
// rocks on it. You come onto the ice through the gap in the rim on the side facing the way in; the
// goal plate lies at the rim on another side, behind its closed gate. On the ice you slide
// (core/trials.js slideStop, game/trials.js); made with its solution (cubegen/trials/solve.js).
// Mounted in a room of its own or on a combiner's platform (cubegen/trials/puzzles.js).
import { N } from '../../core/constants.js';
import { placeDeck, openGap, deckRoute, RIM } from './deck.js';
import { makeSlide } from './solve.js';

// a slide puzzle: { w, h (the field), band (fewest slides: [lo, hi]), decoys, towards, within,
// entrySide, goalSides (null: any but the entry's; a combiner's may hold the entry's own side too) }
// -> the built puzzle { kind, deck, field, solution, entryGap, goalGap, goalCell } or null
export function buildSlide(ctx, { w, h, band, decoys = 3, towards, within = null, entrySide = null, goalSides = null }) {
  const deck = placeDeck(ctx, w, h, towards, within);
  if (!deck) return null;
  const side = entrySide ?? deck.side(towards);
  const made = makeSlide(ctx.R, w, h, band, side, goalSides ?? [0, 1, 2, 3].filter(s => s !== side), 600, decoys);
  if (!made) return null;
  const F = made.field;
  F.rock.forEach((r, i) => { if (r) ctx.lvl0[deck.cell(i % w, (i / w) | 0)] = deck.level + RIM; });
  const entryGap = openGap(ctx, deck, F.entry.x, F.entry.z, F.entry.side), goalGap = openGap(ctx, deck, F.goal.x, F.goal.z, F.goal.side);
  // nothing built across the ground in front of the gaps either (a stair's rail would shut them)
  for (const [gap, side] of [[entryGap, F.entry.side], [goalGap, F.goal.side]]) ctx.noBuild.add(gap + [1, -1, 0, 0][side] + [0, 0, N, -N][side]);
  return { kind: 'slide', deck, field: F, solution: made.solution, entryGap, goalGap, goalCell: deck.cell(F.goal.x, F.goal.z) };
}

export const slideRoute = deckRoute;
// the goal: the plate of the room's (first) puzzle
export const puzzleGoal = ctx => ctx.trialBuild.failed ? null : ctx.layerFloor(ctx.trialBuild.puzzles[0].goalCell, 0);
export { RIM };
