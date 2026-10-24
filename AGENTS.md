# Notes for agents

See `README.md` for the layout and how to run things.

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
