# Doggie Walkies ↔ The Glass Bird comparison checkpoint

This document is a plan for a future side-by-side review. It records what the walking slice
intentionally isolated, what presentation qualities were lost in that isolation, and which original
systems should be inspected before parallel replacements grow further.

Run both from the same checkout:

- Doggie Walkies: **http://localhost:8000/walk.html?seed=2026&lang=en**
- The Glass Bird: **http://localhost:8000/?seed=2026&lang=en**

The two seeds do not describe the same world; they merely make each entry reproducible. Browser
saves are local to that browser/profile and are not transferred by Git.

## Current walking baseline

The checkpoint has:

- a deterministic continuous street world materialized in a sliding window;
- explicit dog and person actors with separate intentions and a routed fixed-length leash;
- direct dog/person control and an autonomous shared plan;
- sniffari/exercise priorities, scents, named places, NPC routines, and persistent shared memory;
- a compact HUD combining both actors' intentions/energy and leash state;
- a separate save namespace and complete English/German walking UI;
- a separate renderer and procedural character models so pair movement could be tested without
  changing the original game.

That last choice is scaffolding, not a conclusion that the original presentation stack is unsuitable.

## What the isolated slice does not currently inherit

| Quality in the original game | Original implementation to inspect | Walking baseline |
|---|---|---|
| Occlusion-driven world cutaway | `src/game/cut.js`, `cutinfo.js`, `src/render/section.js`, cut shaders | Only obstructing tree crowns fade |
| Character visible through solids | silhouette in `src/render/character.js` / figure rendering | No dog/person silhouette |
| Rich overview and close cameras | `src/game/camera.js`, `camerakey.js`, `mouselook.js`, `src/core/view.js` | Fixed-pitch overview; wheel zoom; bracket rotation |
| Camera collision | close-view arm probes in `src/game/camera.js` | None |
| Dithered transitions/range reveal | `src/render/fade.js`, neighbors, travel effects | World render group rebuilds when its window changes |
| Layered/vertical spaces and interiors | world/cube generation, blockers, floors, roofs, doors | Flat streets and solid building boxes |
| Fully animated figures | GLB rigs, `src/render/figure.js`, `animator.js` | Small procedural rigs and simple gait animation |
| Scene responsiveness | day cycle, lighting, audio, particles, camera kick/tremor | Static daylight and limited environmental motion |
| Meaningful all-sided structures | authored town assets, interiors, props, blockers | Detailed storefront face; mostly plain sides/rears |
| Mature settings/accessibility stack | settings, quality, resolution, input binding, reduced motion | Small fixed walking settings surface |

## Questions for the visual comparison

Review the same kinds of situations in both entries rather than comparing screenshots in the
abstract:

1. Can the controlled character always be found immediately?
2. Can both members of the pair and the leash be read when a tree, awning, or building is between
   them and the camera?
3. Does rotation reveal useful information or merely expose unfinished backs of objects?
4. How much of the world is visible, and does that amount create curiosity or flatten discovery?
5. How does the camera communicate motion, impact, stopping, disagreement, and arrival?
6. Do scenery changes appear gracefully at view range/window boundaries?
7. How alive does the scene feel while the characters stand still?
8. How much screen area does the HUD consume at 1440×1000, 1024×768, 390×844, and 667×375?
9. Are controls discoverable without leaving persistent instruction text over the world?
10. Which original systems can be adapted directly, which need a pair-aware API, and which truly do
    not fit the walking game?

## Recommended adaptation order

1. Add depth-tested silhouettes for both actors; keep the routed leash readable when obscured.
2. Reuse the original ordered-dither material fade instead of ordinary alpha for occluders.
3. Make overview orbit a primary mouse/touch/key control and snap to useful viewing angles.
4. Divide buildings into separately fadeable roofs, fronts, sides, rears, awnings, and signs.
5. Give side/rear surfaces meaningful content: alleys, delivery doors, patios, murals, yards, and
   dog-relevant discoveries. Rotation should reveal play, not just geometry.
6. Adapt selective pair-aware cutaway behavior: camera rays should consider dog, person, and leash.
7. Add smooth generated-window range fades/incremental retirement rather than replacing the whole
   rendered group at once.
8. Compare original figure animation, lighting, day cycle, ambient motion, audio, and camera
   feedback before building parallel versions.
9. Consider a close camera only after the overview reliably frames the tethered pair.

Rotation and cutaway solve different problems. Rotation is an exploration affordance; silhouettes
and cutaways are readability guarantees. The intended result uses both.

## Capturing a future checkpoint

Do not commit ad-hoc screenshots or browser dependencies. Keep them in `/tmp` unless a curated image
is deliberately added to `docs/img/`. Record:

- commit hash;
- browser and viewport;
- walking seed and original-game seed;
- camera angle/zoom;
- whether the walking save was fresh;
- observations under the questions above;
- automated test and browser-check results.

Any implementation decision that replaces rather than adapts an original system should be noted in
`docs/walking-prototype.md` with the concrete reason and intended integration point.
