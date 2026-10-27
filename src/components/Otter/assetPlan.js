// Pure loading policy for <Otter> (no asset imports, so it's testable in Node).

// Exported widths, in device px of the otter's layout box (scripts/cut-otter-frames.py TIERS).
const TIER_WIDTH = { s: 320, l: 640 };

/** Smallest tier that covers the otter at this size × DPR (with a little slack). */
export function pickTier(cssWidth, dpr = 1) {
  return cssWidth * dpr <= TIER_WIDTH.s * 1.15 ? 's' : 'l';
}

/** Never downgrade a set that's already showing: a bigger tier is already decoded. */
export function stickyTier(wanted, shown) {
  return shown === 'l' ? 'l' : wanted;
}

export const LAYERS = ['layer-base', 'layer-laptop', 'layer-paw-left', 'layer-paw-right'];
export const CRITICAL = ['reaction-1', 'reaction-2', ...LAYERS]; // greeting → typing
export const IDLE = ['reaction-3', 'reaction-4', 'reaction-5', 'reaction-6', 'reaction-7', 'reaction-8', 'reaction-9'];
export const LATE = ['thinking', 'sleeping'];

/** Load order: critical first; thinking jumps the queue if the host is already busy. */
export function loadPlan({ thinking = false } = {}) {
  return {
    critical: thinking ? [...CRITICAL, 'thinking'] : CRITICAL,
    idle: IDLE,
    late: thinking ? ['sleeping'] : LATE,
  };
}

/** State-machine frame ('typing' | 'thinking' | 'sleeping' | 1..9) → asset name. */
export function assetFor(frame) {
  return typeof frame === 'number' || /^\d$/.test(frame) ? `reaction-${frame}` : String(frame);
}

/**
 * Which pose to show: the wanted one if decoded, otherwise hold the previous pose
 * (the state machine keeps its own timing; only the picture waits).
 * typing is shown from layers when all four are ready, else from the flat fallback.
 */
export function resolvePose(want, prev, isReady) {
  const ok = (name) => (name === 'typing' ? LAYERS.every(isReady) || isReady('typing') : isReady(name));
  if (want && ok(want)) return want;
  return prev && ok(prev) ? prev : null;
}
