import React, { useEffect, useImperativeHandle, useLayoutEffect, useReducer, useRef, useState } from 'react';
import { OTTER_TIMING, ariaLabelFor, frameFor, initOtter, nextDeadline, otterReducer } from './otterMachine.js';
import { useLive, useReducedMotion, useTypingRhythm } from './typingRhythm.js';
import { LAYERS, assetFor, pickTier, resolvePose, stickyTier } from './assetPlan.js';
import { assetSet, imageFormat } from './otterAssets.js';
import { cssMs, fading, glanceAfter, initSwitch, mixAt, poseFor, switchReducer, switchTimings } from './themeSwitch.js';
import { FRAME_META as M } from './frameMeta.js';
import './otter.css';

const THEMES = ['light', 'dark'];
const TIERS = ['s', 'l'];
const POSES = ['reaction-1', 'reaction-2', 'reaction-3', 'reaction-4', 'reaction-5', 'reaction-6',
  'reaction-7', 'reaction-8', 'reaction-9', 'thinking', 'sleeping'];

const pct = (v, of = M.canvas) => `${(v / of) * 100}%`;
const B = M.box;
// Static geometry: the button is the typing pose's bbox; the canvas overflows it.
const GEOMETRY = {
  '--_otter-aspect': `${B.w} / ${B.h}`,
  '--_otter-canvas-w': pct(M.canvas, B.w),
  '--_otter-canvas-x': pct(-B.x, B.w),
  '--_otter-canvas-y': pct(-B.y, B.h),
  '--_otter-origin': `${pct(M.body.cx)} ${pct(M.floorY)}`,
  '--_otter-mat-x': pct(M.mat.cx),
  '--_otter-mat-y': pct(M.floorY),
  '--_otter-mat-w': pct(M.mat.w),
  '--_otter-mat-h': pct(M.mat.h),
  '--_otter-contact-x': pct(M.mat.contact.cx - M.mat.cx + M.mat.w / 2, M.mat.w),
  '--_otter-contact-w': pct(M.mat.contact.w * 0.8, M.mat.w),
};
const MAT_VARS = Object.fromEntries(Object.entries(M.mat.colors).map(([theme, colors]) => [
  theme, Object.fromEntries(Object.entries(colors).map(([k, v]) => [`--_otter-sampled-${k}`, v])),
]));
// Tight-crop placement of every image inside the canvas, per theme.
const rectStyle = (theme, name) => {
  const [x, y, w, h] = M.rects[theme][name];
  return { left: pct(x), top: pct(y), width: pct(w), height: pct(h) };
};
const layerStyle = (theme, name) => {
  const pivot = M.typingLayers[theme].pivots[name.replace('layer-', '')];
  if (!pivot) return rectStyle(theme, name);
  const [x, y, w, h] = M.rects[theme][name];
  return { ...rectStyle(theme, name), transformOrigin: `${((pivot[0] - x) / w) * 100}% ${((pivot[1] - y) / h) * 100}%` };
};
const needFor = (pose) => (pose === 'typing' ? LAYERS : [pose]);

const now = () => Date.now();

/** Latches true once the element is within `margin` of the viewport. */
function useNear(ref, margin = '200px') {
  const [near, setNear] = useState(false);
  useEffect(() => {
    if (near) return undefined;
    if (typeof IntersectionObserver === 'undefined') { setNear(true); return undefined; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) setNear(true); }, { rootMargin: margin });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [near, ref, margin]);
  return near;
}

function usePrefersDark(enabled) {
  const query = '(prefers-color-scheme: dark)';
  const [dark, setDark] = useState(() => enabled && typeof matchMedia !== 'undefined' && matchMedia(query).matches);
  useEffect(() => {
    if (!enabled) return undefined;
    const mq = matchMedia(query);
    const on = () => setDark(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [enabled]);
  return dark;
}

/** Asset tier from the rendered width × devicePixelRatio. */
function useTier(ref) {
  const [tier, setTier] = useState(null);
  useEffect(() => {
    const el = ref.current;
    const update = () => setTier(pickTier(el.getBoundingClientRect().width, window.devicePixelRatio || 1));
    update();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return tier;
}

function useFormat() {
  const [format, setFormat] = useState(null);
  useEffect(() => { imageFormat().then(setFormat); }, []);
  return format;
}

/** Re-render whenever any of these sets finishes decoding something. */
function useSets(sets) {
  const [, bump] = useReducer((n) => n + 1, 0);
  const key = sets.map((s) => `${s.theme}:${s.tier}:${s.format}`).join('|');
  useEffect(() => {
    const offs = sets.map((s) => s.subscribe(bump));
    return () => offs.forEach((off) => off());
  }, [key]);
}

/** The set to draw a theme from: the wanted tier if it can show the pose, else the other. */
function drawSet(theme, tier, format, want, prev) {
  if (!format || !tier) return null;
  for (const t of tier === 'l' ? ['l', 's'] : ['s', 'l']) {
    const set = assetSet(theme, t, format);
    if (set.status.size && resolvePose(want, prev, set.isReady)) return set;
  }
  return null;
}

/** One theme's art: typing stack + every decoded pose. Only decoded images are mounted. */
function ThemeArt({ set, pose, layerEls }) {
  const { theme } = set;
  const layered = LAYERS.every(set.isReady);
  return (
    <span className="otter__theme" data-theme={theme}>
      {/* Typing crossfades as one frame: layers at rest equal the flat art. */}
      <span className="otter__frame otter__frame--stack" data-active={pose === 'typing' || undefined}>
        {layered
          ? LAYERS.map((name) => {
            const part = name.replace('layer-', '');
            return (
              <img key={name} ref={(el) => { layerEls[theme][part] = el; }} className="otter__layer"
                style={layerStyle(theme, name)} src={set.urls.get(name)} alt="" draggable="false" decoding="sync" />
            );
          })
          : set.isReady('typing') && (
            <img className="otter__layer" style={rectStyle(theme, 'typing')} src={set.urls.get('typing')}
              alt="" draggable="false" decoding="sync" />
          )}
      </span>
      {POSES.filter(set.isReady).map((name) => (
        <img key={name} className="otter__frame" data-active={pose === name || undefined}
          style={rectStyle(theme, name)} src={set.urls.get(name)} alt="" draggable="false" decoding="sync" />
      ))}
    </span>
  );
}

/**
 * Programmer otter mascot. Layout-neutral: the button hugs the typing pose and is `size`
 * wide; other poses overflow it (visible) without shifting layout. The parent places it.
 *
 * Types: Otter.d.ts (OtterProps, OtterHandle, OtterState). Public CSS variables: otter.css.
 *
 * @param {import('./Otter').OtterProps} props
 *   size           otter width: number (px) or any CSS length; default 160
 *   theme          'auto' (prefers-color-scheme, live) | 'light' | 'dark'; default 'auto'
 *   thinking       true while the host app is busy
 *   mat            floor mat (default true); false = sits directly on the page
 *   timing         partial override of OTTER_TIMING
 *   onStateChange  (state) => void, e.g. for a debug readout
 *   ref            OtterHandle: { sleep(), wake(), prefetchTheme(theme) }
 *
 * Loading: nothing is fetched until the otter is within 200px of the viewport, and only the
 * active theme's art at the tier its size × DPR needs (AVIF, WebP fallback). Critical frames
 * first, the rest on idle. Frames are decoded before they're shown; a pose that isn't ready
 * yet holds the previous one (the state machine keeps its timing). The state machine starts
 * once the critical frames are decoded, so the greeting is actually seen.
 *
 * Theme switch ("the lights change"): the new theme's current pose loads first; the current
 * theme stays fully on screen until it's decoded. Then the mats crossfade (the dark one
 * blooms), the otter follows ~100ms later, and a typing otter glances up. Flipping back
 * mid-fade reverses from where it is; flipping back while loading cancels. Total duration:
 * --otter-theme-duration (CSS, so it can match the page's own fade) or timing.themeMs.
 */
export default function Otter({
  size = 160, theme = 'auto', thinking = false, mat = true, timing: timingOverride,
  onStateChange, className, style, ref, ...rest
}) {
  const timing = { ...OTTER_TIMING, ...timingOverride };
  const timingRef = useRef(timing);
  timingRef.current = timing;
  // null until START (critical frames decoded); the machine itself is unchanged.
  const [state, dispatch] = useReducer(
    (s, ev) => (ev.type === 'START' ? (s ?? initOtter(ev.now, timingRef.current))
      : s && otterReducer(s, ev, timingRef.current)),
    null,
  );
  const send = (type, extra) => dispatch({ type, now: now(), random: Math.random(), ...extra });
  const stateRef = useRef(state);
  stateRef.current = state;

  const rootRef = useRef(null);
  const near = useNear(rootRef);
  const prefersDark = usePrefersDark(theme === 'auto');
  const wantTheme = theme === 'auto' ? (prefersDark ? 'dark' : 'light') : theme;
  const format = useFormat();
  const tierWanted = useTier(rootRef);
  const tierRef = useRef(null);
  if (tierWanted) tierRef.current = stickyTier(tierWanted, tierRef.current); // never downgrade
  const tier = tierRef.current;
  const live = useLive(rootRef);
  const reduced = useReducedMotion();
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  const [sw, swDispatch] = useReducer(switchReducer, wantTheme, initSwitch);
  const swRef = useRef(sw);
  swRef.current = sw;
  const { committed } = sw;
  const [animating, setAnimating] = useState(false);
  const [glancing, setGlancing] = useState(false);

  useSets(format ? THEMES.flatMap((t) => TIERS.map((tr) => assetSet(t, tr, format))) : []);

  // Poses: the machine's (or the theme-switch glance), resolved per theme so each holds its
  // own last decoded pose.
  const want = poseFor(state, glancing ? Infinity : null, 0, assetFor, frameFor);
  const prevPose = useRef({ light: null, dark: null }).current;
  const sets = {};
  const pose = {};
  for (const t of THEMES) {
    sets[t] = state ? drawSet(t, tier, format, want, prevPose[t]) : null;
    pose[t] = sets[t] ? resolvePose(want, prevPose[t], sets[t].isReady) : null;
    prevPose[t] = pose[t];
  }
  const shownPose = pose[committed];

  const timingsNow = () => {
    const total = cssMs(rootRef.current && getComputedStyle(rootRef.current).getPropertyValue('--otter-theme-duration'));
    return switchTimings(total ?? timingRef.current.themeMs, timingRef.current, reducedRef.current);
  };

  // Load the committed theme in priority order (only once it's committed: never prefetch).
  useEffect(() => {
    if (near && format && tier) assetSet(committed, tier, format).start({ thinking });
  }, [near, format, tier, committed]);

  // Start the machine once the first theme's critical frames are decoded.
  useEffect(() => {
    if (!state && near && format && tier && assetSet(committed, tier, format).criticalReady) send('START');
  });
  useEffect(() => { send('SET_THINKING', { on: thinking }); }, [thinking, state === null]);

  // The pose the machine wants jumps the queue in the committed theme.
  useEffect(() => {
    if (state && format && tier && want) needFor(want).forEach((n) => assetSet(committed, tier, format).load(n));
  }, [want, committed, format, tier, state === null]);

  // Theme asked for → switch. Before anything is on screen there's nothing to transition.
  useEffect(() => {
    if (!state) { if (swRef.current.committed !== wantTheme) swDispatch({ type: 'RESET', theme: wantTheme }); return; }
    swDispatch({ type: 'WANT', theme: wantTheme, now: performance.now(), timings: timingsNow() });
  }, [wantTheme, state === null]);

  // Pending theme: load exactly what's on screen (+ the glance frame), then fade. Failure
  // leaves the current theme up. Cancelling (flip back) just drops this effect.
  useEffect(() => {
    const target = sw.pending;
    if (!target || !format || !tier || !shownPose) return undefined;
    const set = assetSet(target, tier, format);
    needFor(shownPose).forEach((n) => set.load(n));
    const check = () => {
      if (swRef.current.pending !== target) return;
      if (resolvePose(shownPose, null, set.isReady) === shownPose) {
        swDispatch({ type: 'READY', theme: target, now: performance.now(), timings: timingsNow() });
        if (shownPose === 'typing') set.load('reaction-3');
      } else if (![...needFor(shownPose), 'typing'].some((n) => set.status.get(n) === 'loading')) {
        swDispatch({ type: 'FAILED', theme: target, now: performance.now() });
      }
    };
    check();
    return set.subscribe(check);
  }, [sw.pending, shownPose, format, tier]);

  // Drive the mix (CSS variables, no React renders per frame). A new switch state (start,
  // reverse) restarts the loop from wherever the values are.
  useLayoutEffect(() => {
    const el = rootRef.current;
    const write = (t) => {
      const m = mixAt(swRef.current, t);
      const bloom = reducedRef.current ? 1 : timingRef.current.themeMatBloom;
      el.style.setProperty('--_otter-mat-mix', m.mat.toFixed(4));
      el.style.setProperty('--_otter-art-mix', m.art.toFixed(4));
      el.style.setProperty('--_otter-mat-bloom', (bloom + (1 - bloom) * m.mat).toFixed(4));
    };
    const t0 = performance.now();
    write(t0);
    if (!fading(sw, t0)) return undefined;
    setAnimating(true);
    setGlancing(false); // a new fade (or reversal) ends any glance in progress
    let raf;
    const tick = () => {
      const t = performance.now();
      write(t);
      if (fading(swRef.current, t)) { raf = requestAnimationFrame(tick); return; }
      setAnimating(false);
      if (glanceAfter(swRef.current, stateRef.current, reducedRef.current)) setGlancing(true);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [sw]);
  useEffect(() => {
    if (!glancing) return undefined;
    const id = setTimeout(() => setGlancing(false), timingRef.current.themeGlanceMs);
    return () => clearTimeout(id);
  }, [glancing]);

  // One timeout for whichever deadline comes first.
  const deadline = state && nextDeadline(state);
  useEffect(() => {
    if (deadline == null) return undefined;
    const id = setTimeout(() => send('TIME'), Math.max(0, deadline - now()));
    return () => clearTimeout(id);
  }, [deadline]);

  useEffect(() => { if (state) onStateChange?.(state); }, [state, onStateChange]);

  const thinkingRef = useRef(thinking);
  thinkingRef.current = thinking;
  const formatRef = useRef(format);
  formatRef.current = format;
  useImperativeHandle(ref, () => ({
    sleep: () => send('FORCE_SLEEP'),
    wake: () => send('TOUCH'),
    greet: () => send('GREET'),
    /** Warm a theme (e.g. on the toggle's hover). Never called automatically. */
    prefetchTheme: (t) => {
      if (!formatRef.current || !THEMES.includes(t)) return;
      const set = assetSet(t, tierRef.current ?? 'l', formatRef.current);
      needFor(prevPose[swRef.current.committed] ?? 'typing').forEach((n) => set.load(n));
      set.start({ thinking: thinkingRef.current });
    },
  }), []);

  const layerEls = useRef({ light: {}, dark: {} }).current;
  useTypingRhythm({
    enabled: !!sets[committed] && shownPose === 'typing' && LAYERS.every(sets[committed].isReady) && live && !reduced,
    timing,
    layers: layerEls,
    meta: M.typingLayers,
    sizeRef: rootRef,
  });

  // Restart the pop on every pose change by alternating two identical keyframes.
  const swapRef = useRef({ pose: shownPose, n: 0 });
  if (swapRef.current.pose !== shownPose) {
    swapRef.current = { pose: shownPose, n: swapRef.current.pose ? swapRef.current.n + 1 : 0 };
  }

  // The committed theme always; the other one only while the crossfade runs.
  const drawn = THEMES.filter((t) => sets[t] && (t === committed || animating));

  return (
    <button
      type="button"
      {...rest}
      ref={rootRef}
      className={className ? `otter ${className}` : 'otter'}
      style={{
        ...GEOMETRY,
        '--_otter-size': typeof size === 'number' ? `${size}px` : size,
        '--_otter-swap-ms': `${timing.swapMs}ms`,
        '--_otter-mat-ms': `${timing.matMs}ms`,
        '--_otter-mat-sx': M.matScale[committed][shownPose ?? 'typing'] ?? 1,
        ...style,
      }}
      aria-label={state ? ariaLabelFor(state) : 'Coding otter'}
      data-state={state?.mode}
      data-theme={committed}
      data-grudge={state?.grudge || undefined}
      data-paused={live ? undefined : true}
      onClick={(e) => { send('CLICK'); rest.onClick?.(e); }}
      onPointerEnter={(e) => { send('TOUCH'); rest.onPointerEnter?.(e); }}
      onFocus={(e) => { send('TOUCH'); rest.onFocus?.(e); }}
    >
      <span className="otter__canvas" aria-hidden="true">
        {/* Two mats, crossfaded by --_otter-mat-mix; the dark one blooms. Shown from first
            paint (the box is sized from metadata), before any art has loaded. */}
        {mat && THEMES.map((t) => (
          <span key={t} className="otter__matlayer" data-theme={t} style={MAT_VARS[t]}>
            <span className="otter__matbloom"><span className="otter__mat" /></span>
          </span>
        ))}
        <span className="otter__fade" data-ready={shownPose ? true : undefined}>
          {/* Both themes share one transformed container: breathing, pop and paws stay in sync. */}
          <span className="otter__body">
            <span className="otter__pop" data-pop={swapRef.current.n % 2}>
              {drawn.map((t) => <ThemeArt key={t} set={sets[t]} pose={pose[t]} layerEls={layerEls} />)}
            </span>
          </span>
        </span>
      </span>
    </button>
  );
}
