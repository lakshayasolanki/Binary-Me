import { useEffect, useId, useLayoutEffect, useRef, type SVGProps } from "react";

/** Every tunable for the flower. Distances are viewBox units: the art is drawn in a 40 box that is
 *  shown at about 20px, so one unit is half a pixel and anything thinner than 1 unit disappears.
 *  Times are seconds. The bloom is one timeline (`time`, 0 = bud, `end` = full bloom) that runs
 *  forward while the pointer is over `.water-host` and backward when it leaves, so closing is the
 *  opening played gently in reverse. */
const CONFIG = {
  // The art is drawn in a 40 x 40 space and cropped tight to the flower, so there is no empty margin
  // pushing it away from the word: x from `x` for `width`, y from 0 for `height`.
  view: { x: 8, width: 26, height: 36 },
  touchMs: 3500, // how long a tap holds the bloom

  // The same 3D feel as the computer icon: a resting tilt, a straighter one while it blooms, a soft shadow.
  tilt: { perspective: 90, rest: { y: 18, x: -5 }, live: { y: 8, x: -2 }, springMs: 420 },
  shadow: {
    light: "drop-shadow(0 1.5px 0 rgb(0 0 0 / .25)) drop-shadow(0 3px 2.5px rgb(0 0 0 / .32))",
    // A dark shadow vanishes on a dark page, so there it becomes a thin cool rim light and a soft blue glow.
    dark: "drop-shadow(0 0 0.5px rgb(170 185 255 / .55)) drop-shadow(0 2px 6px rgb(70 90 255 / .30))",
  },

  // The timeline. Slow start, quick middle, slow end comes from the easing on each part.
  time: {
    hold: 0.35, // the bud sits still, then trembles, before anything moves
    stagger: 0.11, // gap between one petal starting and the next (outer petals first)
    petal: 1.7, // how long one petal takes to open
    leafLag: 0.45, // leaves start this long after the bloom begins
    leafGap: 0.16, // and the second leaf this long after the first
    leaf: 1.5,
    stemLag: 0.2,
    stem: 1.8,
    settle: 0.45, // extra time after the last part stops, for the overshoot to settle
    closeSpeed: 0.8, // closing runs at this fraction of opening speed (lower = slower close)
  },

  // Petal motion.
  motion: {
    overshoot: 0.5, // how far petals swing past fully open before settling (0 = none)
    curl: { shorten: 0.16, bend: 2.2, flare: 0.22 }, // tip curled in: lost length, sideways bend (units), how far it flares back at the end
    restBend: 0.8, // the soft sideways lean a finished petal keeps, so it never looks like a stiff paddle
    release: 0.45, // fraction of the petal's opening that passes before its tip lets go
    twist: 14, // degrees the whole head turns while opening
    leafOvershoot: 0.5,
  },

  // The bud trembles, then the finished flower settles and keeps breathing while the pointer stays.
  tremble: { deg: 1.7, shift: 0.3, hz: 11 },
  settle: { deg: 2.6, hz: 1.1, damping: 1.7 },
  idle: { swayDeg: 1.5, swayPeriod: 6.5, breathe: 0.03, breathePeriod: 4.2, rampIn: 1.5 },

  // Where the flower sits, bud and bloom. The head follows the top of the stem.
  stem: {
    width: 2.2,
    bud: [22, 15.5, 22.5, 21, 18.5, 25, 20, 34], // start, two control points, end
    open: [20, 13.5, 19, 20, 22.5, 25, 20, 34],
  },

  // One petal is a pointed leaf shape built from length L, half-width w and sideways bend.
  // Listed back to front, which is also the order they open in. Open angles step 144 degrees each (the way real petals are
  // arranged), so the delays unwrap the bud in a spiral that alternates sides.
  petals: [
    { bud: { angle: -9, w: 3.1, L: 13.4 }, open: { angle: 0, w: 6, L: 11.6 } },
    { bud: { angle: 9, w: 3.1, L: 13.4 }, open: { angle: 144, w: 6, L: 11.6 } },
    { bud: { angle: -4, w: 3.7, L: 13.9 }, open: { angle: -72, w: 6, L: 11.6 } },
    { bud: { angle: 4, w: 3.7, L: 13.9 }, open: { angle: 72, w: 6, L: 11.6 } },
    { bud: { angle: 0, w: 4.2, L: 14.4 }, open: { angle: -144, w: 6, L: 11.6 } },
  ],
  center: { r: 2.5, swell: 0.2, revealFrom: 0.3, revealSpan: 0.4 }, // hidden in the bud, shown as the petals part, then swells

  leaf: "M0 0C-3.4 -1.6 -3.6 -5.8 0 -8.6C3.6 -5.8 3.4 -1.6 0 0Z",
  leaves: [
    { at: 0.65, bud: { angle: 30, s: 0.55 }, open: { angle: 64, s: 1 } },
    { at: 0.82, bud: { angle: -30, s: 0.55 }, open: { angle: -62, s: 1 } },
  ],

  // Royal blue petals with a cream tip, a pale yellow centre, green leaves. The dark set is lifted so
  // the flower glows against a black page instead of sinking into it.
  colors: {
    light: {
      petal: ["#1d1b9c", "#3342e0", "#5a6ef0", "#f2f1df"], // base, mid, light, cream tip
      center: ["#fff6a8", "#f0d94c", "#c99a1e"], // a small ball: lit top-left, shaded bottom-right
      fold: "#0b0a5c", // the darker half of each petal
      foldOpacity: 0.26,
      rib: "#ffffff", // the crease that catches light
      stem: "#4a9a2e",
      leaf: "#3dae3a",
    },
    dark: {
      petal: ["#3338d4", "#5266ff", "#8ea2ff", "#f6f4e8"],
      center: ["#fffbc4", "#ffe566", "#e0a928"],
      fold: "#0a0950",
      foldOpacity: 0.26,
      rib: "#ffffff",
      stem: "#6cc24a",
      leaf: "#5bd05a",
    },
  },
  fold: { ribOpacity: 0.42 },
};

const T = CONFIG.time;
const PETAL_L = 12; // the gradient runs this far up a petal
const TAU = Math.PI * 2;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (v: number) => v * v * (3 - 2 * v);
const inOut = (v: number) => (1 - Math.cos(Math.PI * v)) / 2;
const inOutBack = (v: number, s: number) => {
  const c = 1.70158 * s * 1.525;
  return v < 0.5 ? ((2 * v) ** 2 * ((c + 1) * 2 * v - c)) / 2 : ((2 * v - 2) ** 2 * ((c + 1) * (2 * v - 2) + c) + 2) / 2;
};
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const f = (v: number) => v.toFixed(2);

const END = Math.max(
  T.hold + (CONFIG.petals.length - 1) * T.stagger + T.petal,
  T.hold + T.leafLag + T.leafGap + T.leaf,
  T.hold + T.stemLag + T.stem,
) + T.settle;

const bezier = (p: number[], t: number) => {
  const u = 1 - t;
  const at = (a: number, b: number, c: number, d: number) => u ** 3 * a + 3 * u * u * t * b + 3 * u * t * t * c + t ** 3 * d;
  return { x: at(p[0], p[2], p[4], p[6]), y: at(p[1], p[3], p[5], p[7]) };
};

const petalPath = (L: number, w: number, bend: number) =>
  `M0 0C${f(-0.94 * w)} ${f(-0.13 * L)} ${f(-1.03 * w + bend * 0.5)} ${f(-0.61 * L)} ${f(bend)} ${f(-L)}` +
  `C${f(1.03 * w + bend * 0.5)} ${f(-0.61 * L)} ${f(0.94 * w)} ${f(-0.13 * L)} 0 0Z`;

type Refs = { stem: SVGPathElement; leaves: SVGPathElement[]; head: SVGGElement; petals: SVGGElement[]; parts: SVGPathElement[][]; center: SVGCircleElement };
type Fx = { rot: number; dx: number; scale: number }; // extra whole-head motion on top of the bloom

const grab = (g: SVGGElement): Refs => ({
  stem: g.querySelector("[data-stem]")!,
  leaves: [...g.querySelectorAll<SVGPathElement>("[data-leaf]")],
  head: g.querySelector("[data-head]")!,
  petals: [...g.querySelectorAll<SVGGElement>("[data-petal]")],
  parts: [...g.querySelectorAll<SVGGElement>("[data-petal]")].map((p) => [...p.querySelectorAll("path")]),
  center: g.querySelector("[data-center]")!,
});

/** Poses every part of one flower for a moment on the bloom timeline. */
function draw(r: Refs, time: number, fx: Fx) {
  const { petals: PS, motion: M, stem: S, center: CE } = CONFIG;
  const stemE = inOut(clamp01((time - T.hold - T.stemLag) / T.stem));
  const sp = S.bud.map((v, i) => lerp(v, S.open[i], stemE));
  r.stem.setAttribute("d", `M${f(sp[0])} ${f(sp[1])}C${f(sp[2])} ${f(sp[3])} ${f(sp[4])} ${f(sp[5])} ${f(sp[6])} ${f(sp[7])}`);

  CONFIG.leaves.forEach((l, i) => {
    const e = inOutBack(clamp01((time - T.hold - T.leafLag - i * T.leafGap) / T.leaf), M.leafOvershoot);
    const at = bezier(sp, l.at);
    r.leaves[i].setAttribute("transform", `translate(${f(at.x)} ${f(at.y)}) rotate(${f(lerp(l.bud.angle, l.open.angle, e))}) scale(${f(lerp(l.bud.s, l.open.s, e))})`);
  });

  let meanOpen = 0;
  PS.forEach((p, k) => {
    const rr = clamp01((time - T.hold - k * T.stagger) / T.petal);
    const e = inOutBack(rr, M.overshoot);
    meanOpen += inOut(rr) / PS.length;
    // The body swings out first; the tip stays curled in and lets go last, then flares a little back.
    const cup = smooth(clamp01(rr / 0.35));
    const rel = clamp01((rr - M.release) / (1 - M.release));
    const tip = inOut(rel);
    const flare = Math.sin(Math.PI * clamp01((rel - 0.6) / 0.4)) * M.curl.flare;
    const curl = cup * (1 - tip) - flare;
    const L = lerp(p.bud.L, p.open.L, e) * (1 - M.curl.shorten * curl);
    const w = lerp(p.bud.w, p.open.w, e) * (1 - 0.1 * curl);
    const bend = M.curl.bend * curl + M.restBend * smooth(clamp01(rr * 2));
    const [body, shade, rib] = r.parts[k];
    body.setAttribute("d", petalPath(L, w, bend));
    shade.setAttribute("d", `M0 0L${f(bend)} ${f(-L)}C${f(1.03 * w + bend * 0.5)} ${f(-0.61 * L)} ${f(0.94 * w)} ${f(-0.13 * L)} 0 0Z`);
    rib.setAttribute("d", `M0 -0.8L${f(bend * 0.8)} ${f(-L * 0.8)}`);
    r.petals[k].setAttribute("transform", `rotate(${f(lerp(p.bud.angle, p.open.angle, e))})`);
  });

  const reveal = smooth(clamp01((meanOpen - CE.revealFrom) / CE.revealSpan));
  const swell = 1 + CE.swell * smooth(clamp01((meanOpen - 0.7) / 0.3));
  r.center.setAttribute("r", f(CE.r * reveal * swell));

  const twist = M.twist * meanOpen;
  r.head.setAttribute("transform", `translate(${f(sp[0] + fx.dx)} ${f(sp[1])}) rotate(${f(twist + fx.rot)}) scale(${f(fx.scale)})`);
}

/** A blue five-petal flower that blooms like a time-lapse while its word is hovered. */
export function FlowerIcon({ className = "", ...props }: SVGProps<SVGSVGElement>) {
  const uid = useId().replace(/:/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const F = CONFIG.fold;

  const flower = (key: string, attrs: Record<string, string> = {}) => (
    <g key={key} {...attrs}>
      <path data-stem fill="none" style={{ stroke: "var(--f-stem)" }} strokeWidth={CONFIG.stem.width} strokeLinecap="round" />
      {CONFIG.leaves.map((_, i) => (
        <path key={i} data-leaf d={CONFIG.leaf} style={{ fill: "var(--f-leaf)" }} />
      ))}
      <g data-head>
        {CONFIG.petals.map((_, i) => (
          <g key={i} data-petal>
            <path fill={`url(#${uid}-p)`} />
            <path style={{ fill: "var(--f-fold)", fillOpacity: "var(--f-fo)" }} />
            <path fill="none" style={{ stroke: "var(--f-rib)" }} strokeOpacity={F.ribOpacity} strokeWidth="1" strokeLinecap="round" />
          </g>
        ))}
        <circle data-center r="0" fill={`url(#${uid}-c)`} />
      </g>
    </g>
  );

  // First paint shows the bud, before any hover.
  useLayoutEffect(() => {
    const svg = svgRef.current!;
    const calm: Fx = { rot: 0, dx: 0, scale: 1 };
    draw(grab(svg.querySelector("[data-main]")!), 0, calm);
    draw(grab(svg.querySelector("[data-bud]")!), 0, calm);
    draw(grab(svg.querySelector("[data-open]")!), END, calm);
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    const host = svg?.closest<HTMLElement>(".water-host");
    if (!svg || !host) return;
    const main = grab(svg.querySelector("[data-main]")!);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const { tremble: TR, settle: SE, idle: ID } = CONFIG;
    let time = 0; // position on the bloom timeline
    let since = -1; // seconds since the bloom finished (-1 while it has not)
    let clock = 0;
    let active = false;
    let raf = 0;
    let last = 0;
    let touchTimer = 0;

    const render = () => {
      const trembling = active && time < T.hold + 0.15 && time > 0 ? Math.sin((Math.PI * time) / (T.hold + 0.15)) : 0;
      const ramp = since >= 0 ? smooth(clamp01(since / ID.rampIn)) : 0;
      const settle = since >= 0 ? SE.deg * Math.exp(-SE.damping * since) * Math.sin(TAU * SE.hz * since) : 0;
      draw(main, time, {
        rot: trembling * TR.deg * Math.sin(TAU * TR.hz * clock) + settle + ramp * ID.swayDeg * Math.sin((TAU * clock) / ID.swayPeriod),
        dx: trembling * TR.shift * Math.sin(TAU * TR.hz * 0.9 * clock + 1),
        scale: 1 + ramp * ID.breathe * Math.sin((TAU * clock) / ID.breathePeriod),
      });
    };

    const frame = (now: number) => {
      raf = 0;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      clock += dt;
      if (active) {
        if (time < END) {
          time = Math.min(END, time + dt);
          since = time >= END ? 0 : -1;
        } else since += dt;
      } else if (time > 0) {
        time = Math.max(0, time - dt * T.closeSpeed);
        since = -1;
      }
      render();
      if (active || time > 0) raf = requestAnimationFrame(frame);
    };

    const set = (on: boolean) => {
      active = on;
      svg.toggleAttribute("data-live", on);
      if (reduced.matches) {
        svg.toggleAttribute("data-open-state", on);
        return;
      }
      if (!raf && (active || time > 0)) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    const onEnter = (e: PointerEvent) => e.pointerType !== "touch" && set(true);
    const onLeave = (e: PointerEvent) => e.pointerType !== "touch" && set(false);
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      window.clearTimeout(touchTimer);
      set(true);
      touchTimer = window.setTimeout(() => set(false), CONFIG.touchMs);
    };

    host.addEventListener("pointerenter", onEnter);
    host.addEventListener("pointerleave", onLeave);
    host.addEventListener("pointerdown", onDown);
    return () => {
      host.removeEventListener("pointerenter", onEnter);
      host.removeEventListener("pointerleave", onLeave);
      host.removeEventListener("pointerdown", onDown);
      window.clearTimeout(touchTimer);
      cancelAnimationFrame(raf);
    };
  }, []);

  const tiltCss = (t: { y: number; x: number }) => `perspective(${CONFIG.tilt.perspective}px) rotateY(${t.y}deg) rotateX(${t.x}deg)`;
  const vars = (c: typeof CONFIG.colors.light) =>
    `--f-p0:${c.petal[0]};--f-p1:${c.petal[1]};--f-p2:${c.petal[2]};--f-p3:${c.petal[3]};--f-c0:${c.center[0]};--f-c1:${c.center[1]};--f-c2:${c.center[2]};--f-fold:${c.fold};--f-fo:${c.foldOpacity};--f-rib:${c.rib};--f-stem:${c.stem};--f-leaf:${c.leaf};`;
  const css = `
.${uid}-r{${vars(CONFIG.colors.light)}overflow:visible;filter:${CONFIG.shadow.light};transform:${tiltCss(CONFIG.tilt.rest)};transition:transform ${CONFIG.tilt.springMs}ms cubic-bezier(0.34,1.56,0.64,1)}
:root.dark .${uid}-r{${vars(CONFIG.colors.dark)}filter:${CONFIG.shadow.dark}}
.${uid}-r[data-live]{transform:${tiltCss(CONFIG.tilt.live)}}
.${uid}-r [data-bud],.${uid}-r [data-open]{display:none}
@media (prefers-reduced-motion:reduce){
.${uid}-r,.${uid}-r[data-live]{transition:none;transform:${tiltCss(CONFIG.tilt.rest)}}
.${uid}-r [data-main]{display:none}
.${uid}-r [data-bud],.${uid}-r [data-open]{display:inline;transition:opacity 350ms ease}
.${uid}-r [data-open]{opacity:0}
.${uid}-r[data-open-state] [data-open]{opacity:1}
.${uid}-r[data-open-state] [data-bud]{opacity:0}
.${uid}-r:not([data-open-state]) [data-bud]{opacity:1}
}
@media (hover:none){.${uid}-r{touch-action:manipulation}}`;

  return (
    <svg ref={svgRef} className={`${uid}-r ${className}`} viewBox={`${CONFIG.view.x} 0 ${CONFIG.view.width} ${CONFIG.view.height}`} aria-hidden="true" focusable="false" {...props}>
      <style>{css}</style>
      <defs>
        <linearGradient id={`${uid}-p`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={-PETAL_L}>
          <stop style={{ stopColor: "var(--f-p0)" }} />
          <stop offset=".6" style={{ stopColor: "var(--f-p1)" }} />
          <stop offset=".88" style={{ stopColor: "var(--f-p2)" }} />
          <stop offset="1" style={{ stopColor: "var(--f-p3)" }} />
        </linearGradient>
        <radialGradient id={`${uid}-c`} cx=".35" cy=".3" r=".8">
          <stop style={{ stopColor: "var(--f-c0)" }} />
          <stop offset=".5" style={{ stopColor: "var(--f-c1)" }} />
          <stop offset="1" style={{ stopColor: "var(--f-c2)" }} />
        </radialGradient>
      </defs>
      {flower("main", { "data-main": "" })}
      {flower("bud", { "data-bud": "" })}
      {flower("open", { "data-open": "" })}
    </svg>
  );
}
