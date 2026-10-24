# Lights and shadows

Status: a first version. Every glowing thing of a cube lights it at once, each with its shadow,
and the shadows stay sharp however close the camera comes. Drawn forward as before, so the
anti-aliasing (MSAA) and every material's own look stay what they were.

## Three kinds of light

| light | what | its shadows |
|---|---|---|
| the sun (and the moon of the night themes) | `render/scene.js` `sun` | of the fixed parts: baked; of what moves: three.js's shadow map |
| the fixed lights | what a cube's glowing things give off, every one of them (`render/props.js`): lanterns, fires, lava, portals, crystals, a trial's braziers (`render/lightpool.js adoptLights` takes those not on a villager; at most 128 a cube) | baked when the cube is shown (`render/bake.js`) |
| the moving lights | the hero's lamp (`render/character.js`, a three.js light); shots, enemies, loot, villagers' lamps, a partner (`trackLight`, `render/lightpool.js`) | the hero's lamp: a cube of shadow maps, as the quality level asks (`render/shadows.js`); the others: none |

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

Never in one go: a few steps a frame (the sun, then a light a step; a step is the light's six
shadow maps, its lightmap and its volume), as many as the GPU keeps up with: a fence goes in after
a frame's steps, and while two frames' steps are not done no more are given (on the CPU's clock
the budget never saw the GPU's work: a step is a few ms on a desktop, tens on a weak GPU). Each
frame with none waiting one step more, up to `STEPS` (4, and no more than 3 ms of the frame); one
that waits, back to one. The cube played in
first (`main.js`, last before drawing: whatever builds the cube again during the frame, like the
quests, has done so). A cube's lights stay dark until it is baked and then come on over 0.35 s,
its baked shadows with them (`uBakeR`); a bake that fails leaves them on, without shadows.

- **Through a portal** the new cube is faded out for its first moments (`game/travelfx.js`):
  it is baked by then on a desktop (about 10 frames for the dark forest's 40 lights).
- **Behind the curtain** (`game/hud.js fadeOut`: dying, doors, the town portal, loading) up to
  `HIDDEN_STEPS` (16) a frame and 12 ms, and nothing else is drawn meanwhile (`main.js`); the
  curtain lifts once it is baked (`fadeIn` waits, at most 2 s). (All at once in one frame was 5 s
  of GPU work on a software renderer: a weak GPU's driver gives up on less, and the context is
  lost.)
- **A cube built again** as it was (a prop set that came late, a quest's change: `game/flow.js
  rebuildWorld`) takes its bake at once: the last three cubes' bakes are kept (one where the
  screen is touched), by geometry, and taken if the lights and props are where they were
  (`signature`).
- **How finely** (`BAKE_DETAIL`, by the quality level, `game/quality.js`): High and Medium as
  below; Low 1024² for the sun, 512² cube maps, 2 volume samples a unit, 8 lightmap texels a unit
  (a quarter of the memory); Lowest the same without a volume. The lightmap's texels are the world
  worker's, chosen when the world starts (`bakeDensity`); the rest is for the next cube baked.
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
3. **The volume** (three RGBA8 textures, 4 samples a unit, round the cube): how much of each
   light reaches each point (four points in each voxel), for what is not lightmapped. Its slices
   (one a sample up) lie side by side in one 2D atlas, so a light's slices are one draw (with a 3D
   texture a draw each, about 35 a light: a render pass each, costly on phones' tiled GPUs); a
   shader reads the two slices round a point and blends them. Without it (Lowest) props, figures
   and fluids take every fixed light unshadowed (in the overview 0.3% of the pixels differ).
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
fixed lights' light alone, the lightmap's texels. The Teacher (learn/tutor/) switches the same views with
`teach.lightview(view)` (`game/teach.js`).

What the frames cost (`game/perf.js`), on any device: **`?perf=1`** (or `/perf`) shows the frame
rate and the worst frames, the quality level and what it draws (`render/shadows.js shadowState`),
the pixel ratio and the MSAA dropped, the bake's steps and waits (`bakeStats`), shaders compiled
while drawing (`render/programs.js programStats`; with `?dev=1` each named in the console), draw
calls. **`/bench`** holds the game and times the frame to the end of the GPU's work (a pixel read
back from the screen: Safari has no GPU timers) with a part off at a time. On the software
renderer (1280×720, a nests cube, a horde of 24): High 129 ms a frame (the lamp's maps 15, the
sun's 16, the enemies' shadows 20, the fixed lights 6; the fluids' patterns would add 34), Medium
126, Low and Lowest 95.

**iOS Safari** (`tools/sim-probe.py`): the game in an Xcode simulator's Safari with a probe in the
page, which reports WebGL's features there and (`--full`) a deep cube entered, portal trips and a
level switch, with their long frames. Safari 26 has WebGL2 with `KHR_parallel_shader_compile`
(a program ready ~0.3-0.4 s after compiling, the page not held up) and fences that signal without
blocking, no GPU timers, MSAA up to 4×; a 3× screen draws at 2× (780×1398 on an iPhone 16e). Its
compiling happens in another process: a frame waiting for it comes late with almost nothing of the
page's own time in it, so `/perf`'s count of shaders compiled while drawing misses it. The first
visit's frames into a deep cube still stall (0.5-1 s in the simulator), later ones less (Safari
keeps what it compiled). The simulator draws with the Mac's GPU and enforces no memory limits.

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

## Quality levels (`game/quality.js`)

The settings' **Lighting: Auto / High / Medium / Low / Lowest** (`game/settings.js graphics`;
Auto at first; a stored Full is Auto, a stored Simple is Low). Every level looks the same in kind:
every fixed light with its baked shadow, the hero's lamp and the sun casting shadows. What
changes is how much is drawn for that:

| | High | Medium | Low | Lowest |
|---|---|---|---|---|
| lamp's shadows reach | its light's reach | 5 | 5, every 2nd frame | faded out, not drawn |
| enemies in the lamp's shadows | all | within 5 | none | none |
| sun's map of what moves | 2048 | 1024, enemies within 12 | 1024, every 2nd frame, enemies within 8 | 512, the hero only |
| fixed lights a point takes | 16 | 12 | 8 | 6 |
| fluids' patterns | 512², every frame | 512², 30 Hz | 256², 30 Hz | 256², 20 Hz |
| motes | all | all | half | half |

- **Why these:** drawing the realtime shadow maps is most of what shadows cost, and every enemy is
  drawn again in each of the lamp's six maps and the sun's. On a software renderer (1280×720, a
  nests cube of 17 lights): the lamp's maps ~9 ms of a 79 ms frame, its lookups ~3, the sun's ~7;
  in a fight with 24 enemies the lamp's 16 ms and the sun's 23 of 136, the enemies' share ~20. A
  smaller lamp map does not help (it is geometry, not pixels); the lamp's reach (up to 10 in the
  deep) does: its six maps cover twice that.
- **Never a shader compiled again** (`render/shadows.js`): a light that stops casting shadows
  recompiles every lit shader (3.5 s on a fast machine the first time). The lamp casts shadows on
  every level; how far (its shadow camera's far plane, not its light's reach: past it its light
  goes through walls, faintly), which enemies cast into which map (each map drawn in a call of its
  own, the others' meshes not casting meanwhile), how often (every n-th frame) and how strong
  (`shadow.intensity`) are what change.
- **Every change fades:** the shadows' strength over half a second, the reaches eased (8 units a
  second: enemies' shadows drop out and come back one by one at the edge), the fixed lights a
  point takes eased (`uBakeK`, a float: the last light fades); the fluids' patterns and the sun's
  map size simply switch.
- **Auto** (`core/resolution.js`, with the resolution and the anti-aliasing): too slow, a step
  down: the MSAA samples first, then the level, then the resolution; CPU-bound slow frames take
  only the level down. A level's step is judged a second later than the others (its fades). Up
  after a calm spell: the resolution, then the level, then the samples. The level reached is kept
  for the next visit (`crawler.quality`); a first visit starts at Low where the screen is touched,
  at Medium elsewhere.

Where the screen is touched the frame rate cap is 30 at first (a setting like any other).

## Not yet

- Baking takes the GPU's time while a portal's travel goes on. A GPU that cannot keep up with
  the frames themselves runs behind, so its fences come late and it bakes about a light a frame
  (on a software renderer a 37-light cube took ~16 s, frames being ~180 ms there).
- How much memory iOS Safari allows a page's WebGL before it reloads it is unmeasured (the
  simulator does not enforce it); a bake is ~28 MB on High, ~10 MB on Low.
- The lightmap is laid out for every cube the worker builds (10-25 ms), proxies too.
- More than eleven overlapping lights: some shine without shadows (a dark forest cube: one of 40).
- The moving lights (but the hero's lamp) cast no shadows: one inside what carries it (an enemy's
  glow) would be shut in by it.
- The cells are a grid on the ground: lights of a floor far above or below share a point's list
  (what they cannot reach is cheap: a distance test).
