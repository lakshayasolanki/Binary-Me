// Pure model of the light ↔ dark switch. No DOM, no React: the component feeds it events
// and reads mix values (0 = light, 1 = dark) off the clock each frame.
//
// It never sees or emits state-machine events: the glance is a pose override computed by
// poseFor(), so the ladder counter, grudge and their timers can't be touched by a switch.

const clamp = (x) => Math.min(1, Math.max(0, x));
const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2); // ease-in-out
const END = { light: 0, dark: 1 };

/** A segment holds a value still (dur 0) or eases it from→to after a delay. */
const still = (v) => ({ from: v, to: v, start: 0, delay: 0, dur: 0 });

function segValue(seg, t) {
  if (seg.dur <= 0) return seg.to;
  return seg.from + (seg.to - seg.from) * ease(clamp((t - seg.start - seg.delay) / seg.dur));
}
const segDone = (seg, t) => seg.dur <= 0 || t >= seg.start + seg.delay + seg.dur;

/** Sub-timings derived from the total (ms). Reduced motion: one short fade, no lag. */
export function switchTimings(total, timing, reduced = false) {
  if (reduced) return { mat: timing.themeReducedMs, artDelay: 0, art: timing.themeReducedMs, reduced: true };
  const lag = total * timing.themeArtLag;
  return { mat: total - lag, artDelay: lag, art: total - lag, reduced: false };
}

/** committed = the theme being shown or faded toward; pending = loading, nothing visible yet. */
export function initSwitch(theme) {
  return { committed: theme, pending: null, mat: still(END[theme]), art: still(END[theme]), reversed: false };
}

export const mixAt = (s, t) => ({ mat: segValue(s.mat, t), art: segValue(s.art, t) });
export const fading = (s, t) => !segDone(s.mat, t) || !segDone(s.art, t);

function fadeTo(s, theme, now, tm, reverse) {
  const { mat, art } = mixAt(s, now);
  const to = END[theme];
  return {
    committed: theme,
    pending: null,
    reversed: reverse,
    // Reversal continues from the current values, scaled to the distance left: no restart.
    mat: { from: mat, to, start: now, delay: 0, dur: tm.mat * Math.abs(to - mat) },
    art: { from: art, to, start: now, delay: reverse ? 0 : tm.artDelay, dur: tm.art * Math.abs(to - art) },
  };
}

/**
 * Events (all carry `now`, ms):
 *   WANT  {theme, timings}  the host/OS asked for a theme
 *   READY {theme, timings}  the new theme's current pose is decoded → start the fade
 *   FAILED {theme}          it failed to load → stay where we are
 *   RESET {theme}           before anything is shown: no transition, just switch
 */
export function switchReducer(s, ev) {
  const { theme, now } = ev;
  switch (ev.type) {
    case 'WANT':
      if (theme === s.committed) return s.pending ? { ...s, pending: null } : s; // flip back while loading: cancel
      if (fading(s, now)) return fadeTo(s, theme, now, ev.timings, true);       // mid-fade: reverse in place
      return s.pending === theme ? s : { ...s, pending: theme };                  // load first
    case 'READY':
      return s.pending === theme ? fadeTo(s, theme, now, ev.timings, false) : s;
    case 'FAILED':
      return s.pending === theme ? { ...s, pending: null } : s;
    case 'RESET': // nothing on screen yet: just be this theme
      return initSwitch(theme);
    default:
      return s;
  }
}

/**
 * The pose to show: the machine's, except a theme-switch glance (rung-3 frame) while the
 * machine is typing. Sleeping, thinking and reactions never glance.
 */
export function poseFor(machine, glanceUntil, now, assetFor, frameFor) {
  if (!machine) return null;
  if (machine.mode === 'typing' && glanceUntil != null && now < glanceUntil) return 'reaction-3';
  return assetFor(frameFor(machine));
}

/** Should a finished switch glance? Only from typing, and never under reduced motion. */
export const shouldGlance = (machine, reduced) => !reduced && machine?.mode === 'typing';

/** Glance when a fade has finished: not after a reversal (the lights ended where they started). */
export const glanceAfter = (s, machine, reduced) => !s.reversed && shouldGlance(machine, reduced);

/** Parse a CSS time ('600ms', '0.6s') → ms, or null. */
export function cssMs(value) {
  const m = /^\s*([\d.]+)\s*(ms|s)\s*$/.exec(value ?? '');
  return m ? Number(m[1]) * (m[2] === 's' ? 1000 : 1) : null;
}
