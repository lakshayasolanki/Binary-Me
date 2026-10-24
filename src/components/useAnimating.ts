import { useEffect, useRef, useState } from "react";
import { haptic } from "./haptic";

/** True for `ms` after `start()` is called; a new call restarts the window. Drives the
 *  `data-animating` flag that tints icon buttons with the binary color mid-animation. Also taps haptically. */
export function useAnimating(ms = 260) {
  const [animating, setAnimating] = useState(false);
  const timer = useRef<number>(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const start = () => {
    haptic();
    window.clearTimeout(timer.current);
    setAnimating(true);
    timer.current = window.setTimeout(() => setAnimating(false), ms);
  };

  return [animating, start] as const;
}
