# Lights and shadows

Status: a first version. Every glowing thing of a cube lights it at once, each with its shadow,
and the shadows stay sharp however close the camera comes. Drawn forward as before, so the
anti-aliasing (MSAA) and every material's own look stay what they were.

## Three kinds of light

| light | what | its shadows |
|---|---|---|
| the sun (and the moon of the night themes) | `render/scene.js` `sun` | of the fixed parts: baked; of what moves: three.js's shadow map |
| the fixed lights | what a cube's glowing things give off, every one of them (`render/props.js`): lanterns, fires, lava, portals, crystals, a trial's braziers (`render/lightpool.js adoptLights` takes those not on a villager; at most 128 a cube) | baked when the cube is shown (`render/bake.js`) |
| the moving lights | the hero's lamp (`render/character.js`, a three.js light); shots, enemies, loot, villagers' lamps, a partner (`trackLight`, `render/lightpool.js`) | the hero's lamp: a cube of shadow maps every frame; the others: none |

**Where a prop's light is:** where it glows (`core/glowspots.js`): its glowing triangles in
pieces (a big piece in parts 0.8 across), the pieces nearer than 0.5 one spot, at most six a prop
(the lantern tree's lanterns), each moved 0.35 out along the way its glow faces (a toadstool's
gills face down: its lights go under the cap; a window out of its wall) and, on the ground, at
least 0.3 over its foot. At the prop's middle a light would be inside the prop, shut in by its
own baked shadow (a shed's walls, a furnace, a tree's trunk). A prop with several shares its
brightness out between them. A fixed light shines only while what it hung on shows (a portal's
gate, hidden once its face opens).

**The fixed parts** cast the baked shadows: the cube's solids (terrain, stone, wood) and its props
that cast shadows. They stay out of three.js's shadow map of the sun (`render/bake.js
keepFixedOutOfSun`), which then only holds what moves.

## Baking (`render/bake.js tickBakes`)

Never in one go while the cube shows: a few steps a frame (`STEPS`, 2: the sun, then a light a
step; a step is the light's six shadow maps, its lightmap and its volume), the cube played in
first (`main.js`, last before drawing: whatever builds the cube again during the frame, like the
quests, has done so). A cube's lights stay dark until it is baked and then come on over 0.35 s,
its baked shadows with them (`uBakeR`); a bake that fails leaves them on, without shadows.

- **Through a portal** the new cube is faded out for its first moments (`game/travelfx.js`):
  it is baked by then (about 20 frames for the dark forest's 40 lights).
- **Behind the curtain** (`game/hud.js fadeOut`: dying, doors, the town portal, loading) it is
  baked all at once, and the curtain lifts once it is (`fadeIn` waits, at most 2 s).
- **A cube built again** as it was (the quests' changes right after entering, a prop set that came
  late: `game/flow.js rebuildWorld`) takes its bake at once: the last three cubes' bakes are kept,
  by geometry, and taken if the lights and props are where they were (`signature`).
- The baking's shaders are compiled ahead with the cube's (`render/cubeassets.js warmCube`).

What it does:

1. **Channels.** Lights whose reaches overlap get different channels, eleven in all: the brightest
   first, each the first channel none of its neighbours has (reaches count to 85%: beyond that a
   light is faint). A light left without one shares the channel of one within 1.2 units (the
   lanterns on a string: its shadow is near enough); else it shines without a shadow.
2. **The lightmap** (three RGBA8 textures; the first's red is the sun's): for each texel of the
   solids, the **signed distance** to the edge of the light's shadow, in texels (±1.5, 0.5 on the
   edge). Found by testing points a quarter texel apart round the texel (on its plane) against
   the light's shadow map: a cube of 1024² depth maps for a light (only out of 0.3 from it, so a
   lamp's own frame casts none), a 2048² one of the cube for the sun. Where a coarse look round
   finds the light everywhere or nowhere, the texel is ±1.5 at once. The charts' edges are filled
   outwards.
3. **The volume** (three RGBA8 3D textures, 4 samples a unit, round the cube): how much of each
   light reaches each point (four points in each voxel), for what is not lightmapped.
4. The sun's shadow map of the fixed parts (16-bit) is kept, for what is not lightmapped.

**The lightmap's layout** (`render/lightmap.js`, in the world worker with the rest of the
cube's geometry): charts of the triangles facing mostly the same way (the six axis
directions), connected by their edges, projected along that axis; one that would come back over
itself (a spiral ramp) is split. 16 texels a unit, two texels round each chart, packed in
shelves; an atlas of about 1024 × 800 for a cube of the dark forest. The lit solids carry the
place of each corner (`lm`, render/parts.js).

## Drawing (`render/lighthook.js`)

Every light is on all the time, however far from the hero: none is picked by distance (only
past 64 moving ones at once would the farthest fade out). Every lit material takes part without being asked: the module wraps `Material.onBeforeCompile`
(imported first, `main.js` and `render/scene.js`) and edits three.js's light loop the same way in
every shader, so no program changes its cache key.

- **The moving lights:** a table (a float texture, two texels a light: where it is in the world,
  at most 64) every lit shader walks, without shadows (`render/lightpool.js updateLightPool` fills
  it each frame).
- **The fixed lights:** the cube's table (at most 128), walked after the moving ones: not all of
  it, only the lights of the point's **cell** (`core/lightcells.js`: the cube's ground in cells of
  a unit, each with the lights whose reach comes into it, the strongest there first, 16 at most).
  A dark forest's cube has 40-50 lights, a point is reached by about a dozen: on a software
  renderer (a stand-in for a weak GPU) a cube of the spider nests (46 lights) went from about 4 to
  7 frames a second. Each light keeps its row in the table (a dark or hidden one reaches
  nothing); each light's visibility comes from its channel. Both through three.js's own BRDF (`RE_Direct`): the same look
  as a point light. (Tables, not uniform arrays: some GPUs take no more than 224 vectors of
  uniforms in a shader.)
- **On the lightmapped solids** (`BAKED_LM`, `render/bake.js bakedSurface`): the distance from the
  lightmap, turned into light over one pixel (its change across the pixel, `fwidth`): the edge
  is a pixel wide and smooth at any zoom, without MSAA's help (MSAA only smooths the edges of
  triangles). The sun's light takes the lightmap's first channel too.
- **On everything else** (props, figures, fluids): the volume at the point (a little out along
  the normal), soft; the sun from the kept shadow map of the fixed parts.
- Times three.js's shadow map of the sun for what moves, as before.
- The proxies of the surroundings take none of it (`NO_BAKE`, `render/neighbors.js`).
- What a cube is built of shows its own cube's lights and shadows (`render/bake.js
  bakeMaterials`), also while another is the one played in (travelling); everything else (the
  hero, enemies, loot) the cube played in (`setCurrentBake`).
- Flip's turning box is not baked: its lights are moving ones (so are a cube's past 128).

## Dev

`/lightview sun | lights | lightmap | off` (docs/console.md): the sun's baked shadow alone, the
fixed lights' light alone, the lightmap's texels.

## Light in the deep

From depth 13 down no theme has a room without lights of its own, about 15–30 a room
(`tests/lights.test.js`):

- **Glowing props** in every set: the spider nests' glowing eggs, pale fungus, dewy webs and
  glowing silk; the buried ruins' oil lamps, wall braziers and glyph stones (`assets/clutter/`); the
  deep's landmarks glow too (the web gate's and the brood cluster's eggs, the temple gate's
  braziers, the colossus's eyes, the bone arch's candles, the great gear's coals).
- **Lamps by the way** (a theme's `waylights`, `render/propplace.js`): mine lanterns, candelabras
  and bone lanterns, oil lamps and braziers, crucibles, rune stones, glowing eggs.
- **They live:** candles and lanterns flicker, crystals, runes, fungus, magma and the sea's glow
  breathe (`flicker`; the older libraries' by their kind, `core/propcatalog.js FLICKER`), their
  glowing parts with their lights; fires burn with flames (`FIRES`); lava pulses.
- **What drifts** (a theme's `motes`, `render/motes.js`): spores, embers, sparks, dust and
  plankton round the character, and in the darkest themes a few **wisps**, glowing orbs that
  wander about with moving lights of their own (no shadows, like shots).

## The simple look (`game/quality.js`)

The settings' **Lighting: Full / Simple** (`game/settings.js graphics`; at first Simple where the
screen is touched): Simple is for weak devices. No cube is baked (nothing to wait for on
entering, none of the bakes' memory, no shadow lookups in the shaders); every fixed light shines
without a shadow, a point takes the six strongest of its cell; the hero's lamp casts no shadows;
the cube's fixed parts go into three.js's shadow map of the sun (1024 instead of 2048) like
everything else; half the motes drift in the air. On the software renderer it is about a fifth
faster than Full, and enters a cube at once (Full baked its 46 lights for 10-20 s there).
Changing it recompiles the lit shaders once.

## Not yet

- Baking takes the GPU's time while a portal's travel goes on: two lights a frame are a few
  milliseconds on a desktop, more on a phone (`STEPS`).
- The lightmap is laid out for every cube the worker builds (10-25 ms), proxies too.
- More than eleven overlapping lights: some shine without shadows (a dark forest cube: one of 40).
- The moving lights (but the hero's lamp) cast no shadows: one inside what carries it (an enemy's
  glow) would be shut in by it.
- The cells are a grid on the ground: lights of a floor far above or below share a point's list
  (what they cannot reach is cheap: a distance test).
