# Development standards

These standards apply to Doggie Walkies and to work inherited from The Glass Bird. Keep this file
current when a review identifies a process problem or a useful recurring practice.

## Repository hygiene

- Keep the original game launchable at `/` and the walking entry at `/walk.html`.
- Do not commit temporary screenshots, browser automation installs, logs, profiles, generated
  previews, local saves, or editor/OS files. Put review artifacts under `/tmp` unless a curated
  asset is deliberately added to the repository.
- Do not introduce a build step or runtime package installation without a documented reason. The
  browser application uses ES modules and vendored dependencies.
- Before a checkpoint commit, run `git status --short`, `git diff --check`, syntax checks for changed
  JavaScript, relevant focused tests, the full suite, and browser checks when presentation/input
  changed.
- A pushable checkpoint should be committed and leave `git status` clean.

## Command execution and waiting

- Do not use arbitrary fixed sleeps to wait for tests, servers, exports, or other long-running
  commands. They waste time when a job finishes early and still race when it finishes late.
- Prefer running the command in the foreground with an appropriate timeout.
- If work can genuinely proceed in parallel, start the job in the background, do the independent
  work, then wait for its actual completion or completion file. Do not repeatedly poll it with
  long guessed intervals.
- Use a readiness condition for servers and browser pages (`waitForFunction`, an HTTP check, or a
  process health check), not a fixed startup delay.
- Report the real command result and test counts; do not infer success from elapsed time.

## Implementation quality

- Reuse and adapt original-game systems before creating parallel replacements. Document the
  concrete reason and intended integration point when isolation is necessary.
- Keep simulation rules deterministic and separate from rendering/browser state where practical.
- Derive procedural content from stable seeds and world coordinates. Revisiting an area must not
  silently change its permanent content.
- Preserve body-clearance, swept-collision, routed-leash, and pair-recovery invariants. Add a
  regression test for every movement bug fixed.
- Use fixed/subdivided simulation steps for movement and constraints; never depend on render frame
  duration for correctness.
- Validate persisted data and fail safely. Walking storage must never modify `crawler.*` keys.
- Keep English and German catalogs synchronized in the same change. Run `npm run i18n`.
- Keep UI accessible by keyboard, responsive at the documented viewports, and economical with
  screen space. Prefer compact status plus progressive disclosure over repeated large panels.

## Testing expectations

Use the smallest useful check while iterating, then the complete checks for a checkpoint:

```sh
node --test tests/walk.test.js tests/i18n.test.js
npm run i18n
npm test
```

For walking presentation/input changes, also run:

```js
await (await import('./tests/browser/walk.js')).runWalkChecks()
```

and verify the original game still boots. Record exact pass/fail/skip totals in
`docs/walking-prototype.md` when establishing a named checkpoint; do not continually rewrite the
number for unrelated intermediate edits.

## Documentation discipline

- `docs/doggie-walkies-spec.md` is the living product specification.
- `docs/dog-walking-design.md` records design direction and decisions.
- `docs/walking-prototype.md` describes what is actually implemented, tested, and limited.
- `docs/original-game-comparison.md` guides future lineage/presentation comparison.
- Update documentation in the same change when controls, persistence, architecture, limitations,
  or validation claims change.
- Clearly distinguish implemented behavior, agreed direction, experiments, and future proposals.
