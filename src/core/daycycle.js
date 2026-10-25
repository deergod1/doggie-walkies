// Days and nights: a theme with a `cycle` (themes/index.js: the slime marsh) is lit by its own
// light for `day` seconds, then by its `dark` for `night` seconds, and so on. Each turn takes the
// last `fade` seconds of the half it ends, so a day is all day from its start and a night all
// night. It runs on the world's play time (state.run.clock), so it goes on while you are
// elsewhere, and friends playing together see the same sky (a guest's clock comes from the host,
// net/session.js). game/daycycle.js shows it; the slime meteorites fall at night
// (core/meteors.js).

const smooth = x => x * x * (3 - 2 * x);

// how far into the night it is at `clock` (s): 0 day, 1 night, in between while it turns
export function nightAt(cycle, clock) {
  if (!cycle) return 0;
  const { day, night, fade } = cycle, period = day + night, s = ((clock % period) + period) % period;
  if (s < day - fade) return 0;
  if (s < day) return smooth((s - (day - fade)) / fade);
  if (s < period - fade) return 1;
  return 1 - smooth((s - (period - fade)) / fade);
}
// is it night (more than halfway turned)?
export const isNight = (cycle, clock) => nightAt(cycle, clock) >= 0.5;
// how long (s) until the light turns next (the middle of the next fade) from `clock`
export function nextTurn(cycle, clock) {
  const { day, night, fade } = cycle, period = day + night, s = ((clock % period) + period) % period;
  const turns = [day - fade / 2, period - fade / 2, period + day - fade / 2];
  return turns.find(t => t > s) - s;
}
