# Doggie Walkies — design direction

See [the game vision and specification](doggie-walkies-spec.md) for the expanded design,
lineage/reuse policy, visual references, and milestone acceptance criteria.

This document captures the agreed direction before gameplay changes. It distinguishes agreed
principles from proposed implementation details. It is a design record, not an implementation
status report. The original dungeon crawler remains intact; see [prototype notes](walking-prototype.md)
for the separate walking slice and its current limitations.

## Core premise

A cozy procedural dog-walking RPG centered on a dog and a person negotiating a walk together.
The dog is the primary character; the person is a full character, not merely a passive follower.
Neither character is cargo for the other.

The existing game's procedural exploration, discovery, travel, encounters, progression, and
boss structure are assets to adapt, not systems to discard by default. Different neighborhoods
and discovering them fit the way a dog experiences walks. Combat mechanics can become encounters
with "enemies" and escalating challenges, including bosses; their exact interpretation remains
to be designed.

The user confirms the source project is MIT licensed. Preserve applicable notices and verify
asset/dependency terms when preparing distribution.

## The pair and player control

Both dog and person have their own intentions, even when the player controls the other.
Who receives input and who physically leads are distinct concepts.

Supported directions:

- **Person-led:** the player drives the person; the dog can walk at heel.
- **Dog-led:** the player drives the dog; the person trails.
- **Goal-directed/autonomous:** the dog seeks a waypoint or interest while the person trails.

Behavior may eventually be configurable or influenced by energy, mood, training, and other
character traits. Start with explicit control changes rather than surprising automatic switches.
Direct dog control versus intention-based control, and the precise switching rules, remain open.

## The leash: a central mechanic

- The leash has a maximum length with only a little give: it is mostly inelastic.
- Slack permits independent movement within reach.
- Near full extension, tension should be readable and affect movement.
- At maximum extension, movement must respect the tether rather than stretch indefinitely or
  snap a character into position.
- Either character can create tension by wanting to move, stop, or go in a different direction.
- Physical tension and disagreement are different. Briefly reaching the limit is not necessarily
  a conflict; sustained incompatible intentions may be.

The dog and person will often want similar things. When they do not, the tension and negotiation
between them may be a core driver of play.

Tension is information and an opportunity to respond, not automatically a penalty. Yielding,
inviting, redirecting, pausing, and finding a mutually appealing route should be meaningful.
Constantly pulling should not become the optimal strategy.

### Initial technical direction (proposed)

Begin with a forgiving distance constraint and clear tension feedback, not a full rope simulation.
Believability matters more than strict physical realism. Decide explicitly:

- How tension slows or moves each character, including strength and willingness to yield.
- How both navigate trees, corners, fences, narrow passages, and doors.
- Whether/how the leash wraps around obstacles; avoid simply passing it through walls.
- How stuck recovery works without routine teleporting.
- How navigation, leash routing, and memory remain stable while the generated world window slides.

A traversable path for one character is not necessarily traversable for a tethered pair.

## Walk styles and success

Walks can have different priorities:

| | Exercise-focused | Sniffari |
|---|---|---|
| Route | More directed, straighter | Wandering and exploratory |
| Pace | More consistent | Variable |
| Stops | Selective | Encouraged |
| Shared success | Comfortable sustained movement | Satisfying exploration and enrichment |

These are intentions, not necessarily rigid modes. A walk can change character along the way.
Sniffing and resting can be valuable activities, not inefficient play.

Favor multiple valid outcomes over a single optimal score. Returning early can be legitimate;
difficult encounters can lead to recovery and learning. Define what health, defeat, respawn,
and progression gates become rather than inheriting dungeon meanings accidentally.

## Character model

Dog and person each have their own attributes, motivations, goals, needs, and RPG stats.
NPC people, dogs, squirrels, cats, and other creatures use a reduced set of the same model.
Shared structure does not mean identical stats, capabilities, or behavior across species.

The following organization is a proposed starting schema, not a finalized stat list:

| Layer | Meaning | Examples |
|---|---|---|
| Attributes | Relatively stable capabilities | Speed, strength, endurance, perception |
| Personality | Typical preferences and reactions | Curiosity, sociability, caution, persistence |
| Needs | Conditions that evolve over time | Rest, stimulation, social contact, comfort |
| State | Immediate physical/emotional condition | Energy, arousal, confidence, stress |
| Skills | Learned abilities | Loose-leash walking, recall, reading signals, handling |
| Relationships | Experience with another individual | Trust, familiarity, attachment |
| Goals | Desired outcomes | Finish a loop, investigate a smell, reach home |
| Intent | Immediate attempted action | Approach a tree, wait, greet, retreat |

Motivation connects these layers: curiosity and an unmet stimulation need can raise a smell's
priority; fatigue and a goal to return home can raise the priority of continuing down the street.
Avoid making every stat another name for stamina. Training may be context-specific.

### Shared structure, selective detail

- A shared core supplies identity, movement capabilities, relevant needs/state, goals, and intent.
- Species/role profiles determine applicable senses, needs, actions, and preferences.
- Individual differences distinguish characters within a profile.
- Track relationships where relevant rather than between every possible pair.
- Nearby characters make active decisions; distant characters can use simplified updates.
- Intentions should persist until something meaningful changes, avoiding constant indecision.

A squirrel might need only caution, energy, food interest, and an escape destination. A recurring
neighborhood dog can have personality, familiarity, and history with the pair.

NPCs have intentions rather than merely enemy labels: a passing dog may want to greet ours while
its person wants to continue; a cat may seek distance or stand its ground; a squirrel may escape
to a tree. These are examples, not a committed encounter catalog.

## Encounters and cozy tone

Adapt the existing encounter machinery where useful:

| Existing concept | Potential interpretation |
|---|---|
| Detection/aggro | Attention, awareness, or reactivity distance |
| Windup | Readable buildup toward barking, lunging, or chasing |
| Defensive action | Give space, redirect, wait, or choose another route |
| Rewards | Confidence, trust, training progress, discoveries |
| Boss | Sustained, multi-stage situation testing learned skills |

Readable signals, opportunities to disengage, and recoverable mistakes support a cozy tone.
Other animals and people need not always be antagonists. The balance between playful adventure
and grounded dog handling, and specific encounter/boss mechanics, remain open.

## Procedural neighborhoods

Keep procedural variation meaningful to walking: quiet and busy routes, parks, narrow paths,
open spaces, smell trails, landmarks, and alternate routes around difficult situations.

Generation and navigation must consider the pair's turning room, stopping areas, tether, and
transitions, not just single-character reachability.

The implemented direction is a persistent, seeded, continuous world: content is derived from
global coordinates, a materialized window follows the pair, and explored cells, places, and
journal entries survive reloads. Changing daily activity and the exact balance between remembered
and newly revealed information remain open. The original game's discovery, range fading, neighbor
rendering, and travel presentation remain useful foundations to compare and adapt.

## Camera and feedback

Frame the pair with emphasis on the dog and enough look-ahead to read encounters. Communicate:

- Current control mode.
- Leash slack/tension.
- What caught each character's attention.
- Whether a cue was understood, ignored, or impossible to follow.

The current HUD deliberately consolidates both actors, their energy, intentions, and leash state
into one compact strip; plan settings and deeper pair statistics stay behind small disclosures.
Prefer posture, movement, animation, silhouettes, and selective cutaways over relying only on
meters. Camera rotation should reveal meaningful sides of places, but should complement—not
replace—automatic visibility for the dog, person, and leash.

## Implementation approach

Before gameplay edits, inspect movement/navigation, character rendering/animation, enemy AI and
targeting, transitions, saves, and multiplayer ownership if multiplayer remains a goal.

Define an explicit dog–handler pair model. Do not let the existing `player` object ambiguously
mean dog in one subsystem and person in another. Preserve an easy way to run the original game
while developing; avoid a sweeping rename or removal of RPG systems at the outset.

### First milestone

One dog, one handler, one continuous procedural area. Establish the relationship mechanic before
converting encounters or building an elaborate RPG simulation:

1. Switch between person-led and dog-led control.
2. Both characters navigate and remain tethered.
3. Give the person a route waypoint and the dog a sniff point to demonstrate competing intentions.
4. Support investigating, stopping, turning, obstacles, and crossing generated-world seams together without a transition.
5. Keep the pair and their intentions readable through camera and tension feedback.
6. Establish the shared character structure with only a few active values initially, such as
   energy, curiosity, preferred pace, persistence, and a current goal.
7. Add a simple nearby NPC/animal to demonstrate the reduced shared model once pair movement works.

Defer multiple breeds, extensive shops, elaborate mood/training systems, and multiplayer work
until the basic walk feels good. These are sequencing choices, not exclusions from the vision.

## Open decisions before/during prototyping

- Direct dog control versus intention-based input, and control-switching rules.
- Exact leash length, give, tension response, obstacle behavior, and recovery.
- Initial active stats, ranges, rates, and how they affect decisions.
- Walk objectives, completion, rewards, and consequences.
- How separate dog/person memory combines into reveal and what remains durable across walks.
- Encounter tone, progression, and concrete boss adaptations.
- Camera rotation, silhouettes, selective cutaways, and minimum dog/handler animations.
- Save compatibility and whether multiplayer constrains the first architecture.

Prototype these rather than treating the examples in this document as final mechanics.
