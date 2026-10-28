# Doggie Walkies — game vision and specification

**Status:** living specification. The vision below captures the design agreed with the user.
Numerical tuning and implementation choices are prototype defaults, not permanent commitments.
The first walking slice is playable for review; this is not a claim that the whole game exists.
See the prototype implementation notes for actual functionality and limitations.
The original game's lineage remains a design and engineering asset throughout development.

Related documents:

- [Design conversation and decisions](dog-walking-design.md)
- [Prototype implementation and testing](walking-prototype.md)
- [Future comparison with the original game](original-game-comparison.md)
- The root README still documents the original dungeon crawler as well as the walking entry point.

## 1. Vision

**A cozy procedural dog-walking RPG about two individuals sharing a walk.**

The dog is the central character. Their person is a full character with a life, capabilities,
preferences, needs, and intentions of their own. A leash connects them physically. What they want
connects them emotionally—and sometimes pulls them in different directions.

On one walk they want exercise and steady forward progress. On another, every tree is a newspaper,
every corner a discovery, and wandering is the point. Neither approach is inherently better.
A good walk is not necessarily the shortest, fastest, or most obedient one.

The core experience is noticing what each character wants and negotiating a satisfying journey.
The leash's tension is an observable consequence of those intentions, not simply a punishment meter.

### Design pillars

1. **The dog is someone, not equipment.** Give the dog agency and readable character.
2. **The person is someone too.** Changing control does not erase the other character's goals.
3. **Exploration is meaningful.** Procedural neighborhoods, travel, and discovery belong in the game.
4. **Relationships drive mechanics.** Cooperation, disagreement, trust, training, and recovery matter.
5. **Cozy does not mean uneventful.** Encounters can build to substantial challenges and bosses.
6. **Readable before complicated.** Show intentions through behavior; add simulation depth when it
   creates decisions players can understand.

### What this is not

- An escort quest with a dog skin.
- A dog permanently glued to a heel position.
- A realistic rope simulator at the expense of enjoyable walking.
- A system where every animal or stranger is automatically hostile.
- A single optimal obedience score that treats sniffing as wasted time.
- A wholesale deletion of the original game's exploration, RPG, or encounter machinery.

## 2. The core loop

1. Set out with a dog and person, each with their current needs and expectations.
2. Choose a walk intention: exercise, exploration/sniffari, or eventually another shared purpose.
3. Navigate a procedural neighborhood and discover places, scents, characters, and routes.
4. Respond to opportunities and encounters while managing the pair's different intentions.
5. Pause, redirect, cooperate, change plans, or return early when appropriate.
6. Return with discoveries, experiences, relationship changes, and progression.
7. Revisit familiar places or discover new neighborhoods on another walk.

The first prototype tests steps 2–5. A complete start/end-of-walk flow and durable progression are
later work. Do not mistake the prototype's meters and counters for the final reward economy.

## 3. Control and autonomy

**Control, leadership, and motivation are separate concepts.**

| Mode | Player expresses | Other character does |
|---|---|---|
| Person-led | Person's movement or destination | Heels, follows, or investigates according to its own state |
| Dog-led | Dog's movement or destination | Trails, maintains a comfortable pace, and retains preferences |
| Goal-directed | A route or destination rather than continuous movement | Both characters pursue and negotiate intentions |

Initial implementation provides an explicit mode switch. Later behavior can be configurable or
influenced by energy, mood, and training. Do not unexpectedly transfer the player's controls merely
because a stat crossed a threshold.

Direct input and click-to-move should coexist. A character's desired action and actual movement
must be distinct: a dog can want to reach a tree while the leash prevents it.

### Minimum player responses

- Move or choose a destination.
- Change which character is being driven.
- Allow/invite investigation of a nearby interest.
- Invite cooperation and continued movement.
- Pause and rest.
- Change walk style.
- Choose a destination and continue exploring the world together without a map transition.

## 4. Leash and pair movement

### Agreed behavior

- Fixed maximum length with only a small amount of give.
- Slack allows the pair to move independently within reach.
- Tension is visible and affects movement as the leash becomes taut.
- Neither character can stretch it indefinitely or snap the other into place.
- Either partner can generate tension by moving, stopping, or choosing another direction.
- Physical tension and disagreement are not equivalent. A brief taut leash can be uneventful;
  sustained incompatible intentions are a meaningful situation.
- Pulling continuously should not be the universally best way to play.

### Prototype defaults

- Nominal leash length: **2.7 world units**, with **0.08 units of give**.
- Treat world units as approximately meters for presentation; tune against character scale.
- Body collisions use separate dog/person clearances.
- Route the leash around static obstacles and enforce its routed length, not just straight-line
  distance between character centers.
- Use swept collision checks and small simulation steps to prevent walking through obstacles.
- Limit the proposed pair movement before applying it, rather than teleporting a character back
  after an invalid move.
- Start with a simplified leash constraint, not a fully physical chain or rope.

### Recovery and transitions

- A willing follower navigates around the same obstacle, not through it.
- A briefly persistent partner can compromise after disagreement; an explicit cooperation action
  gives the player another option.
- Turning, backtracking, waiting, and changing control should let the pair recover.
- World travel is continuous; scenery is a deterministic function of position, so the pair
  crosses the world on foot and nothing ever loads, teleports, or leaves a partner behind.
- The pair's shared memory (explored ground, named places, journal) persists and shapes what
  the world reveals to them.

Future work must address believable wrap/unwrap behavior, dynamic obstacles, vertical movement,
and the effect of strength/training on pulling. A shortest-path leash in the prototype is not a
claim of realistic rope topology.

## 5. Walk intentions

| Dimension | Exercise walk | Sniffari |
|---|---|---|
| Route preference | Directed, straighter, sustained progress | Wandering, side trips, revisiting interests |
| Pace | More consistent | Variable |
| Stops | Selective | Expected and encouraged |
| Dog's attention | Walking together with occasional competing interests | Scents and exploration given more opportunity |
| Person's response | More commitment to the route | Greater willingness to follow and wait |
| Valuable outcome | Comfortable activity together | Enrichment and satisfying exploration |

A walk may change character midway. These are expectations and weights, not rigid win conditions.
Both partners may generally agree; occasional differences create decisions rather than constant
friction. The game should not manufacture disagreement at every step.

## 6. Shared character model

Dog and person each receive the full character model. NPC people, dogs, squirrels, cats, and other
creatures use a reduced subset of the same concepts, with species-specific capabilities.

| Layer | Purpose | Candidate values |
|---|---|---|
| Identity | Who the character is | ID, name, species, appearance |
| Attributes | Relatively stable capabilities | Speed, strength, endurance, perception |
| Personality | Default preferences/reactions | Curiosity, sociability, caution, persistence |
| Needs | Conditions that seek satisfaction | Rest, stimulation, social contact, comfort |
| State | Immediate physical/emotional condition | Energy, arousal, confidence, stress |
| Skills | Learned abilities | Recall, loose-leash walking, handling, reading signals |
| Relationships | Experience with another individual | Trust, familiarity, attachment |
| Motivations | Current relative priorities | Exercise, exploration, safety, companionship |
| Goals | Desired outcomes | Finish a loop, inspect a smell, return home |
| Intent | Immediate attempted action | Move, investigate, wait, greet, retreat |

### Behavioral rules

- Motivation is derived from personality, needs, state, goals, and context—not a random mood roll
  every frame.
- Different stats need distinct jobs; avoid several disguised stamina meters.
- Intentions have persistence. Small changes in scores should not cause continuous oscillation.
- Species/role profiles select applicable needs, senses, actions, and preferences.
- Individual differences distinguish two dogs of the same breed or two people on the same street.
- Relationships are recorded where meaningful, not for every possible pair in the world.
- Distant NPCs can use lower-detail simulation than nearby characters.

### First active subset

Energy, stimulation, curiosity, preferred pace/speed, persistence, a goal, and an immediate intent.
Other fields may establish the schema without affecting gameplay yet; make that distinction clear
in implementation notes and debug tools.

A squirrel can forage or retreat to safety with a reduced profile. A recurring neighborhood dog
can eventually remember the pair. Not every NPC requires the full player's progression system.

## 7. Encounters, progression, and bosses

The existing dungeon crawler is a foundation to adapt, not merely a renderer to salvage.
Its discovery, travel, timing, reactions, encounter escalation, progression, and bosses are all
potentially useful.

| Existing machinery | Possible walking interpretation |
|---|---|
| Awareness/aggro | Noticing a stimulus, attention, reactive distance |
| Telegraph/windup | Readable buildup to barking, lunging, chasing, or avoidance |
| Positioning/defense | Give space, redirect, wait, disengage, change route |
| Reward | Discovery, confidence, trust, learned skills, walk satisfaction |
| Boss encounter | Sustained multi-stage situation testing earlier lessons |

These are translation opportunities, not a finalized encounter catalog. A passing dog might want
to greet while its person wants to leave. A squirrel might run for a tree. A cat might keep its
distance or defend a comfortable spot. Challenges come from interacting intentions.

Before converting combat content, define the meanings of health, defeat, respawn, status effects,
rewards, and mandatory gates. Favor readable warnings, recovery, and legitimate disengagement.
The precise blend of playful adventure and grounded handling remains a tuning/design decision.

## 8. World and procedural generation

Keep varied neighborhoods and discovery as central features. Variation should affect the walk,
not merely shuffle decoration:

- Paths with different widths and visibility.
- Parks, planted areas, shopping sidewalks, and residential streets.
- Quiet routes and busier routes.
- Scents, landmarks, social opportunities, and places to pause.
- Alternate routes around difficult situations.
- Eventually changing daily activity and time-of-day encounters.

Generation must reserve space for **the tethered pair**: turning room, stopping space, entrances,
and safe transitions. Reachability for a point or single body is insufficient.

Persistent seeded neighborhoods with changing activity are a promising long-term direction.
The prototype now uses a continuous coordinate-hashed world: no districts or exits, a sliding
window of materialized scenery around the pair, persistent scent discoveries, and a persistent
shared memory of explored ground and named places. It does not yet implement a living daily
world.

### Visual reference: Village District, Raleigh

User-supplied references:

- [Cameron Village photograph, Wikimedia Commons](https://upload.wikimedia.org/wikipedia/commons/7/7b/Cameron_Village.jpg)
- [Village District property page, Regency Centers](https://www.regencycenters.com/property/detail/423/Village-District)

The photograph suggests a recognizable neighborhood shopping district rather than a medieval
village: low-rise storefronts, varied pastel facades, flat/parapet roofs, brick accents, fabric
awnings, broad shop windows, sidewalks, street trees, and traditional street lamps. Parking and
street edges are also part of that reference, but traffic mechanics are not in the first slice.

Translate those shapes and rhythms into a cozy low-poly world. Mix planted/sniffable pockets with
walkable shop frontages. Use original fictional shops and geometry; the prototype is not an exact
map of Raleigh or a copy of the businesses in the photograph.

References guide design. Do not bundle downloaded photography or assume its license is covered by
the source code's license. No reference image is required as a runtime asset.

## 9. Presentation and feedback

### Characters

Build an original recognizable dog rather than repurpose an enemy indefinitely. The first dog can
be a single stylized mixed-breed/beagle-like design with articulated legs, head, floppy ears,
tail, and a harness attachment. Procedural geometry is an acceptable first asset pipeline and
allows quick iteration; a later Blender rig is not required to validate the walk.

A human companion must be readable at the same scale and visual detail. Walk cycles should reflect
actual movement; the dog should lower its head to sniff and use ears/tail/posture to convey interest.

### Camera

Frame the pair, weighted toward the dog, with enough look-ahead to read nearby situations. Allow
zoom and rotation. A camera that follows only the person contradicts the game's emphasis.
Rotation should make storefront sides, alleys, yards, and other discoveries readable, but it is
not a substitute for automatic visibility. The original game's occlusion silhouettes, cutaway,
camera-arm collision, snapping overview, and dither fades are explicit candidates for adaptation.

### HUD

Communicate without requiring a spreadsheet:

- Who is currently controlled.
- Walk style and the named place the pair is near (or plain wandering).
- Each character's current intention.
- Energy and a small number of meaningful needs.
- Leash slack/tension and sustained disagreement as separate concepts.
- Current sniff progress or another nearby contextual action.
- A simple record of distance, discoveries, and visited places.

Keep the always-visible presentation compact. The implemented baseline combines both names,
intentions, energy bars, and leash state in one bottom strip; detailed pair statistics and plan
settings live behind small disclosures. Use readable character behavior first and concise
meters/text as support. Provide clear controls,
keyboard access, click/tap destinations, and responsive layout. English and German game text stay
in sync under the repository's existing translation policy.

## 10. Lineage and technical boundaries

**Reuse and adapt first; replace only for a specific reason.** Doggie Walkies is a descendant of
the original game, not a blank-slate engine project. Both its code and its game-design structure
are useful inheritance. A feature need not keep its dungeon fiction to retain its underlying value.

### What we inherit or adapt

| Original foundation | Direction for Doggie Walkies |
|---|---|
| Procedural world, seeds, discovery, regions | Varied neighborhoods and the dog's expanding knowledge of them |
| Portals, travel, neighbors, and range fades | Continuous pair-safe movement plus smooth reveal/retirement of generated scenery |
| Enemy awareness, navigation, timing, reactions | Encounters between characters with wants and boundaries |
| Combat and status systems | Reinterpret where they support interesting walking situations |
| Escalation, guardians, trials, bosses | Longer challenges built from ordinary walking skills |
| RPG stats, progression, equipment, rewards | Character growth, training, relationships, useful walk equipment |
| Villagers, quests, shops, interiors | Neighborhood residents, purposes for walks, local places |
| Animation, rendering, lighting, sound | Reuse useful infrastructure while establishing the dog's identity |
| Saves, settings, localization, accessibility | Preserve proven patterns and adapt schemas deliberately |
| Tests, tooling, documentation | Extend rather than abandon the project's development foundation |

This is an inheritance map, not a statement that all those systems already power the walking
prototype. Inspect the original implementation before building an equivalent system. Reuse a
module directly when its contract fits; otherwise extract an adapter or shared pure rule. Document
why any parallel prototype implementation is necessary, what it tests, and the intended integration
point. Do not delete original systems just because the first walking slice does not exercise them.

- Browser application, ES modules, vendored Three.js; no mandatory build step.
- Keep the original game launchable while the new relationship mechanic is developed.
- Use explicit dog/handler actors rather than redefining the dungeon's global `player` inconsistently.
- Separate pure character/navigation/simulation rules from rendering and browser UI.
- Use deterministic seeds and tests for procedural reachability and pair movement invariants.
- Give the walking prototype a separate, versioned save namespace. Never overwrite dungeon saves.
- Validate saved data; malformed, obsolete, or unavailable storage must not prevent play.
- Keep multiplayer out of the first implementation, but do not confuse control ownership with identity.

The initial prototype uses an isolated surface-neighborhood generator/navigation implementation
because the existing 3D dungeon controller is coupled to one player, combat, gear, and hazards.
This is an integration boundary for the experiment—not a decision to discard the original generator
or encounter systems permanently.

The user confirms the source project is MIT licensed. Retain applicable license/attribution notices
and verify third-party asset/dependency terms before distribution.

## 11. First playable slice: acceptance criteria

The milestone is mostly complete when a reviewer can:

1. Open the walking entry point while the original game remains available.
2. Recognize a custom dog and a person in a seeded, walkable neighborhood.
3. Switch between driving the dog, driving the person, and goal-directed walking.
4. See the un-driven partner follow without passing through buildings or tree trunks.
5. Reach the leash limit without indefinite stretching or routine corrective teleportation.
6. Observe dog and handler pursue different intentions and create understandable tension.
7. Change between exercise and sniffari priorities and notice a behavioral difference.
8. Investigate a scent, watch a sniff, and record that discovery only once.
9. Pause/rest and invite cooperation.
10. Encounter at least one simple NPC using the reduced shared model.
11. Walk far enough that the world window slides, then return home without losing discoveries.
12. Reload a valid save without affecting original-game storage.
13. Use English and German UI, keyboard movement, and click/tap destinations.
14. Pass automated checks for deterministic generation, body clearance, leash limits, continuous
    window movement, discovery, and save validation, plus a browser smoke test.

Visual polish and emergent behavior should be reviewed by actually walking, not inferred only from
test success. Complex rope wrapping, dynamic crowd collisions, encounters/boss conversions, and
complete RPG progression are explicitly outside this first milestone.

## 12. Next stages (not promises of current functionality)

1. **Presentation lineage:** compare the walking slice directly with the original game; restore
   useful camera rotation, silhouettes, selective cutaways, dither fades, animation, and scene
   dynamism without losing pair framing.
2. **Pair feel:** tune pacing, turning, follow distance, persistent intentions, tension feedback,
   and stuck recovery from hands-on review.
3. **Neighborhood character:** richer shop fronts, meaningful sides/rears, landmarks, route
   variation, scents and familiar residents; integrate more original world machinery where useful.
4. **First encounter:** adapt one situation with readable escalation and multiple valid responses.
5. **Walk lifecycle:** set out, return, reflect, retain progression and neighborhood relationships.
6. **Deeper RPG:** meaningful training, personality differences, equipment, and longer-term needs.
7. **Escalation:** encounter chains and bosses built from the skills learned on ordinary walks.
8. **Expansion:** more dogs, animations, species, neighborhoods, accessibility, and possibly co-op.

Keep this document updated when decisions change. Distinguish an experiment, an agreed rule, and
an implemented feature rather than allowing one to silently become another.
