# Walking prototype — implementation and review

This is the first playable slice of [Doggie Walkies](doggie-walkies-spec.md), not the completed
RPG. The original game is still available, with its gameplay modules unchanged.

## Run

From the repository root:

```sh
npm run serve -- 8000 --bind 127.0.0.1
```

No npm dependency installation or build step is needed for the game. The server command needs
`uv`; alternatively, `python3 tools/serve.py 8000 --bind 127.0.0.1` works with Python 3.9+.
Leave the server terminal open and use Ctrl+C to stop it. Do not launch a second copy on a port
already in use.

- Walking prototype: **http://localhost:8000/walk.html**
- Reproducible continuous world: **http://localhost:8000/walk.html?seed=2026&lang=en**
- German: **http://localhost:8000/walk.html?seed=2026&lang=de**
- Original dungeon crawler: **http://localhost:8000/**

A matching saved seed resumes the saved walk; `?seed=` is not a forced reset. To start fresh, use
the **?** help panel's new-walk button, choose a different seed, or remove only the walking save
key in browser storage. Do not clear the original game's saves.

## What is playable

- An original low-poly dog (Miso) and handler (June), with animated walking, head, ears, and tail.
- A **continuous, coordinate-hashed world** — every tree, scent, storefront, lamp, and named
  corner is a pure function of `(seed, world position)`, like the original game's cube world.
  There are no districts, map boundaries, or teleports: streets run to the horizon, and the
  pair crosses the world on foot. Only a window around the pair is materialized at a time, and
  it slides as they walk (new scenery only ever appears far ahead, never on top of them).
  Village District references informed the storefront shapes; no external images are bundled.
- Person-led, dog-led, and autonomous shared-plan walking.
- Exercise versus sniffari priorities; a route for the handler and scent goals for the dog.
- A leash with a 2.7-unit nominal limit and 0.08 units of give. It routes around static obstacles
  and constrains the pair's proposed motion before positions change.
- Distinct feedback for leash extension and prevented intentions (disagreement).
- Independent character energy, stimulation, curiosity, persistence, goals, and intents.
- Sniff progress, one-time scent discoveries, resting, and an invitation to cooperate.
- Body clearance, collision-aware click paths, follower navigation, and making room when reversing.
- A foraging/retreating squirrel and a strolling person using the reduced actor schema.
- **Shared memory that persists across sessions**: explored ground (8 m cells), named places
  discovered together, and a journal of finds. The minimap only shows detail the pair has
  actually walked — streets are known, everything else is remembered. This memory is the
  substrate of the future fog-of-exploration: the world does not reveal itself; the pair
  remembers it. Place names are data (`msg`), so a walk saved in German greets an English
  player in English.
- Pair-weighted camera, zoom, keyboard rotation, canopy fading, minimap, and click/tap controls.
- A compact HUD: one strip combines both intentions, energy, and leash state; pair details and
  walk-plan settings open from small disclosures instead of occupying the playfield.
- Responsive English/German UI, isolated versioned saves, safe failure if storage is unavailable.

### Controls

| Input | Action |
|---|---|
| WASD / arrow keys | Move the currently driven character, relative to the camera |
| Click/tap the ground or minimap | Set a pathfinding destination |
| C | Switch dog/person control |
| G | Let the shared plan drive the walk |
| E | Sniff a nearby interest |
| F | Invite cooperation; temporarily suppress new scent distractions |
| Space | Rest/resume |
| [ / ] | Rotate camera |
| Mouse wheel | Zoom |
| Esc | Pause/resume |
| On-screen controls | Compact pair details, walk plan/style, sniff, cooperate, rest, pause, help |

The gold rings are scent interests; the smaller amber route ring shows the next corner on the
person's wandering route. The pale shaded minimap cells are ground the pair remembers walking.
An un-driven partner can initially prefer something else, then yield; the invitation button
offers explicit recovery.

## Architecture and original-game lineage

The prototype imports the original project's seeded RNG/hash helpers and localization system,
and uses its vendored Three.js and development server/test conventions. It follows the original
separation between pure rules and browser presentation.

| File | Responsibility |
|---|---|
| `walk.html`, `walk.css` | Separate entry and HUD; no changes to the original entry |
| `src/walk/characters.js` | Shared actor profiles, full/reduced models, needs and pace |
| `src/walk/world.js` | Continuous coordinate-hashed streets/blocks, named places, scents |
| `src/walk/navigation.js` | Clearance-expanded visibility graph, swept movement, routed leash |
| `src/walk/simulation.js` | Two explicit actors, goals/intents, cooperation, sniffing, NPCs, sliding window, memory |
| `src/walk/models.js` | Original articulated procedural dog, people, and squirrel geometry |
| `src/walk/view.js` | Scene, storefronts, camera, leash and discovery markers |
| `src/walk/save.js` | Versioned serialization and validated restoration |
| `src/walk/main.js` | Fixed timestep, input, HUD, localization, persistence |
| `src/i18n/de/walk.js` | German catalog, checked by the existing translation tests |

### Why an isolated controller/generator?

The inspected original `physics/move.js`, `game/state.js`, `game/flow.js`, and character/game
modules assume a single hero and import combat, equipment, hazards, or dungeon-specific state.
The original cube generator also produces vertical features that the new tethered pair does not
yet know how to traverse.

The small surface implementation isolates the new risk: **can independent characters negotiate
movement while remaining physically connected?** It is not a replacement of the original world
generator or a commitment to rebuilding the engine.

Before expanding this temporary generator or adding encounters, revisit the original world,
navigation, NPC, combat, quest, progression, animation, and travel modules for adapters/extractions.
The [spec's lineage policy](doggie-walkies-spec.md#10-lineage-and-technical-boundaries) governs that
work: reuse and adapt first, replace only for a specific reason. No original game systems were
removed to make this slice.

## Save behavior

Storage key: `doggie-walkies.prototype.v1` (format version 2; v1 saves are from the retired
district prototype and simply start a fresh walk).

Saves the world seed, both actors' **world-coordinate** positions and supported character
values, control mode, walk style, the route corner, metrics, scent discoveries, and the pair's
memory: explored cells, named places (with names as data), and the journal. Saves every ten
seconds and on page hide and language changes. A new seeded walk replaces this prototype slot.

Temporary intents, active sniff progress, rest/pause state, and NPC positions are not persisted.
NPCs start from their local routines again after reload. Restored coordinates must be traversable,
body-separated, and within the routed leash limit. Invalid data is rejected; the app starts a fresh
walk. Save failure is nonfatal. No `crawler.*` storage is modified by this prototype.

## Checks

```sh
node --test tests/walk.test.js tests/i18n.test.js
npm test
```

The walking tests cover deterministic generation and sliding-window consistency, pair-clear
street backbones, reachable scents/places, reduced NPC models, obstacle-aware paths, swept
collision, leash limits, explicit control, long continuous walks (no teleports, growing memory),
place discovery and journaling, direction reversals, sniff timing/uniqueness, rest/pause,
validated save round-trips at world coordinates, unavailable storage, and timestep subdivision.

Two stuck-recovery regressions deserve particular attention:

- A navigation tick must stop at a corner rather than produce a straight swept chord through it.
- A partner waiting too close must be able to make room for a reversing leader; freezing both
  because one proposal was blocked creates an unrecoverable stand-off.

In the walking page's developer console:

```js
await (await import('./tests/browser/walk.js')).runWalkChecks()
```

This exercises a temporary seeded walk, local sniffing, place discovery and memory, continuous
paths through obstacle corners and reversals, WebGL rendering, and control presence, then restores
the current walk in memory.

`window.__walk` exposes explicit `state.dog` and `state.handler`, the view, control/style setters,
destination/sniff/cooperation actions, pause/save, and a simulation step for debugging.
It does not reuse or overwrite the original game's `window.__game`.

Browser smoke testing also covers real key/button input, pause, reload/save, language switching,
mobile-sized layout, console errors, and failed requests. Screenshot output and optional browser
automation dependencies stay outside the repository.

### Validation at this repository checkpoint

- Full `npm test`: **750 tests, 749 passed, 0 failed, 1 skipped**. The suite includes all
  original-game tests plus the walking and localization tests.
- Focused walking and localization tests: **27 passed, 0 failed**.
- Deterministic continuous-world, corridor, scent/place reachability, long-walk, memory, save,
  reversal, and leash checks pass across many seeds.
- Chrome/WebGL browser checks passed for the integration helper, real keyboard and ground-click
  movement, continuous window sliding, pause, exact save restoration, German switching, the
  compact plan/pair disclosures, and layouts at 390×844, 667×375, 1024×768, and 1440×1000.
- The original game still loaded its German menu and WebGL canvas without page errors.
- No browser runtime errors, failed requests, or horizontal overflow were observed.

These checks establish a working slice, not final gameplay balance or broad device compatibility.

## Current limitations / review focus

- This is a pair-mechanic slice, not the full encounter/boss/progression conversion.
- The world is infinite but currently built on one street-grid template. Seeds vary all
  scenery, interests, facades, and named corners; varied street topologies (curving roads,
  alleys, parks, a river) are future work — ideally by adapting the original game's world
  generator rather than growing this template further.
- The leash follows a shortest obstacle-avoiding route; it does not remember wrapping direction
  or simulate friction, knots, inertia, or force transmission. A route can change sides.
- No elevation, stairs, jumping, water, traffic, interiors, or multiplayer in the walking slice.
- Pair bodies collide with each other and static geometry. NPCs try to give space but are not a
  fully coupled dynamic crowd-collision system.
- The autonomous pair uses simple priority/persistence rules, not a complete utility-AI or daily
  schedule. Training, confidence, endurance, relationships, and motivations have a schema, but
  not every field influences decisions yet. Trust currently gains a small amount after a sniff.
- The dog and handler are new procedural rigs. Existing GLB rigs, skins, equipment, and animations
  have not been adapted into this entry point yet.
- The camera fades obstructing tree canopies; buildings do not yet have the original game's full
  cutaway/occlusion behavior, character silhouettes, camera-arm collision, close view, or
  dithered reveal/retirement. Rotation currently uses keyboard steps. See
  [the comparison checklist](original-game-comparison.md) before changing this presentation stack.
- No walking audio, final reward economy, home/return summary, multiple save slots, or breed selection.

Review the pair's pace, willingness to wait/yield, leash feel, interest frequency, memory/fog
tuning (what the minimap reveals feels right, place density, discovery delight), and the
Village District direction before expanding content. The vision is deliberately broader than
this first implementation.
