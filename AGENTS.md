# Notes for agents

See `README.md` for the layout and how to run things. Follow
`docs/development-standards.md`, including its repository-hygiene, validation, and long-running
command rules. In particular, do not use arbitrary fixed sleeps to wait for work; wait for an
actual completion/readiness condition.

## Doggie Walkies direction

Read `docs/doggie-walkies-spec.md` and `docs/dog-walking-design.md` before making dog-walking
changes. They capture the vision, agreed direction, first milestone, and open decisions.
Reuse and adapt the original game's code and design first; replace only for a specific reason.
The isolated walking slice is a test space for the pair mechanic, not a decision to abandon the
original world, RPG, encounter, boss, camera, cutaway, animation, or rendering systems.
`docs/walking-prototype.md` tracks implementation and tests. Before changing the walking camera,
occlusion, reveal, animation, or scene presentation, read `docs/original-game-comparison.md` and
inspect the original modules it identifies. The existing README describes both launch targets.

## Translations

`src/i18n/languages.js` lists the languages and how each keeps up (`docs/i18n.md`). When you change
or add English text, translate it in the same change into the languages kept with every change
(English and German: game and guide). The ones that catch up later (Indonesian, game only) are
left for their own changes: do not translate into them unless asked.

## Narration

The narrator's lines (`src/core/narration.js`, German in `src/i18n/de/story.js`) are pre-rendered
with Pocket TTS into `assets/narration/` (`docs/narration.md`). When you add or change a line, its
text or its German, also run `node tools/narration.mjs` (needs `uv`; the first run downloads about
1 GB of models): `npm test` fails while a clip rendered here is missing or stale.
`node tools/narration.mjs --check` lists what is out of date. For now the clips and the manifest are
not committed (`assets/narration/` is in `.gitignore`) until we are happy with the voice; the game
only shows the subtitles without them. Do not commit them unless asked.

- Check what you rendered. The `transcribe_file` tool only understands English; for German use the
  `audio-transcription` skill with `--language de`. If a clip says the text wrong, try other takes
  (`node tools/narration.mjs --takes 4 --only <id> --lang <lang>`), listen or transcribe them, and
  pin the good one as the line's `seed`; or reword the line.
- A recorded line never says a player's name: give a line with parameters `forms` (e.g.
  `SIBLING`), never a name.
- Only the languages in `VOICES` (`tools/narration.mjs`: English, German with `german_24l`) are
  voiced; do not add Indonesian.

## Blender previews

`blender/previews/` is local output and ignored by Git: never commit renders from it.

- To see a model, render its preview. Every `blender/<x>.py` names its headless command at the top
  (`Blender -b --python blender/<x>.py -- ...`; on macOS `Blender` is
  `/Applications/Blender.app/Contents/MacOS/Blender`). Most scripts take the preview path or an
  output directory as arguments, and write into `blender/previews/` by default.
- The full commands also export `assets/` and save the `.blend` files. If you only want to look,
  give the script scratch paths (e.g. under `/tmp`) for the GLB, the `.blend` and the output
  directory, so nothing in the repository changes.
- The guide (`learn/img/model-*.jpg`) and the docs (`docs/img/`) show a few previews as small
  JPEG copies. If you change a model that one of them shows, render its preview into
  `blender/previews/` and refresh the copy: `node tools/preview-images.mjs [name ...]` (its
  `IMAGES` table lists which preview goes where). To show a new preview in the guide or the docs,
  add it to that table; do not link to `blender/previews/`.
