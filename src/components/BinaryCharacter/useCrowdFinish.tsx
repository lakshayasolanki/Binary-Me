import { useCallback, useEffect, useId, useRef, type RefObject } from "react";
import maskUrl from "../../assets/binary-character/person-mask.webp";
import { ENTRANCE_DURATION } from "./crowdMotion";

const FINISH_START = ENTRANCE_DURATION * (2.05 / 3);

/** Static photographic motion residue. Only its arrival is animated; its grain never loops.
 *  `boost` is extra strength added on top at any moment, even before the entrance has reached the finish. */
export function useCrowdFinish(amount: number, scope: RefObject<HTMLDivElement | null>, boost = 0) {
  const id = `crowd-finish-${useId().replace(/:/g, "")}`;
  const blur = useRef<SVGFEGaussianBlurElement>(null);
  const displacement = useRef<SVGFEDisplacementMapElement>(null);
  const amountRef = useRef(amount);
  const boostRef = useRef(0);
  const timeRef = useRef(0);
  const lastValue = useRef(-1);

  const setTime = useCallback((time: number) => {
    timeRef.current = time;
    // Arrives gently during the final landing, then remains in the still photograph.
    const t = Math.max(0, Math.min(1, (time - FINISH_START) / (ENTRANCE_DURATION - FINISH_START)));
    const base = t * t * (3 - 2 * t) * amountRef.current;
    // Boost only applies while the blur is enabled, so switching it off still clears everything.
    const strength = Number((base + (amountRef.current > 0 ? boostRef.current : 0)).toFixed(4));
    if (strength === lastValue.current) return;
    if ((strength > 0) !== (lastValue.current > 0) || lastValue.current < 0) {
      // Bypass the filter entirely during phase one and when the experiment is switched off.
      scope.current?.style.setProperty("--crowd-finish-filter", strength > 0 ? `url(#${id})` : "none");
    }
    lastValue.current = strength;
    blur.current?.setAttribute("stdDeviation", `${0.0041 * strength} ${0.00012 * strength}`);
    displacement.current?.setAttribute("scale", String(0.032 * strength));
  }, [id, scope]);

  useEffect(() => {
    amountRef.current = Number.isFinite(amount) ? Math.max(0, Math.min(2, amount)) : 1;
    boostRef.current = Number.isFinite(boost) ? Math.max(0, Math.min(4, boost)) : 0;
    setTime(timeRef.current);
  }, [amount, boost, setTime]);

  return {
    setTime,
    style: { filter: "var(--crowd-finish-filter, none)" },
    definition: (
      <svg width="0" height="0" aria-hidden="true" focusable="false" className="absolute pointer-events-none">
        <defs>
          <filter id={id} x="-8%" y="-4%" width="116%" height="108%"
            filterUnits="objectBoundingBox" primitiveUnits="objectBoundingBox" colorInterpolationFilters="sRGB">
            {/* Broad horizontal bands give the blur the uneven streaks in the reference. */}
            <feTurbulence type="fractalNoise" baseFrequency="2 110" numOctaves="2" seed="8" result="flow" />
            <feColorMatrix in="flow" type="matrix" values="1 0 0 0 0  0 0 0 0 .5  0 0 0 0 0  0 0 0 0 1" result="horizontalFlow" />
            <feDisplacementMap ref={displacement} in="SourceGraphic" in2="horizontalFlow" scale="0" xChannelSelector="R" yChannelSelector="G" result="streaked" />
            <feGaussianBlur ref={blur} in="streaked" stdDeviation="0 0" result="softMotion" />
            <feComposite in="softMotion" in2="SourceGraphic" operator="arithmetic" k2=".8" k3=".2" result="photograph" />
            {/* Remove only blur spilling into an unoccluded part of ME. Real foreground
                overlap is retained, and the front→still handoff leaves his edge sharp. */}
            <feImage href={maskUrl} x="0" y="0" width="1" height="1" preserveAspectRatio="none" result="subjectMask" />
            <feComponentTransfer in="subjectMask" result="solidSubject"><feFuncA type="linear" slope="4" /></feComponentTransfer>
            <feComposite in="solidSubject" in2="SourceAlpha" operator="out" result="clearSubject" />
            <feComposite in="photograph" in2="clearSubject" operator="out" />
          </filter>
        </defs>
      </svg>
    ),
  };
}
