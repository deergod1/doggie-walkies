# Narration

Status: the pipeline and a first narrator are built. The Glassmaker's lines ([story.md](story.md))
are rendered ahead into audio files with a text-to-speech model, and the game plays them as things
happen, one after the other, with subtitles (`src/game/narrator.js`, "In the game" below). The
lines so far tell the town and the first three depths through: the opening, the road out of town,
the first act's themes and enemies, Gusto, Totnar and Squarlo, and a closing line at depth 3.

**The clips are not committed yet.** Until we are happy with the voice, `assets/narration/` is in
`.gitignore`: render them locally (`node tools/narration.mjs`). Without them (no manifest, or a
clip missing) the game only shows the subtitles, each up as long as reading it takes, and the test
that the clips are current is skipped.

## Why ahead, not in the browser

The lines are a fixed table, so their audio can be made once and shipped like the other assets:
a few kilobytes per line, loaded when a line is said, no model in the browser. Generating in the
browser would mean downloading 200 MB or more per language and running it next to the renderer. Ahead
of time each line can also be listened to, and a bad take swapped for another before anyone hears
it. The cost: a recorded line cannot say a player's name (below).

## The voice

[Pocket TTS](https://github.com/kyutai-labs/pocket-tts) by Kyutai, on the CPU, in its predefined
voice **Azelma**:

| Language | Model | Voice |
|---|---|---|
| English | `english` | `azelma` |
| German | `german_24l` (the 24-layer German model: slower, better) | `azelma` |

`VOICES` in `tools/narration.mjs` says this. Every language kept with every change
(`src/i18n/languages.js`: English and German) has a voice, which a test checks; the others
(Indonesian) show the narrator's words only, until Pocket TTS speaks them.

The model and the voice (VCTK speaker p303, from Kyutai's `tts-voices`) are CC BY 4.0: credit
"Voice: Pocket TTS by Kyutai (CC BY 4.0), voice Azelma from the VCTK corpus (CC BY 4.0)" where
the game credits things.

## The pieces

| | |
|---|---|
| `src/core/narration.js` | the lines: `{ id, on, when?, text, note, forms?, seed? }`, the moments they are said at (`MOMENTS`) and what picks them (`linesFor`); the English text is an i18n message |
| `src/i18n/de/story.js` | their German (`src/i18n/sources.js` lists the table, so `npm run i18n` wants it) |
| `tools/narration.mjs` | says every line in every voiced language and form, decides what to render, writes the manifest |
| `tools/narration.py` | renders: Pocket TTS, then trimmed, levelled, MP3 (uv script, its dependencies inline) |
| `assets/narration/<lang>/<clip>.mp3` | the clips: mono, 24 kHz, 48 kbit/s; `<clip>` is the id, or `<id>.<form>` |
| `assets/narration/manifest.json` | per language and clip: its text, seed, length in seconds and a hash of what made it |
| `src/game/narrator.js` | the narrator in the game: hears the moments, queues the lines, plays the clips, shows the subtitles |
| `tests/narration.test.js` | the table is well formed and translated, every line has a moment, every clip is there and current |

## A line

```js
{
  id: 'opening.looked-like',
  on: 'opening',            // the moment it is said at (MOMENTS)
  when: { boss: 'gusto' },  // (optional; not on this line) what the moment must be about
  text: "There you are! ...No. I'm sorry. For a moment you looked just like {sib, select, m {him} other {her}}.",
  note: 'The first line of a new world ...',
  forms: SIBLING,           // { m: { sib: 'm' }, f: { sib: 'f' } }: two clips, .m and .f
  seed: { de: 3 },          // optional: the take, by language or 'lang.form'; 0 when left out
}
```

- `id`: lowercase words joined by `-` or `.`; what the line is kept and sent under, and the file's name.
- `on`, `when`: when it is said (below, "In the game").
- `text`: a message like every other (`docs/i18n.md`), at most two short sentences (story.md's
  rules), written to be spoken: the German too.
- `forms`: one recording per set of parameters. A line with parameters must have forms that give
  every one of them; that is how the tool knows a line says no name. The names are the players'
  own, so a line that has to say one (the core's "Her name was ...") is not recorded: the subtitle
  says it.
- `seed`: the TTS noise. The same text, model, voice and seed always give the same audio.

## Running it

Needs Node and [uv](https://docs.astral.sh/uv/). The first run downloads the models (about
1 GB into the Hugging Face cache; no account needed); after that a line takes well under a
second in English, one to two in German.

```sh
node tools/narration.mjs --check            # what is missing, changed or gone (exit 1 if any)
node tools/narration.mjs --dry-run          # what a run would render and drop
node tools/narration.mjs                    # render it, drop clips of lines that are gone
node tools/narration.mjs --lang de --only boss.   # some languages / ids only (prefixes)
node tools/narration.mjs --force --only boss.gusto  # again, even if current
node tools/narration.mjs --takes 4 --only boss.gusto [--lang de] [--first-seed 10]
```

`--takes` renders seeds 0 to 3 (or from `--first-seed`) of the chosen clips into the temp
directory, without touching `assets/`, and prints their paths. Listen, put the best one in the
line's `seed`, and run the tool again.

What decides a re-render is the clip's hash: its text in its language, model, voice, temperature,
seed and `PIPELINE` (`tools/narration.mjs`). Changing the English or the German of a line, a seed,
a voice, or how `tools/narration.py` makes the files (raise `PIPELINE` then) renders the affected
clips again; nothing else does.

## Changing lines

1. Write or change the line in `src/core/narration.js`, with its note, and its German in
   `src/i18n/de/story.js` (`npm run i18n`).
2. `node tools/narration.mjs`.
3. Listen to what changed. A line the model says badly (a word swallowed, odd stress, a pause in
   the wrong place) gets another take (`--takes`), or a rewording; punctuation steers the pauses.
   To check a clip without listening, transcribe it, in its language (a Whisper model that knows
   German for the German).
4. Once the clips are committed again (not yet, above): commit them and the manifest with the
   line. `npm test` fails while a clip rendered here is missing, changed or left over.

## In the game

`src/game/narrator.js`. The game tells the narrator its **moments** (`narrate(moment, data)`):

| Moment | When | Data |
|---|---|---|
| `opening` | the town, the first time in a world: her first words, all of them | |
| `town` | close to one of the villagers (the town, the merchant camp) | `who`: the villager (`VILLAGERS` in `world/town.js`) |
| `camp`, `road` | the merchant camp; the first place on the road with enemies | |
| `wander` | a place not seen before, after a quiet while, no enemy about | `act`, `depth` |
| `theme` | a place of a theme (below the town) | `theme`: its id (`props`) |
| `depth` | a depth reached for the first time | `depth` |
| `foe` | an enemy of a species not met before comes after the hero | `species` |
| `fight`, `hurt`, `idle` | a long fight; health under 30%; standing about | |
| `kill`, `level`, `chest`, `loot`, `quest`, `horde`, `fall`, `death`, `home` | what they say | `kill`: `many` |
| `guardian` | a side guardian's arena entered, or the guardian beaten | `what`: `near`, `beaten` |
| `arena` | a boss's arena entered while he still holds the well | `boss` |
| `boss` | his fight: it starts, an attack starts, a stage changes | `boss`, `what`: `start`, the attack's name, `split` (`stage`) |
| `beaten` | the boss beaten (after his jingle) | `boss` |
| `trial` | a trial room sealed, mastered, failed | `what` |

Most come from where the game does that thing anyway (`game/flow.js` `settleIn` and `die`,
`game/enemies.js`, `game/trials.js` ...); the ones about what goes on around the hero (the
villagers, the enemies, a boss's attacks read off his attack clock, health, standing still) the
narrator looks for itself every frame. `MOMENTS` in `core/narration.js` says how each is told:

- **Once.** Every line is said once in a world. What was said is kept with the world
  (`run.told`, saved with it: `core/save.js`), so she never repeats herself, and a world played
  again later goes on where she left off. A moment's lines are said in the table's order: the
  first one not told yet that fits (`when`), or for a scene (`all`: the opening, a depth, an
  arena, a boss beaten) every one that fits.
- **One at a time.** Lines wait their turn in a queue; between two lines a short pause. The most
  important goes first (`pri`: the story, then the bosses, then what happens, then chatter);
  what waited too long to still fit is left out (`ttl`: a boss's attack is old news in four
  seconds, a depth's lines wait as long as it takes). Chatter (`quiet`) only comes after a
  while of quiet, some (`calm`) only when no enemy is after the hero.
- **Paused with the game**: the Esc menu, the inventory and "You died" stop her mid-word; she goes
  on where she stopped (a death's line comes once the hero is back).

A line is looked up in the manifest of the language of the moment (`clips[lang][clip]`): no entry
(a language without a voice), or no audio yet (before the first click or key), and it is only
read, its subtitle up for as long as reading it takes. Its clip is fetched when it is queued and
plays through the voice bus (`src/audio/context.js`), the music turned down under it
(`duckMusic`). The subtitle (`#subtitle`, over the quick bar) shows the line in the language of
the moment, and it goes into the chronicle (kind `narration`). Settings: the narrator's volume
and the subtitles on or off (General, Sound).

The sibling's gender (`SIBLING` forms) should be the hero's (story.md, "What the game needs"
1); until heroes have one, the world's seed picks it. Playing together, every screen has its own
narrator, telling what happens there.

Not in the guide's game window; `?narration=0` turns her off. With `?dev=1`, `/narrate <id>` says
a line now, `/narrate forget` makes her forget what she said in this world.

## Adding lines

A new moment for a line: its `on` and `when`, and if the game does not tell her of it yet, a
`narrate(...)` where it happens (a key in `MOMENTS`). Lines for more depths: `depth` (with its
`depth`), `wander` (with its `act`), `theme`, `arena` / `boss` / `beaten` for its boss; the
attack names are the boss's attacks' `name` (`core/enemies.js`).
