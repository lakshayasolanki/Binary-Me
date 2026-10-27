import { useEffect, useRef, useState } from 'react';

const rand = ([a, b]) => a + Math.random() * (b - a);
const randInt = ([a, b]) => Math.round(rand([a, b]));

/** True while the element is on screen and the tab is visible. */
export function useLive(ref) {
  const [onScreen, setOnScreen] = useState(true);
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || !document.hidden);
  useEffect(() => {
    const onVis = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVis);
    let io;
    if (ref.current && typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting));
      io.observe(ref.current);
    }
    return () => { document.removeEventListener('visibilitychange', onVis); io?.disconnect(); };
  }, [ref]);
  return onScreen && visible;
}

export function useReducedMotion() {
  const query = '(prefers-reduced-motion: reduce)';
  const [reduced, setReduced] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(query).matches);
  useEffect(() => {
    const mq = matchMedia(query);
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

/**
 * Keystroke bursts while `enabled`: runs of keystrokes, then pauses. Each keystroke presses
 * one paw layer around its wrist (alternating, with the odd double-tap), lifts the other a
 * touch, and nudges the laptop layer around its bottom center. Between bursts everything is
 * at rest; when `enabled` goes false all timers and animations are cancelled (rest pose).
 * `layers` = { light: { laptop, 'paw-left', 'paw-right' }, dark: {…} } (live elements; a
 * theme that isn't mounted is skipped). Both themes' paws get the same keystrokes, so motion
 * stays in sync through a theme crossfade. `meta` = FRAME_META.typingLayers (per theme
 * { pivots, pressSign }); `sizeRef` = the otter element, whose width scales the motion
 * (OTTER_TIMING distances are screen px at size 200).
 */
export function useTypingRhythm({ enabled, timing, layers, meta, sizeRef }) {
  const timingRef = useRef(timing);
  timingRef.current = timing;
  const metaRef = useRef(meta);
  metaRef.current = meta;

  useEffect(() => {
    if (!enabled) return undefined;
    const T = () => timingRef.current;
    const timers = new Set();
    const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); };
    const els = () => Object.values(layers).flatMap((t) => Object.values(t)).filter(Boolean);
    const paws = ['paw-left', 'paw-right'];
    let active = Math.random() < 0.5 ? 0 : 1;

    const pulse = (el, transform, t) => {
      const total = t.pawDownMs + t.pawUpMs;
      el?.animate([
        { transform: 'none', easing: 'ease-out' },
        { transform, offset: t.pawDownMs / total, easing: 'ease-in-out' },
        { transform: 'none' },
      ], { duration: total });
    };

    const keystroke = () => {
      const t = T();
      const k = (sizeRef.current?.offsetWidth || 200) / 200;
      const name = paws[active];
      const other = paws[1 - active];
      for (const [theme, el] of Object.entries(layers)) {
        if (!el[name]) continue;
        const { pivots, pressSign } = metaRef.current[theme];
        pulse(el[name], `translateY(${t.pawPressPx * k}px) rotate(${pressSign[name] * t.pawPressDeg}deg)`, t);
        pulse(el[other], `translateY(${-t.pawLiftPx * k}px)`, t);
        // Laptop dips toward the side being pressed.
        const side = pivots[name][0] > pivots.laptop[0] ? 1 : -1;
        pulse(el.laptop, `translateY(${t.laptopPressPx * k}px) rotate(${side * t.laptopPressDeg}deg)`, t);
      }
      if (Math.random() >= t.doubleTapChance) active = 1 - active;
    };

    const burst = () => {
      let n = randInt(T().burstKeys);
      const step = () => {
        keystroke();
        if (--n > 0) later(step, rand(T().keyGapMs));
        else later(burst, rand(T().burstPauseMs));
      };
      step();
    };
    later(burst, rand(T().burstPauseMs) / 2);

    return () => {
      timers.forEach(clearTimeout);
      els().forEach((el) => el.getAnimations().forEach((a) => a.cancel()));
    };
  }, [enabled]);
}
