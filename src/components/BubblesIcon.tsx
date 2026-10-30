import { useEffect, useId, useRef, type SVGProps } from "react";

type Palette = { rim: string; film: string; iris: string[]; frag: string }; // iris: five stops swept across each bubble
type Kind = "rest" | "rise" | "pop" | "grow";
type Bubble = {
  x: number; y: number; r: number; // resting spot and radius
  stagger: number; // s after hover before this one may let go, so they never leave together
  speed: number; // how eager it is to rise (1 = average for its size)
  drift: number; // how far it wanders side to side while rising
  freq: number; // Hz of that wander
  phase: number; // where in the wander it starts (radians)
};

/** Every tunable for the bubbles. Distances are viewBox units (the icon box is 48), times are
 *  seconds, speeds are units per second. The icon is gray at rest and blue while the pointer is
 *  over `.water-host`. While it is, bubbles let go of the cluster one at a time, speed up under
 *  buoyancy until water drag holds them at a steady rise, wander and wobble as they climb, grow a
 *  little as the pressure drops, and pop at the top in a ring of film and a few fragments. A new
 *  bubble then swells back into place. Leaving lets the rising ones finish, then rests. Like the
 *  computer, it sits tilted in 3D and eases toward the pointer. */
const CONFIG = {
  view: { x: 6, y: 3, w: 36, h: 43 }, // the crop; smaller w/h = less empty room around the bubbles
  colorInMs: 300, // ms to turn blue
  colorOutMs: 1200, // ms to turn back to gray
  touchMs: 3000, // how long a tap plays the motion

  // The same 3D feel as the computer icon: a resting tilt, a different tilt on hover, a soft shadow.
  tilt: { perspective: 90, rest: { y: 18, x: -5 }, live: { y: 8, x: -2 }, springMs: 420 },
  shadow: "drop-shadow(0 1.5px 0 rgb(0 0 0 / .22)) drop-shadow(0 3px 2.5px rgb(0 0 0 / .28))",

  // The cluster at rest (three bubbles). Big first (drawn at the back), small last.
  bubbles: [
    { x: 19, y: 31.5, r: 10.5, stagger: 0.55, speed: 1, drift: 1.6, freq: 0.9, phase: 0.4 },
    { x: 32.5, y: 22, r: 7, stagger: 0.12, speed: 1.05, drift: 2.1, freq: 1.25, phase: 2.2 },
    { x: 31.5, y: 39.5, r: 4.6, stagger: 0.9, speed: 0.95, drift: 1.9, freq: 1.5, phase: 4.1 },
  ] as Bubble[],

  physics: {
    buoy: 74, // upward push; higher = they climb faster
    drag: 3.5, // water resistance; higher = they reach their steady speed sooner and it is slower
    sizeExp: 0.5, // bigger bubbles rise faster by size^this (0 = all the same)
    grow: 0.14, // how much a bubble swells over its rise as the pressure drops
    popTop: 5.4, // y where the top of a bubble pops
    popJitter: 2.2, // how much that differs from bubble to bubble
  },
  wobble: { rise: 0.08, riseFreq: 4.6, kick: 0.15, hoverKick: 0.08, freq: 3.6, damping: 3.4, ratio: 0.9 }, // shape wobble: size while rising, its Hz; jiggle after growing back (kick, Hz, how fast it dies); width given up per height gained
  hold: { min: 0.25, max: 1.0, startDelay: 0.1 }, // s a settled bubble waits before it lets go again (random in range)
  regrow: { delayMin: 0.15, delayMax: 0.55, time: 0.8, from: 0.06, overshoot: 1.7 }, // s before a new bubble starts, s it takes to swell in, how small it starts, how far it overshoots
  pop: { time: 0.3, fragments: 6, fragR: 0.6, spread: 1.35, ringGrow: 0.3 }, // how long the burst lasts, how many specks, their size, how far they fly, how far the film ring expands

  // A bubble is drawn once at radius 10 and scaled to size.
  art: {
    highlight: "M-6.4 -3.6C-5.6 -6.2 -3.2 -8 -0.6 -8.4C-2.8 -7.2 -4.6 -5.6 -5.6 -3.2C-6 -2.2 -6.5 -2.8 -6.4 -3.6Z",
    reflection: "M6.5 3.6C5.8 5.9 4 7.4 1.7 8.1",
    glint: { x: -1.3, y: -5.9, r: 0.75 },
    depth: { x: 0.6, y: 0.9, opacity: 0.13 }, // the thin dark ring offset down-right behind each bubble, for thickness
    shade: { opacity: 0.28 }, // how dark the lower-right of the sphere gets (light comes from the top-left)
    glow: { x: -3.6, y: -4, r: 4.6, opacity: 0.6 }, // the soft white glow behind the highlight
    caustic: { x: 4.4, y: 4.8, r: 3.4, opacity: 0.55 }, // the bright spot where light focuses on the far side
    parallax: 10, // how far the highlight slides as a bubble wobbles
    band: { width: 3.2, opacity: 0.8 }, // the colored soap-film band just inside the rim
    inner: { width: 1.1, opacity: 0.4 }, // a thinner second band inside it, for depth
    turn: 60, // degrees each bubble's color sweep is turned by its phase, so no two match
  },

  // Gray at rest; on hover the real soap-film colors (cyan, violet, magenta, gold, green) show through. Rim, film tint, the five sheen stops, and the popped specks.
  colors: {
    light: {
      rest: { rim: "#8d9292", film: "#a9aeae", iris: ["#c9cdcd", "#a7acac", "#bcc0c0", "#9ea3a3", "#c2c6c6"], frag: "#a9aeae" },
      live: { rim: "#8cb8e6", film: "#b8dcff", iris: ["#22c4f0", "#7a74ff", "#ec5ccb", "#f4b03a", "#3fd9a0"], frag: "#a8e2ff" },
    },
    dark: {
      rest: { rim: "#a3a8a8", film: "#b6baba", iris: ["#d2d6d6", "#aeb3b3", "#c4c8c8", "#a6abab", "#cbcfcf"], frag: "#b6baba" },
      live: { rim: "#a8c8f0", film: "#c4e2ff", iris: ["#3fd2f8", "#8f88ff", "#f070d4", "#ffc24d", "#58e8b0"], frag: "#b6e8ff" },
    },
  } as Record<"light" | "dark", { rest: Palette; live: Palette }>,
};

const R0 = 10; // the radius a bubble is drawn at before scaling
const TAU = Math.PI * 2;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (v: number) => v * v * (3 - 2 * v);
const easeOut3 = (v: number) => 1 - (1 - v) ** 3;
const easeOutBack = (v: number, s: number) => 1 + (s + 1) * (v - 1) ** 3 + s * (v - 1) ** 2;
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const vars = (p: Palette) => `--c-rim:${p.rim};--c-film:${p.film};${p.iris.map((c, k) => `--c-i${k}:${c};`).join("")}--c-frag:${p.frag};`;

type Rt = {
  kind: Kind;
  st: number; // seconds in the current state
  wait: number; // seconds left before a settled bubble lets go
  x: number; y: number; v: number; // while rising: position and speed
  size: number; // while rising: how swollen it is
  popX: number; popY: number; popR: number; angles: number[]; // where and how big it was when it popped
  growWait: number; // s a popped bubble waits before its replacement starts
  wobAmp: number; wobT: number;
};

/** A cluster of glossy bubbles that rise, wobble and pop. */
export function BubblesIcon({ className = "", ...props }: SVGProps<SVGSVGElement>) {
  const uid = useId().replace(/:/g, "");
  const scope = `bb${uid}`;
  const svgRef = useRef<SVGSVGElement>(null);
  const { light, dark } = CONFIG.colors;
  const { view: V, tilt: T, art: A } = CONFIG;
  const tiltCss = (t: { y: number; x: number }) => `perspective(${T.perspective}px) rotateY(${t.y}deg) rotateX(${t.x}deg)`;
  const hostLive = `.water-host:hover .${scope}`;
  const css = `
.${scope}{${vars(light.rest)}overflow:visible;filter:${CONFIG.shadow};transform:${tiltCss(T.rest)};transition:transform ${T.springMs}ms cubic-bezier(0.34,1.56,0.64,1)}
:root.dark .${scope}{${vars(dark.rest)}}
.${scope}[data-live]{${vars(light.live)}transform:${tiltCss(T.live)}}
:root.dark .${scope}[data-live]{${vars(dark.live)}}
.${scope} stop{transition:stop-color ${CONFIG.colorOutMs}ms ease}
.${scope} [data-rim],.${scope} [data-pring]{fill:none;stroke:var(--c-rim);transition:stroke ${CONFIG.colorOutMs}ms ease}
.${scope} [data-frag]{fill:var(--c-frag);transition:fill ${CONFIG.colorOutMs}ms ease}
.${scope}[data-live] stop,.${scope}[data-live] [data-rim],.${scope}[data-live] [data-pring],.${scope}[data-live] [data-frag]{transition-duration:${CONFIG.colorInMs}ms}
@media (hover:hover){
${hostLive}{${vars(light.live)}transform:${tiltCss(T.live)}}
:root.dark ${hostLive}{${vars(dark.live)}}
${hostLive} stop,${hostLive} [data-rim],${hostLive} [data-pring],${hostLive} [data-frag]{transition-duration:${CONFIG.colorInMs}ms}
}
@media (prefers-reduced-motion:reduce){
.${scope},${hostLive}{transition:none;transform:${tiltCss(T.rest)}}
}`;

  useEffect(() => {
    const svg = svgRef.current;
    const host = svg?.closest<HTMLElement>(".water-host");
    if (!svg || !host) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const { bubbles: BS, physics: P, wobble: W, hold: H, regrow: RG, pop: PO } = CONFIG;
    const el = BS.map((_, i) => ({
      bub: svg.querySelector<SVGGElement>(`[data-bub="${i}"]`)!,
      ring: svg.querySelector<SVGCircleElement>(`[data-pring="${i}"]`)!,
      frags: [...svg.querySelectorAll<SVGCircleElement>(`[data-frag="${i}"]`)],
      hl: svg.querySelector<SVGGElement>(`[data-bub="${i}"] [data-hl]`)!,
    }));
    const rt: Rt[] = BS.map((b) => ({
      kind: "rest", st: 0, wait: 0, x: b.x, y: b.y, v: 0, size: 1,
      popX: 0, popY: 0, popR: 0, angles: [], growWait: 0, wobAmp: 0, wobT: 99,
    }));
    const stopAt = BS.map(() => P.popTop);

    let active = false;
    let raf = 0;
    let last = 0;
    let touchTimer = 0;

    const wobble = (r: Rt) => r.wobAmp * Math.exp(-W.damping * r.wobT) * Math.sin(TAU * W.freq * r.wobT);

    const render = () => {
      BS.forEach((b, i) => {
        const s = rt[i];
        const e = el[i];
        let x = b.x;
        let y = b.y;
        let size = 1;
        let w = 0;
        let op = 1;

        if (s.kind === "rest") {
          w = wobble(s);
        } else if (s.kind === "rise") {
          const ramp = smooth(clamp01(s.st / 0.6)); // starts straight up, then starts to wander
          x = s.x + b.drift * ramp * (Math.sin(TAU * b.freq * s.st + b.phase) + 0.35 * Math.sin(TAU * b.freq * 2.3 * s.st + b.phase * 1.7));
          y = s.y;
          size = s.size;
          w = W.rise * ramp * Math.sin(TAU * W.riseFreq * s.st + b.phase * 2);
        } else if (s.kind === "pop") {
          op = 0;
        } else {
          const u = clamp01((s.st - s.growWait) / RG.time);
          size = u <= 0 ? 0 : lerp(RG.from, 1, easeOutBack(u, RG.overshoot));
          op = clamp01(u / 0.15);
        }
        const k = (b.r * size) / R0;
        e.bub.setAttribute("transform", `translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${(k * (1 + w)).toFixed(4)} ${(k * (1 - W.ratio * w)).toFixed(4)})`);
        e.bub.setAttribute("opacity", op.toFixed(3));
        e.hl.setAttribute("transform", `translate(${(-w * CONFIG.art.parallax).toFixed(3)} ${(-w * CONFIG.art.parallax * 1.2).toFixed(3)})`);

        // The burst: the film ring spreads and thins, and a few specks fly out and fade.
        if (s.kind === "pop") {
          const u = clamp01(s.st / PO.time);
          const out = easeOut3(u);
          e.ring.setAttribute("cx", s.popX.toFixed(2));
          e.ring.setAttribute("cy", s.popY.toFixed(2));
          e.ring.setAttribute("r", (s.popR * (1 + PO.ringGrow * out)).toFixed(2));
          e.ring.setAttribute("stroke-width", (0.9 * (1 - u) + 0.1).toFixed(2));
          e.ring.setAttribute("opacity", (0.9 * (1 - u) ** 1.3).toFixed(3));
          e.frags.forEach((f, k2) => {
            const a = s.angles[k2];
            const d = s.popR * (0.85 + PO.spread * out);
            f.setAttribute("cx", (s.popX + Math.cos(a) * d).toFixed(2));
            f.setAttribute("cy", (s.popY + Math.sin(a) * d + 1.6 * u * u).toFixed(2));
            f.setAttribute("r", (PO.fragR * (1 - 0.7 * u)).toFixed(2));
            f.setAttribute("opacity", ((1 - u) ** 1.1).toFixed(3));
          });
        } else {
          e.ring.setAttribute("opacity", "0");
          e.frags.forEach((f) => f.setAttribute("opacity", "0"));
        }
      });
    };

    const busy = () => active || rt.some((s) => s.kind !== "rest" || Math.abs(s.wobAmp * Math.exp(-W.damping * s.wobT)) > 0.002);

    const step = (dt: number) => {
      rt.forEach((s, i) => {
        const b = BS[i];
        s.st += dt;
        s.wobT += dt;
        if (s.kind === "rest") {
          if (active) {
            s.wait -= dt;
            if (s.wait <= 0) {
              s.kind = "rise";
              s.st = 0;
              s.x = b.x;
              s.y = b.y;
              s.v = 0;
              s.size = 1;
              stopAt[i] = P.popTop + Math.random() * P.popJitter;
            }
          }
        } else if (s.kind === "rise") {
          // Buoyancy pushes up, drag pushes back, so it speeds up and then holds a steady climb.
          const push = P.buoy * (b.r / 6) ** P.sizeExp * b.speed;
          s.v += (push - P.drag * s.v) * dt;
          s.y -= s.v * dt;
          s.size = 1 + P.grow * smooth(clamp01((b.y - s.y) / Math.max(1, b.y - stopAt[i] - b.r)));
          if (s.y - b.r * s.size <= stopAt[i]) {
            const ramp = smooth(clamp01(s.st / 0.6));
            s.popX = b.x + b.drift * ramp * (Math.sin(TAU * b.freq * s.st + b.phase) + 0.35 * Math.sin(TAU * b.freq * 2.3 * s.st + b.phase * 1.7));
            s.popY = s.y;
            s.popR = b.r * s.size;
            s.angles = Array.from({ length: PO.fragments }, (_, k) => (k / PO.fragments) * TAU + rand(-0.35, 0.35));
            s.kind = "pop";
            s.st = 0;
          }
        } else if (s.kind === "pop") {
          if (s.st >= PO.time) {
            s.kind = "grow";
            s.st = 0;
            s.growWait = rand(RG.delayMin, RG.delayMax);
          }
        } else if (s.st - s.growWait >= RG.time) {
          s.kind = "rest";
          s.st = 0;
          s.wait = rand(H.min, H.max) + b.stagger * 0.4;
          s.wobT = 0;
          s.wobAmp = W.kick;
        }
      });
    };

    const frame = (now: number) => {
      raf = 0;
      step(Math.min(0.05, (now - last) / 1000));
      last = now;
      if (!busy()) {
        rt.forEach((s) => (s.wobAmp = 0));
        return render();
      }
      render();
      raf = requestAnimationFrame(frame);
    };

    const set = (on: boolean) => {
      const was = active;
      active = on && !reduced.matches;
      if (active && !was) {
        rt.forEach((s, i) => {
          if (s.kind !== "rest") return;
          s.wait = BS[i].stagger + H.startDelay + Math.random() * 0.15;
          if (s.wobT > 0.5) {
            s.wobT = 0;
            s.wobAmp = W.hoverKick;
          }
        });
      }
      if (busy() && !raf) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    const onEnter = (e: PointerEvent) => e.pointerType !== "touch" && set(true);
    const onLeave = (e: PointerEvent) => e.pointerType !== "touch" && set(false);
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      window.clearTimeout(touchTimer);
      svg.setAttribute("data-live", "");
      set(true);
      touchTimer = window.setTimeout(() => {
        svg.removeAttribute("data-live");
        set(false);
      }, CONFIG.touchMs);
    };

    render();
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

  return (
    <svg
      ref={svgRef}
      className={`${scope} ${className}`}
      viewBox={`${V.x} ${V.y} ${V.w} ${V.h}`}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <style>{css}</style>
      <defs>
        <radialGradient id={`${scope}-sphere`} fx=".34" fy=".28">
          <stop style={{ stopColor: "var(--c-film)", stopOpacity: 0.02 }} />
          <stop offset=".55" style={{ stopColor: "var(--c-film)", stopOpacity: 0.1 }} />
          <stop offset=".85" style={{ stopColor: "var(--c-film)", stopOpacity: 0.28 }} />
          <stop offset="1" style={{ stopColor: "var(--c-film)", stopOpacity: 0.55 }} />
        </radialGradient>
        <linearGradient id={`${scope}-shade`} x1=".2" y1=".1" x2=".85" y2=".95">
          <stop stopColor="#102040" stopOpacity="0" />
          <stop offset=".55" stopColor="#102040" stopOpacity="0" />
          <stop offset="1" stopColor="#102040" stopOpacity={A.shade.opacity} />
        </linearGradient>
        <radialGradient id={`${scope}-glow`}>
          <stop stopColor="#fff" stopOpacity={A.glow.opacity} />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${scope}-caus`}>
          <stop stopColor="#fff" stopOpacity={A.caustic.opacity} />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        {CONFIG.bubbles.map((b, i) => (
          <linearGradient key={i} id={`${scope}-iris${i}`} x1="0" y1="0" x2="1" y2="1" gradientTransform={`rotate(${Math.round(b.phase * A.turn)} .5 .5)`}>
            {[0, 1, 2, 3, 4].map((k) => (
              <stop key={k} offset={k / 4} style={{ stopColor: `var(--c-i${k})` }} />
            ))}
          </linearGradient>
        ))}
        <clipPath id={`${scope}-view`}>
          <rect x={V.x} y={V.y} width={V.w} height={V.h} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${scope}-view)`}>
        {CONFIG.bubbles.map((b, i) => (
          <g key={i} data-bub={i} transform={`translate(${b.x} ${b.y}) scale(${b.r / R0})`}>
            <circle cx={A.depth.x} cy={A.depth.y} r={R0} fill="none" stroke="#000" strokeOpacity={A.depth.opacity} strokeWidth="1" />
            <circle r={R0} fill={`url(#${scope}-sphere)`} />
            <circle r={R0} fill={`url(#${scope}-shade)`} />
            <circle r={R0 - A.band.width / 2} fill="none" stroke={`url(#${scope}-iris${i})`} strokeWidth={A.band.width} opacity={A.band.opacity} />
            <circle r={R0 - A.band.width - 1} fill="none" stroke={`url(#${scope}-iris${i})`} strokeWidth={A.inner.width} opacity={A.inner.opacity} />
            <circle data-rim r={R0} strokeWidth=".9" opacity=".9" />
            <circle cx={A.caustic.x} cy={A.caustic.y} r={A.caustic.r} fill={`url(#${scope}-caus)`} />
            <path d={A.reflection} fill="none" stroke="#fff" strokeWidth="1" strokeLinecap="round" opacity=".5" />
            <g data-hl>
              <circle cx={A.glow.x} cy={A.glow.y} r={A.glow.r} fill={`url(#${scope}-glow)`} />
              <path d={A.highlight} fill="#fff" opacity=".9" />
              <circle cx={A.glint.x} cy={A.glint.y} r={A.glint.r} fill="#fff" opacity=".95" />
            </g>
          </g>
        ))}
        {CONFIG.bubbles.map((_, i) => (
          <g key={i}>
            <circle data-pring={i} r="1" opacity="0" />
            {Array.from({ length: CONFIG.pop.fragments }, (_, k) => (
              <circle key={k} data-frag={i} r="0.5" opacity="0" />
            ))}
          </g>
        ))}
      </g>
    </svg>
  );
}
