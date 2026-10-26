// The narrator's lines (docs/story.md): what the Glassmaker says, by id. The narrator that picks
// them as things happen is not built yet; this is the table its voice is recorded from
// (docs/narration.md): `node tools/narration.mjs` says every line in every voiced language, in
// each of its forms, and renders it to assets/narration/<lang>/<clip>.mp3.
//
// A line:
//   id      what it is kept, sent and recorded under: lowercase words joined by '-' or '.'
//   text    the English message (src/i18n: translated like every other, German in
//           src/i18n/de/story.js); at most two short sentences
//   note    when it comes, how it should feel, who she is thinking of: for the translators and the
//           voice
//   forms   (optional) the parameters it is said with, one recording each, by form name: the
//           clip is `<id>.<form>`. Without forms the line has no parameters and one clip, `<id>`.
//   seed    (optional) the take: the TTS noise seed, a number, or by language (`{ de: 3 }`) or
//           language and form (`{ 'de.f': 3 }`); 0 when left out. Pick one with
//           `node tools/narration.mjs --takes 4 --only <id>`.
//
// A recorded line never says a name: the names are the players' own and cannot be recorded
// ahead. Say people by their words ({sib, select, m {him} other {her}}), not by name.

// the sibling's two forms: the owner's gender (docs/story.md, "The people")
export const SIBLING = { m: { sib: 'm' }, f: { sib: 'f' } };

export const LINES = [
  {
    id: 'opening.looked-like',
    text: "There you are! ...No. I'm sorry. For a moment you looked just like {sib, select, m {him} other {her}}.",
    note: 'The first line of a new world, as the grandchild steps into the town. Glad, then caught out: she mistook you for her little brother (sister), and is embarrassed.',
    forms: SIBLING,
  },
  {
    id: 'boss.gusto.after',
    text: 'I was so sure he was real. I suppose he was.',
    note: 'After Gusto, the grin under the bed, is beaten. A child\'s fear, remembered fondly; a little sad at the end.',
  },
  {
    id: 'boss.squarlo.after',
    text: "It was such a little thing. Then it wasn't.",
    note: 'After Squarlo, the little worry that grew, is beaten. Wry, then quiet.',
  },
];
