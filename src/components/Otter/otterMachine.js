// Pure state machine for <Otter>. No React, no timers: every event carries `now` (ms),
// and the component schedules a single timeout for the earliest pending deadline.

/**
 * Defaults for every tunable duration and motion amount (override per instance with the
 * `timing` prop). Field docs: OtterTiming in Otter.d.ts.
 * @type {import('./Otter').OtterTiming}
 */
export const OTTER_TIMING = {
  greetingFrameMs: 600,   // greeting shows frame 1, then frame 2, each this long
  rungMs: [1200, 1200, 600, 1200, 1200, 1000, 1000, 1000, 1800], // click ladder rungs 1..9
  grudgeFrameMs: 1200,    // each grudge reaction (frames 6 → 7 → 8 → 6 …)
  ladderDecayMs: 6000,    // ladder counter resets after this long without clicks (not in grudge)
  grudgeMs: 20_000,       // grudge ends after this long without clicks
  sleepAfterMs: 60_000,  // idle (no click/hover/focus, not thinking) → sleeping
  autoThinkAfterMs: 20_000,
  autoThinkDurationMs: 3000,
  autoThinkRepeatMs: [25_000, 40_000],
  thinkingDelayMs: 400,
  thinkingMinMs: 800,
  swapMs: 150,            // frame crossfade + pop

  // Typing rhythm (ranges are [min, max], picked uniformly at random)
  burstKeys: [6, 14],     // keystrokes per burst
  keyGapMs: [120, 180],   // between keystrokes in a burst
  burstPauseMs: [1000, 2500],
  // Paw + laptop layers per keystroke. Distances are screen px at size 200 (scale with size).
  pawDownMs: 60,
  pawUpMs: 90,
  pawPressPx: 1.5,        // active paw: down…
  pawPressDeg: 2,         // …and fingertips rotate down around the wrist
  pawLiftPx: 0.5,         // the other paw lifts slightly
  doubleTapChance: 0.18,  // same paw twice in a row, so it's not a metronome
  laptopPressPx: 0.3,
  laptopPressDeg: 0.3,    // around its bottom center, toward the pressed side
  matMs: 300,             // mat widen/shrink when the laptop goes on the floor

  // Light ↔ dark switch ("the lights changing in his room"). The total comes from the CSS
  // variable --otter-theme-duration when the host sets it (to match its page fade), else themeMs.
  themeMs: 600,
  themeArtLag: 1 / 6,     // otter starts this fraction of the total after the mat (~100ms)
  themeMatBloom: 0.94,    // dark mat scale when off → 1 when on ("lamp blooms")
  themeGlanceMs: 500,     // typing only: a rung-3 glance once the new theme is visible
  themeReducedMs: 150,    // prefers-reduced-motion: one plain opacity fade, no bloom, no glance
};

const GRUDGE_FRAMES = [6, 7, 8];
const LAST_RUNG = 9;

// mode: 'greeting' | 'typing' | 'reacting' | 'thinking' | 'sleeping'
export function initOtter(now, timing = OTTER_TIMING) {
  return {
    mode: 'greeting',
    thinkingSource: null,
    busy: false,
    busyAt: null,
    thinkingUntil: null,
    autoThinkAt: null,
    autoThinkDelay: timing.autoThinkAfterMs,
    frame: 1,             // reaction frame shown while greeting/reacting (1..9)
    greetStep: 0,
    rung: 0,              // ladder rung currently shown (0 = none / grudge reaction)
    counter: 0,           // clicks climbed on the ladder
    grudge: false,
    grudgeIdx: 0,
    phaseEndsAt: now + timing.greetingFrameMs, // end of current greeting/reaction frame
    decayAt: null,
    grudgeEndsAt: null,
    sleepAt: now + timing.sleepAfterMs,
  };
}

export function nextDeadline(s) {
  const ds = [s.phaseEndsAt, s.decayAt, s.grudgeEndsAt, s.sleepAt, s.autoThinkAt, s.busyAt, s.thinkingUntil].filter((d) => d != null);
  return ds.length ? Math.min(...ds) : null;
}

const toTyping = (s, now, timing) => ({
  ...s, mode: 'typing', thinkingSource: null, thinkingUntil: null, rung: 0, phaseEndsAt: null,
  autoThinkAt: s.grudge ? null : now + s.autoThinkDelay,
});

// Any click/hover/focus: wakes a sleeper and pushes the idle timer back.
function touch(s, now, timing) {
  if (s.thinkingSource === 'app') return s;
  if (s.mode === 'sleeping' || s.thinkingSource === 'auto') return { ...toTyping(s, now, timing), sleepAt: now + timing.sleepAfterMs }; // wake without greeting
  return { ...s, sleepAt: now + timing.sleepAfterMs };
}

// Hosts ask for a hello (e.g. someone touches the name): the greeting frames play again from typing, thinking
// or sleeping. Reactions, an app-driven think and a greeting already in progress are left alone.
function greet(s, now, timing) {
  if (s.thinkingSource === 'app' || s.mode === 'greeting' || s.mode === 'reacting') return s;
  return {
    ...s, mode: 'greeting', thinkingSource: null, thinkingUntil: null, autoThinkAt: null, rung: 0,
    greetStep: 0, frame: 1, phaseEndsAt: now + timing.greetingFrameMs, sleepAt: now + timing.sleepAfterMs,
  };
}

function click(s, now, timing) {
  if (s.thinkingSource === 'auto') s = toTyping(s, now, timing);
  if (s.thinkingSource === 'app') {
    // HOOK(spam): clicks while thinking are deliberately a no-op for now — they don't
    // advance the ladder or reset the grudge timer. "Monkey user" / spam handling goes here.
    return s;
  }
  if (s.mode === 'sleeping') return touch(s, now, timing); // the wake-up click doesn't count
  if (s.mode === 'greeting') return touch(s, now, timing); // ladder only from typing/reacting
  s = { ...touch(s, now, timing), autoThinkAt: null };

  // Rung 9 (stand up and point) plays out in full; clicks only feed the grudge.
  if (s.mode === 'reacting' && s.rung === LAST_RUNG) {
    return { ...s, grudgeEndsAt: now + timing.grudgeMs };
  }

  if (s.grudge) {
    return {
      ...s,
      mode: 'reacting',
      rung: 0,
      frame: GRUDGE_FRAMES[s.grudgeIdx % GRUDGE_FRAMES.length],
      grudgeIdx: s.grudgeIdx + 1,
      phaseEndsAt: now + timing.grudgeFrameMs,
      grudgeEndsAt: now + timing.grudgeMs,
    };
  }

  const rung = Math.min(s.counter + 1, LAST_RUNG);
  const next = {
    ...s,
    mode: 'reacting',
    rung,
    frame: rung,
    counter: rung,
    phaseEndsAt: now + timing.rungMs[rung - 1],
    decayAt: now + timing.ladderDecayMs,
  };
  if (rung === LAST_RUNG) {
    Object.assign(next, { grudge: true, grudgeIdx: 0, decayAt: null, grudgeEndsAt: now + timing.grudgeMs });
  }
  return next;
}

// Fire every deadline that has passed.
function elapse(s, now, timing, random) {
  if (s.busyAt != null && s.busyAt <= now) {
    s = { ...s, mode: 'thinking', thinkingSource: 'app', busyAt: null,
      thinkingUntil: now + timing.thinkingMinMs, phaseEndsAt: null, autoThinkAt: null, sleepAt: null, rung: 0 };
  }
  if (s.thinkingUntil != null && s.thinkingUntil <= now) {
    if (s.thinkingSource === 'app' && s.busy) s = { ...s, thinkingUntil: null };
    else {
      const app = s.thinkingSource === 'app';
      const [min, max] = timing.autoThinkRepeatMs;
      s = toTyping({ ...s, autoThinkDelay: app ? timing.autoThinkAfterMs : min + random * (max - min) }, now, timing);
      if (app) s.sleepAt = now + timing.sleepAfterMs;
    }
  }
  if (s.phaseEndsAt != null && s.phaseEndsAt <= now) {
    if (s.mode === 'greeting' && s.greetStep === 0) {
      s = { ...s, greetStep: 1, frame: 2, phaseEndsAt: s.phaseEndsAt + timing.greetingFrameMs };
    } else {
      s = toTyping(s, now, timing);
    }
    if (s.phaseEndsAt != null && s.phaseEndsAt <= now) return elapse(s, now, timing, random);
  }
  if (s.decayAt != null && s.decayAt <= now) {
    s = { ...s, decayAt: null, counter: s.grudge ? s.counter : 0 };
  }
  if (s.grudgeEndsAt != null && s.grudgeEndsAt <= now) {
    s = { ...s, grudge: false, grudgeIdx: 0, counter: 0, grudgeEndsAt: null, autoThinkAt: s.mode === 'typing' ? now + s.autoThinkDelay : null };
  }
  if (s.sleepAt != null && s.sleepAt <= now) {
    s = (s.mode === 'typing' || s.thinkingSource === 'auto')
      ? { ...s, mode: 'sleeping', thinkingSource: null, thinkingUntil: null, autoThinkAt: null, sleepAt: null }
      : { ...s, sleepAt: now + timing.sleepAfterMs }; // busy reacting/greeting: check again later
  }
  if (s.autoThinkAt != null && s.autoThinkAt <= now) {
    s = s.mode === 'typing' && !s.grudge && !s.busy
      ? { ...s, mode: 'thinking', thinkingSource: 'auto', autoThinkAt: null, thinkingUntil: now + timing.autoThinkDurationMs }
      : { ...s, autoThinkAt: null };
  }
  return s;
}

export function otterReducer(s, ev, timing = OTTER_TIMING) {
  const { now } = ev;
  switch (ev.type) {
    case 'CLICK':
      return click(s, now, timing);
    case 'GREET':
      return greet(s, now, timing);
    case 'TOUCH': // hover / focus
      return touch(s, now, timing);
    case 'TIME':
      return elapse(s, now, timing, ev.random ?? 0.5);
    case 'SET_THINKING':
      if (ev.on) return s.busy ? s : { ...s, busy: true, busyAt: s.thinkingSource === 'app' ? null : now + timing.thinkingDelayMs };
      s = { ...s, busy: false, busyAt: null };
      if (s.thinkingSource === 'app' && (s.thinkingUntil == null || s.thinkingUntil <= now)) {
        return { ...toTyping({ ...s, autoThinkDelay: timing.autoThinkAfterMs }, now, timing), sleepAt: now + timing.sleepAfterMs };
      }
      return s;
    case 'FORCE_SLEEP':
      if (s.busy || s.thinkingSource === 'app') return s;
      return { ...s, mode: 'sleeping', thinkingSource: null, thinkingUntil: null, autoThinkAt: null, rung: 0, phaseEndsAt: null, sleepAt: null };
    default:
      return s;
  }
}

// Which image to show for a state: 'typing' | 'thinking' | 'sleeping' | 1..9
export function frameFor(s) {
  if (s.mode === 'greeting' || s.mode === 'reacting') return s.frame;
  return s.mode;
}

const RUNG_LABELS = [
  '', 'waving hi', 'waving hi again', 'glancing at you', 'giving you an annoyed look',
  'ignoring you, annoyed', 'ignoring you, getting angry', 'ignoring you, angrier',
  'ignoring you, furious', 'standing up and pointing at the screen, furious',
];

export function ariaLabelFor(s) {
  const who = 'Coding otter';
  switch (s.mode) {
    case 'greeting': return `${who}, saying hello`;
    case 'reacting': return `${who}, ${s.rung ? RUNG_LABELS[s.rung] : 'ignoring you, still holding a grudge'}`;
    case 'thinking': return `${who}, thinking`;
    case 'sleeping': return `${who}, asleep. Press to wake`;
    default: return s.grudge ? `${who}, typing and holding a grudge` : `${who}, typing`;
  }
}
