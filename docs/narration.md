# Narration

Status: the pipeline is built, the narrator is not. The Glassmaker's lines ([story.md](story.md))
are rendered ahead into audio files with a text-to-speech model; the game does not play them yet
(the narrator that picks lines as things happen is item 4 of story.md's list).

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
| `src/core/narration.js` | the lines: `{ id, text, note, forms?, seed? }`; the English text is an i18n message |
| `src/i18n/de/story.js` | their German (`src/i18n/sources.js` lists the table, so `npm run i18n` wants it) |
| `tools/narration.mjs` | says every line in every voiced language and form, decides what to render, writes the manifest |
| `tools/narration.py` | renders: Pocket TTS, then trimmed, levelled, MP3 (uv script, its dependencies inline) |
| `assets/narration/<lang>/<clip>.mp3` | the clips: mono, 24 kHz, 48 kbit/s; `<clip>` is the id, or `<id>.<form>` |
| `assets/narration/manifest.json` | per language and clip: its text, seed, length in seconds and a hash of what made it |
| `tests/narration.test.js` | the table is well formed and translated, every clip is there and current |

## A line

```js
{
  id: 'opening.looked-like',
  text: "There you are! ...No. I'm sorry. For a moment you looked just like {sib, select, m {him} other {her}}.",
  note: 'The first line of a new world ...',
  forms: SIBLING,           // { m: { sib: 'm' }, f: { sib: 'f' } }: two clips, .m and .f
  seed: { de: 3 },          // optional: the take, by language or 'lang.form'; 0 when left out
}
```

- `id`: lowercase words joined by `-` or `.`; what the line is kept and sent under, and the file's name.
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
4. Commit the clips and the manifest with the line. `npm test` fails while a clip is missing,
   changed or left over.

## In the game (not built)

The narrator will look a line up in the manifest of the language of the moment (`clips[lang][clip]`):
no entry, no voice, only the subtitle. The length is there for timing the subtitle before the
file is loaded. The clips are 24 kHz MP3s, which every browser's `decodeAudioData` takes; they
would play through a voice bus of their own in `src/audio/context.js`, the music turned down under
them as under the jingles (`duckMusic`).
