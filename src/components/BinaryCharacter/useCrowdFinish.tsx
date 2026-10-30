import { useCallback, useEffect, useId, useRef, type RefObject } from "react";
import maskUrl from "../../assets/binary-character/person-mask.webp";
import { ENTRANCE_DURATION } from "./crowdMotion";

const FINISH_START = ENTRANCE_DURATION * (2.05 / 3);
/** Cosmic starts creeping in while the crowd is already slowing, well before it lands. */
const COSMIC_START = ENTRANCE_DURATION * (0.6 / 3);

/** Static photographic motion residue. Only its arrival is animated; its grain never loops.
 *  `boost` is extra strength added on top at any moment, even before the entrance has reached the finish. */
export function useCrowdFinish(amount: number, scope: RefObject<HTMLDivElement | null>, boost = 0, cosmic = false) {
  const id = `crowd-finish-${useId().replace(/:/g, "")}`;
  const blur = useRef<SVGFEGaussianBlurElement>(null);
  const displacement = useRef<SVGFEDisplacementMapElement>(null);
  const trailA = useRef<SVGFEOffsetElement>(null);
  const trailB = useRef<SVGFEOffsetElement>(null);
  const amountRef = useRef(amount);
  const cosmicRef = useRef(cosmic);
  const boostRef = useRef(0);
  const timeRef = useRef(0);
  const lastValue = useRef(-1);
  const lastCosmic = useRef(cosmic);

  const setTime = useCallback((time: number) => {
    timeRef.current = time;
    // Arrives gently during the final landing, then remains in the still photograph.
    const cosmicOn = cosmicRef.current;
    const start = cosmicOn ? COSMIC_START : FINISH_START;
    const t = Math.max(0, Math.min(1, (time - start) / (ENTRANCE_DURATION - start)));
    const base = t * t * (3 - 2 * t) * amountRef.current;
    // Boost only applies while the blur is enabled, so switching it off still clears everything.
    const strength = Number((base + (amountRef.current > 0 ? boostRef.current : 0)).toFixed(4));
    if (strength === lastValue.current && cosmicOn === lastCosmic.current) return;
    lastCosmic.current = cosmicOn;
    if ((strength > 0) !== (lastValue.current > 0) || lastValue.current < 0) {
      // Bypass the filter entirely during phase one and when the experiment is switched off.
      scope.current?.style.setProperty("--crowd-finish-filter", strength > 0 ? `url(#${id})` : "none");
    }
    lastValue.current = strength;
    // Cosmic is the long-exposure smear with ghost trails; off falls back to the original faint residue.
    blur.current?.setAttribute("stdDeviation", cosmicOn ? `${0.011 * strength} ${0.0003 * strength}` : `${0.0041 * strength} ${0.00012 * strength}`);
    displacement.current?.setAttribute("scale", String(cosmicOn ? 0.05 * strength : 0.032 * strength));
    // Ghost trails sweep behind the figures, like a long exposure of people running past.
    trailA.current?.setAttribute("dx", String(cosmicOn ? -0.026 * strength : 0));
    trailB.current?.setAttribute("dx", String(cosmicOn ? -0.052 * strength : 0));
  }, [id, scope]);

  useEffect(() => {
    const blurAmount = Number.isFinite(amount) ? Math.max(0, Math.min(2, amount)) : 1;
    // Cosmic runs the filter on its own, so it never depends on the plain blur toggle.
    amountRef.current = cosmic ? Math.max(blurAmount, 1) : blurAmount;
    cosmicRef.current = cosmic;
    boostRef.current = Number.isFinite(boost) ? Math.max(0, Math.min(4, boost)) : 0;
    setTime(timeRef.current);
  }, [amount, boost, cosmic, setTime]);

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
            <feOffset ref={trailA} in="softMotion" dx="0" dy="0" result="trailA" />
            <feOffset ref={trailB} in="softMotion" dx="0" dy="0" result="trailB" />
            <feComposite in="softMotion" in2="trailA" operator="arithmetic" k2=".6" k3=".4" result="smear1" />
            <feComposite in="smear1" in2="trailB" operator="arithmetic" k2=".72" k3=".28" result="smear2" />
            <feComposite in="smear2" in2="SourceGraphic" operator="arithmetic" k2=".78" k3=".22" result="photograph" />
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
