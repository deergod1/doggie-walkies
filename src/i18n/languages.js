// The translations we want, and where (docs/i18n.md). This is the one list: the game offers its
// `game` languages (src/i18n/i18n.js, the settings' picker), the kids' guide (learn/) is written
// in its `guide` ones, and the tests hold both to it (tests/i18n.test.js). English is the source.
//
// How a language keeps up:
//   everyChange: true    translated in the same change as the English (English, German): npm test
//                        fails while one of its messages is missing or unused
//   everyChange: false   catches up later, in its own changes (Indonesian, for now): until then the
//                        English shows where its translation is missing. `npm run i18n` lists what
//                        it lacks under "to catch up", and npm test only fails on what is broken
//                        in it (a bad parameter, markup, a form it does not have).
//
// A language of the guide is one of the game's too: the guide shows the game in its language and
// calls the game's things by the game's words (src/i18n/glossary.js). learn/lang.js is a plain
// script that cannot import this file, so it names the guide's languages itself; a test checks
// that they agree. The guide's languages are all kept with every change.
//
// A new language for the game: a catalog in src/i18n/<code>/ (docs/i18n.md, "Another language").
// For the guide: its text in every learn/*.html page, as <... lang="<code>"> elements.
export const TRANSLATIONS = [
  { code: 'en', name: 'English', game: true, guide: true, everyChange: true },
  { code: 'de', name: 'Deutsch', game: true, guide: true, everyChange: true },
  { code: 'id', name: 'Bahasa Indonesia', game: true, guide: false, everyChange: false },
];

// the codes, in the order above
export const GAME_LANGUAGES = TRANSLATIONS.filter(l => l.game).map(l => l.code);
export const GUIDE_LANGUAGES = TRANSLATIONS.filter(l => l.guide).map(l => l.code);
// translated with every change, and the ones that catch up later
export const EVERY_CHANGE = TRANSLATIONS.filter(l => l.everyChange).map(l => l.code);
export const CATCH_UP = TRANSLATIONS.filter(l => !l.everyChange).map(l => l.code);
