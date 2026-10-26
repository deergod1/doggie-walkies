// The narrator's voice: renders the lines of src/core/narration.js to assets/narration/
// (docs/narration.md). Every line, in every language with a voice (VOICES), in each of its forms,
// becomes assets/narration/<lang>/<clip>.mp3, where <clip> is the line's id, or `<id>.<form>`.
// assets/narration/manifest.json says what each clip was made from (a hash of its text and its
// TTS settings) and how long it is, so only new and changed lines are rendered again.
//
// The speech is Kyutai's Pocket TTS (https://github.com/kyutai-labs/pocket-tts), run by
// tools/narration.py through uv: the first run downloads the models (about 1 GB, into the
// Hugging Face cache), no GPU and no account needed.
//
//   node tools/narration.mjs                 render what is missing or changed, drop what is gone
//   node tools/narration.mjs --check         list what is missing, changed or gone (exit 1 if any)
//   node tools/narration.mjs --dry-run       list what would be rendered
//   node tools/narration.mjs --lang de       only German (a comma-separated list)
//   node tools/narration.mjs --only boss.    only the lines whose id starts so (comma-separated)
//   node tools/narration.mjs --force         render the chosen clips again, even if current
//   node tools/narration.mjs --takes 4       audition: seeds 0-3 of the chosen clips into
//                                            narration-takes/ in the system's temp directory
//                                            (printed), assets untouched; then pin the best as
//                                            the line's `seed`
//   node tools/narration.mjs --takes 3 --first-seed 10   seeds 10-12
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { LINES } from '../src/core/narration.js';
import { setLanguage, tr, paramsOf, loadLocale, SOURCE } from '../src/i18n/i18n.js';

const ROOT = resolve(import.meta.dirname, '..');
export const ASSETS = resolve(ROOT, 'assets');
const TAKES = join(tmpdir(), 'narration-takes');

// the languages with a voice, and the Pocket TTS model and voice each speaks with
// (`temperature`: the model's own when left out). A language without one shows the narrator's
// words only.
export const VOICES = {
  en: { model: 'english', voice: 'azelma' },
  de: { model: 'german_24l', voice: 'azelma' },
};
// how tools/narration.py turns speech into a clip: raise it when that changes, and every clip is
// rendered again
export const PIPELINE = 1;

const ID = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const FORM = /^[a-z0-9]+$/;

const seedOf = (line, lang, form) => {
  const s = line.seed;
  if (s == null) return 0;
  if (typeof s === 'number') return s;
  return s[form ? `${lang}.${form}` : lang] ?? s[lang] ?? 0;
};
const hashOf = spec => createHash('sha256').update(JSON.stringify(spec)).digest('hex').slice(0, 16);
export const clipFile = (lang, key) => `${lang}/${key}.mp3`;

// Every clip the table asks for, said in its language: { lang, key, id, form, text, spec, hash },
// and the table's problems (a bad id, a parameter no form gives, a line not translated).
export async function clipsOf(lines = LINES) {
  const clips = [], problems = [], keys = new Set();
  for (const line of lines) {
    if (!ID.test(line.id ?? '')) problems.push(`${line.id}: an id is lowercase words joined by '-' or '.'`);
    if (!line.note) problems.push(`${line.id}: no note`);
    const forms = line.forms ? Object.entries(line.forms) : [[null, {}]];
    const wanted = [...paramsOf(line.text)];
    for (const [form, params] of forms) {
      if (form != null && !FORM.test(form)) problems.push(`${line.id}: form '${form}' is not one lowercase word`);
      const lacking = wanted.filter(p => !(p in params));
      if (lacking.length) problems.push(`${line.id}${form ? `.${form}` : ''}: no value for {${lacking.join('}, {')}} (a recorded line says no names: give it forms)`);
    }
  }
  for (const [lang, voice] of Object.entries(VOICES)) {
    const messages = lang === SOURCE ? null : (await loadLocale(lang))?.messages;
    await setLanguage(lang);
    try {
      for (const line of lines) {
        if (messages && messages[line.text] == null) { problems.push(`${line.id}: not translated into '${lang}'`); continue; }
        for (const [form, params] of line.forms ? Object.entries(line.forms) : [[null, undefined]]) {
          const key = form ? `${line.id}.${form}` : line.id;
          if (keys.has(`${lang}/${key}`)) { problems.push(`${key}: two lines make this clip`); continue; }
          keys.add(`${lang}/${key}`);
          const text = tr(line.text, params);
          const spec = { pipeline: PIPELINE, model: voice.model, voice: voice.voice, temperature: voice.temperature ?? null, seed: seedOf(line, lang, form), text };
          clips.push({ lang, key, id: line.id, form, text, spec, hash: hashOf(spec) });
        }
      }
    } finally { await setLanguage(SOURCE); }
  }
  return { clips, problems };
}

export function readManifest(assets = ASSETS) {
  const file = resolve(assets, 'narration/manifest.json');
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { clips: {} };
}

// What is to do: the clips missing (no file, or not in the manifest), changed (made from another
// text or settings) and gone (in the manifest or on disk, but no longer in the table).
export async function plan(assets = ASSETS) {
  const { clips, problems } = await clipsOf();
  const manifest = readManifest(assets);
  const missing = [], changed = [];
  for (const c of clips) {
    const had = manifest.clips?.[c.lang]?.[c.key];
    if (!had || !existsSync(resolve(assets, 'narration', clipFile(c.lang, c.key)))) missing.push(c);
    else if (had.hash !== c.hash) changed.push(c);
  }
  const wanted = new Set(clips.map(c => clipFile(c.lang, c.key)));
  const gone = new Set();
  for (const [lang, entries] of Object.entries(manifest.clips ?? {}))
    for (const key of Object.keys(entries)) if (!wanted.has(clipFile(lang, key))) gone.add(clipFile(lang, key));
  const dir = resolve(assets, 'narration');
  if (existsSync(dir)) for (const lang of readdirSync(dir, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name))
    for (const f of readdirSync(join(dir, lang)).filter(f => f.endsWith('.mp3'))) if (!wanted.has(`${lang}/${f}`)) gone.add(`${lang}/${f}`);
  return { clips, problems, missing, changed, gone: [...gone].sort(), manifest };
}

// renders jobs ({ spec, out }) with tools/narration.py; returns { [out]: seconds }
function render(jobs) {
  if (!jobs.length) return {};
  const tmp = mkdtempSync(join(tmpdir(), 'narration-'));
  try {
    const input = join(tmp, 'jobs.json'), output = join(tmp, 'results.json');
    writeFileSync(input, JSON.stringify({ jobs: jobs.map(j => ({ ...j.spec, out: j.out })) }));
    for (const j of jobs) mkdirSync(dirname(j.out), { recursive: true });
    execFileSync('uv', ['run', '--quiet', resolve(ROOT, 'tools/narration.py'), input, output], { cwd: ROOT, stdio: 'inherit' });
    return Object.fromEntries(JSON.parse(readFileSync(output, 'utf8')).map(r => [r.out, r.dur]));
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}

function writeManifest(clips, durations, old, assets) {
  const out = { pipeline: PIPELINE, voices: VOICES, clips: {} };
  for (const c of clips) {
    const dur = durations[c.lang + '/' + c.key] ?? old.clips?.[c.lang]?.[c.key]?.dur;
    if (dur == null) continue;   // (not rendered: --lang or --only left it out)
    (out.clips[c.lang] ??= {})[c.key] = { text: c.text, seed: c.spec.seed, dur, hash: c.hash };
  }
  writeFileSync(resolve(assets, 'narration/manifest.json'), JSON.stringify(out, null, 2) + '\n');
}

async function main(argv) {
  const opt = { langs: null, only: null, force: false, check: false, dry: false, takes: 0, firstSeed: 0 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--lang') opt.langs = argv[++i].split(',');
    else if (a === '--only') opt.only = argv[++i].split(',');
    else if (a === '--force') opt.force = true;
    else if (a === '--check') opt.check = true;
    else if (a === '--dry-run') opt.dry = true;
    else if (a === '--takes') opt.takes = Number(argv[++i]);
    else if (a === '--first-seed') opt.firstSeed = Number(argv[++i]);
    else { console.error(`unknown argument ${a} (see the top of tools/narration.mjs)`); process.exit(2); }
  }
  for (const l of opt.langs ?? []) if (!VOICES[l]) { console.error(`no voice for '${l}' (VOICES: ${Object.keys(VOICES).join(', ')})`); process.exit(2); }
  const assets = ASSETS;
  const p = await plan(assets);
  for (const x of p.problems) console.error(`problem: ${x}`);
  const chosen = c => (!opt.langs || opt.langs.includes(c.lang)) && (!opt.only || opt.only.some(o => c.id.startsWith(o)));

  if (opt.check) {
    for (const c of p.missing) console.log(`missing  ${c.lang}/${c.key}`);
    for (const c of p.changed) console.log(`changed  ${c.lang}/${c.key}`);
    for (const f of p.gone) console.log(`gone     ${f}`);
    const bad = p.problems.length + p.missing.length + p.changed.length + p.gone.length;
    console.log(bad ? 'Run node tools/narration.mjs to bring the narration up to date.' : `All ${p.clips.length} clips are up to date.`);
    process.exit(bad ? 1 : 0);
  }
  if (p.problems.length) process.exit(1);

  if (opt.takes > 0) {
    const pick = p.clips.filter(chosen);
    if (!opt.only) { console.error('--takes wants --only <id>: it renders every take of every chosen clip'); process.exit(2); }
    const jobs = pick.flatMap(c => Array.from({ length: opt.takes }, (_, n) => {
      const seed = opt.firstSeed + n;
      return { spec: { ...c.spec, seed }, out: join(TAKES, c.lang, `${c.key}.seed${seed}.mp3`) };
    }));
    if (opt.dry) { for (const j of jobs) console.log(j.out); return; }
    render(jobs);
    for (const j of jobs) console.log(j.out);
    console.log(`Listen, then pin the best take as the line's seed in src/core/narration.js (seed: n, { ${pick[0]?.lang}: n } or { '${pick[0]?.lang}.<form>': n }).`);
    return;
  }

  const todo = [...p.missing, ...p.changed, ...(opt.force ? p.clips.filter(c => !p.missing.includes(c) && !p.changed.includes(c)) : [])].filter(chosen);
  const dropping = opt.langs || opt.only ? [] : p.gone;
  if (opt.dry) {
    for (const c of todo) console.log(`render  ${c.lang}/${c.key}: ${c.text}`);
    for (const f of dropping) console.log(`drop    ${f}`);
    if (!todo.length && !dropping.length) console.log('Nothing to do.');
    return;
  }
  const durations = {};
  const results = render(todo.map(c => ({ spec: c.spec, out: resolve(assets, 'narration', clipFile(c.lang, c.key)) })));
  for (const c of todo) durations[c.lang + '/' + c.key] = results[resolve(assets, 'narration', clipFile(c.lang, c.key))];
  for (const f of dropping) rmSync(resolve(assets, 'narration', f), { force: true });
  mkdirSync(resolve(assets, 'narration'), { recursive: true });
  // a clip changed but left out by --lang / --only keeps its old entry, so it stays changed
  const old = p.manifest;
  const keep = p.clips.map(c => (todo.includes(c) || !p.changed.includes(c) ? c : { ...c, hash: old.clips[c.lang][c.key].hash, text: old.clips[c.lang][c.key].text, spec: { ...c.spec, seed: old.clips[c.lang][c.key].seed } }));
  writeManifest(keep, durations, old, assets);
  console.log(`Rendered ${todo.length} clip${todo.length === 1 ? '' : 's'}${dropping.length ? `, dropped ${dropping.length}` : ''} (${relative(ROOT, resolve(assets, 'narration'))}/).`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main(process.argv.slice(2));
