import { useEffect, useRef, useState } from "react";

/** Eases toward `target` (rising over roughly `rise` ms, falling over `fall` ms) instead of jumping.
 *  Reduced motion snaps straight to the target. */
export function useEasedValue(target: number, rise = 350, fall = 600) {
  const [value, setValue] = useState(target);
  const current = useRef(target);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      current.current = target;
      setValue(target);
      return;
    }
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const tau = (target > current.current ? rise : fall) / 3;
      current.current += (target - current.current) * (1 - Math.exp(-(now - last) / tau));
      last = now;
      if (Math.abs(target - current.current) < 0.002) current.current = target;
      setValue(current.current);
      if (current.current !== target) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, rise, fall]);

  return value;
}
