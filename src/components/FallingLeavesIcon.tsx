import { useEffect, useId, useRef, type SVGProps } from "react";

const BOX = 40;
const FEATHER = 3; // viewBox units over which leaves fade out at the icon edge

/** Every tunable for the hover motion. Distances are viewBox units (the icon box is 40); a soft
 *  mask keeps everything inside it. Times are seconds. Colors live in the `.leaves` CSS variables
 *  in index.css. Each leaf loops: fall, land and rock, lie still, fade, re-enter from the top. Leaving the
 *  icon pauses the loop and glides the leaves back to rest; hovering again within that glide resumes
 *  where it left off, and only a full return to rest restarts the loop from the top. */
const CONFIG = {
  rampIn: 0.9, // s for sway, tilt and flip to build up from the resting pose
  blendIn: 0.35, // s to blend from wherever the leaves are into the motion
  exitMs: 450, // glide back to the gray resting pose as soon as the pointer leaves
  touchMs: 3000, // how long a tap plays the motion
  reducedTilt: 4, // deg, the only movement under prefers-reduced-motion
  ground: 33, // y of the text baseline; landed leaves squash toward it and lie on it
  accel: 0.18, // share of a fall spent letting go (ease-in) before steady speed
  decel: 0.4, // share of a fall spent slowing down as the ground gets close
  approach: 0.45, // share of a fall over which sway shrinks and the leaf lays down
  firstApproach: 0.85, // same, for the first fall that starts from the resting pose
  fadeIn: 0.15, // share of a fall spent fading in at the top
  minThin: 0.18, // narrowest the leaf gets when edge-on (1 = never turns)
  flutter: { f1: 2.3, f2: 3.7 }, // rad/s, incommensurate on purpose
  a: {
    rest: { x: 17, y: 32 }, // stem position in the resting pose, also the tilt pivot
    delay: 0, // s before this leaf lets go
    fall: 1.7, // s from the top to touching the ground
    firstFall: 1.3, // s for the first fall, which starts from the resting pose
    rock: 1.1, // s spent rocking after touchdown
    lie: 0.8, // s lying still before fading out
    fadeOut: 0.45, // s fading out where it lies
    enter: 24, // how far above its rest pose it re-enters
    swayPeriod: 1.9, // s per lateral swing
    sway: 0.15, // swing amplitude as a share of the box width
    phase: 0, // swing phase; the leaves use opposite phases
    tilt: 22, // deg of pendulum tilt
    tiltLag: 0.25, // rad the tilt trails the swing
    flipRevs: 0.55, // turns over per loop
    flipSkew: 18, // deg of vertical skew while turning, fakes rotateX
    flutterX: 1.2, // small fast wobble, position
    flutterRot: 4, // small fast wobble, deg
    land: {
      x: 33, // where the stem ends up
      y: 28,
      rot: -55, // deg added to the resting tilt: lying nearly flat, tip raised a little
      squash: 0.42, // vertical squash while lying, so it reads as flat on the ground
      rockAmp: 10, // deg of the first rock
      rockFreq: 1.9, // rocks per second
      rockDamp: 3, // how fast the rocking dies out
    },
  },
  b: {
    rest: { x: 26, y: 34 },
    delay: 0.6,
    fall: 2.0,
    firstFall: 1.5,
    rock: 1.0,
    lie: 1.4,
    fadeOut: 0.5,
    enter: 22,
    swayPeriod: 2.3,
    sway: 0.13,
    phase: Math.PI,
    tilt: 18,
    tiltLag: 0.3,
    flipRevs: 0.4,
    flipSkew: 14,
    flutterX: 1,
    flutterRot: 3.5,
    land: { x: 8, y: 26, rot: 54, squash: 0.42, rockAmp: 8, rockFreq: 2.4, rockDamp: 3 },
  },
};

type LeafCfg = typeof CONFIG.a;
type Pose = { x: number; y: number; rot: number; sx: number; skew: number; sy: number; op: number };

const REST: Pose = { x: 0, y: 0, rot: 0, sx: 1, skew: 0, sy: 1, op: 1 };
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (v: number) => {
  const k = clamp01(v);
  return k * k * (3 - 2 * k);
};
const easeOut = (k: number) => 1 - (1 - k) ** 3;
const mix = (a: Pose, b: Pose, k: number): Pose => ({
  x: a.x + (b.x - a.x) * k,
  y: a.y + (b.y - a.y) * k,
  rot: a.rot + (b.rot - a.rot) * k,
  sx: a.sx + (b.sx - a.sx) * k,
  skew: a.skew + (b.skew - a.skew) * k,
  sy: a.sy + (b.sy - a.sy) * k,
  op: a.op + (b.op - a.op) * k,
});

/** Fall progress 0..1: velocity ramps up over `accel`, holds, then ramps down over `decel`. */
function descent(p: number) {
  const a = CONFIG.accel;
  const d = CONFIG.decel;
  let s: number;
  if (p < a) s = (p * p) / (2 * a);
  else if (p < 1 - d) s = a / 2 + (p - a);
  else {
    const r = (1 - p) / d;
    s = a / 2 + (1 - d - a) + (d / 2) * (1 - r * r);
  }
  return s / (1 - a / 2 - d / 2);
}

/** Where `lt` seconds into a leaf's own timeline falls in its loop. */
function locate(c: LeafCfg, lt: number) {
  const tail = c.rock + c.lie + c.fadeOut;
  const firstLen = c.firstFall + tail;
  const len = c.fall + tail;
  const first = lt < firstLen;
  return { first, len, fallDur: first ? c.firstFall : c.fall, tc: first ? lt : (lt - firstLen) % len };
}

/** Summed sines for one leaf, `lt` seconds after it let go, landing on the ground each loop. */
function pose(c: LeafCfg, lt: number): Pose {
  if (lt <= 0) return REST;
  const { first, len, fallDur, tc } = locate(c, lt);
  const { land } = c;
  const dx = land.x - c.rest.x;
  const dy = land.y - c.rest.y;

  if (tc >= fallDur) {
    const tau = tc - fallDur;
    const rock = tau < c.rock ? land.rockAmp * Math.exp(-land.rockDamp * tau) * Math.sin(2 * Math.PI * land.rockFreq * tau) : 0;
    return { x: dx, y: dy, rot: land.rot + rock, sx: 1, skew: 0, sy: land.squash, op: 1 - smooth((tau - c.rock - c.lie) / c.fadeOut) };
  }

  const p = tc / fallDur;
  const s = descent(p);
  const approach = first ? CONFIG.firstApproach : CONFIG.approach;
  const g = smooth((p - (1 - approach)) / approach); // 0 in the air, 1 at touchdown
  const env = smooth(lt / CONFIG.rampIn);
  const { f1, f2 } = CONFIG.flutter;
  const flutter = 0.6 * Math.sin(f1 * lt + c.phase) + 0.4 * Math.sin(f2 * lt + 1.7 * c.phase);
  const swing = (2 * Math.PI * lt) / c.swayPeriod + c.phase;
  const turn = 2 * Math.PI * c.flipRevs * (lt / len);
  const y0 = first ? 0 : -c.enter;
  const air = (1 - g) * env;
  const sx0 = 1 + (Math.cos(turn) - 1) * env;
  const sx = sx0 + (1 - sx0) * g;
  return {
    x: dx * s + air * (c.sway * BOX * Math.sin(swing) + c.flutterX * flutter),
    y: y0 + (dy - y0) * s,
    rot: air * (-c.tilt * Math.sin(swing - c.tiltLag) + c.flutterRot * flutter) + g * land.rot,
    sx: Math.sign(sx || 1) * Math.max(Math.abs(sx), CONFIG.minThin),
    skew: air * c.flipSkew * Math.sin(turn),
    sy: 1 + (land.squash - 1) * g,
    op: first ? 1 : smooth(p / CONFIG.fadeIn),
  };
}

/** Pointed leaf (A) and rounder leaf (B); the stem sits at 0,0 and the tip points up. */
const LEAF = {
  a: {
    body: "M0 1.5C-8-3.5-10-16 .6-28 9-17 8-4 0 1.5Z",
    left: "M0 1.5C-8-3.5-10-16 .6-28L.2-13Z",
    vein: "M0 3Q.9-12 .5-25",
    side: "M.2-8-3.2-12M.4-13.5 3.4-17.5",
  },
  b: {
    body: "M0 1.5C-11-1-13-14 0-21 13-14 11-1 0 1.5Z",
    left: "M0 1.5C-11-1-13-14 0-21L.2-10Z",
    vein: "M0 3Q.5-9 0-19",
    side: "M.1-6-3.6-9.5M.1-11 3.6-14.5",
  },
};

function Leaf({ id, kind }: { id: string; kind: "a" | "b" }) {
  const { body, left, vein, side } = LEAF[kind];
  return (
    <>
      <g className="leaves__back">
        <path d={body} fill={`url(#${id}-${kind}-back)`} />
        <path d={vein} fill="none" stroke="var(--leaf-edge)" strokeOpacity=".35" strokeWidth="1" />
      </g>
      <g className="leaves__face">
        <path d="M0 1.5 0 5" stroke="var(--leaf-edge)" strokeWidth="1.6" fill="none" />
        <path d={body} fill={`url(#${id}-${kind}-face)`} />
        <path d={left} fill={`url(#${id}-shine)`} />
        <path d={body} fill="none" stroke="var(--leaf-edge)" strokeWidth="1.4" strokeLinejoin="round" />
        <path d={side} fill="none" stroke="var(--leaf-vein)" strokeOpacity=".6" strokeWidth=".8" strokeLinecap="round" />
        <path d={vein} fill="none" stroke="var(--leaf-vein)" strokeWidth="1.1" strokeLinecap="round" />
      </g>
    </>
  );
}

/** Two leaves drifting past each other: gray at rest, emerald and amber on hover,
 *  falling and dancing while the pointer is over the nearest `.leaves-host` ancestor. */
export function FallingLeavesIcon({ className = "", ...props }: SVGProps<SVGSVGElement>) {
  const id = useId();
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    const host = svg?.closest<HTMLElement>(".leaves-host");
    if (!svg || !host) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const parts = (["a", "b"] as const).map((k) => {
      const flip = svg.querySelector(`[data-flip="${k}"]`)!;
      return {
        cfg: CONFIG[k],
        move: svg.querySelector(`[data-move="${k}"]`)!,
        flip,
        face: flip.querySelector<SVGGElement>(".leaves__face")!,
        back: flip.querySelector<SVGGElement>(".leaves__back")!,
      };
    });

    let mode: "idle" | "run" | "exit" = "idle";
    let from: Pose[] = parts.map(() => REST);
    let cur: Pose[] = from;
    let elapsed = 0; // seconds of the loop already played, kept while the leaves glide back so a quick re-hover resumes
    let t0 = 0;
    let raf = 0;
    let touchTimer = 0;

    const paint = () =>
      parts.forEach((l, i) => {
        const q = cur[i];
        const { x, y } = l.cfg.rest;
        const g = CONFIG.ground;
        l.move.setAttribute(
          "transform",
          `translate(0 ${g}) scale(1 ${q.sy.toFixed(3)}) translate(0 ${-g}) translate(${q.x.toFixed(2)} ${q.y.toFixed(2)}) rotate(${q.rot.toFixed(2)} ${x} ${y})`,
        );
        l.move.setAttribute("opacity", q.op.toFixed(3));
        l.flip.setAttribute("transform", `scale(${q.sx.toFixed(3)} 1) skewY(${q.skew.toFixed(2)})`);
        l.face.style.display = q.sx < 0 ? "none" : "";
        l.back.style.display = q.sx < 0 ? "block" : "";
      });

    const frame = (now: number) => {
      raf = 0;
      if (mode === "run") {
        const t = elapsed + (now - t0) / 1000;
        const blend = easeOut(clamp01((now - t0) / (CONFIG.blendIn * 1000)));
        cur = parts.map((l, i) =>
          mix(from[i], reduced.matches ? { ...REST, rot: i ? CONFIG.reducedTilt : -CONFIG.reducedTilt } : pose(l.cfg, t - l.cfg.delay), blend),
        );
        if (reduced.matches && blend >= 1) return paint();
      } else if (mode === "exit") {
        const k = clamp01((now - t0) / CONFIG.exitMs);
        cur = from.map((f) => mix(f, REST, easeOut(k)));
        if (k >= 1) {
          mode = "idle";
          elapsed = 0;
          delete host.dataset.active;
        }
      }
      paint();
      if (mode !== "idle") raf = requestAnimationFrame(frame);
    };

    const kick = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };
    const play = () => {
      if (mode === "run") return;
      mode = "run";
      from = cur;
      t0 = performance.now();
      kick();
    };
    /** Pause the loop where it is and glide the leaves back to the resting pose. */
    const release = () => {
      window.clearTimeout(touchTimer);
      if (mode !== "run") return;
      const now = performance.now();
      elapsed += (now - t0) / 1000;
      mode = "exit";
      from = cur;
      t0 = now;
      kick();
    };
    const onEnter = (e: PointerEvent) => e.pointerType !== "touch" && play();
    const onLeave = (e: PointerEvent) => e.pointerType !== "touch" && release();
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      window.clearTimeout(touchTimer);
      host.dataset.active = "true";
      play();
      touchTimer = window.setTimeout(release, CONFIG.touchMs);
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

  return (
    <svg ref={svgRef} className={`leaves ${className}`} viewBox={`0 0 ${BOX} ${BOX}`} aria-hidden="true" focusable="false" {...props}>
      <defs>
        {(["h", "v"] as const).map((d) => (
          <g key={d}>
            <linearGradient id={`${id}-g${d}`} x2={d === "h" ? 1 : 0} y2={d === "v" ? 1 : 0}>
              <stop stopColor="#000" />
              <stop offset={FEATHER / BOX} stopColor="#fff" />
              <stop offset={1 - FEATHER / BOX} stopColor="#fff" />
              <stop offset="1" stopColor="#000" />
            </linearGradient>
            <mask id={`${id}-m${d}`} maskUnits="userSpaceOnUse" x="0" y="0" width={BOX} height={BOX}>
              <rect width={BOX} height={BOX} fill={`url(#${id}-g${d})`} />
            </mask>
          </g>
        ))}
        {(["a", "b"] as const).map((k) => (
          <g key={k}>
            <linearGradient id={`${id}-${k}-face`} x2="0.9" y2="1">
              <stop stopColor={`var(--leaf-${k}-light)`} />
              <stop offset="1" stopColor={`var(--leaf-${k}-dark)`} />
            </linearGradient>
            <linearGradient id={`${id}-${k}-back`} x2="0.9" y2="1">
              <stop stopColor={`var(--leaf-${k}-under-light)`} />
              <stop offset="1" stopColor={`var(--leaf-${k}-under-dark)`} />
            </linearGradient>
          </g>
        ))}
        <linearGradient id={`${id}-shine`} x2="1" y2="0.4">
          <stop stopColor="#fff" stopOpacity=".5" />
          <stop offset="1" stopColor="#fff" stopOpacity=".04" />
        </linearGradient>
      </defs>
      <g mask={`url(#${id}-mh)`}>
        <g mask={`url(#${id}-mv)`}>
      <g data-move="a">
        <g transform="translate(17 32) rotate(-25) scale(1.05)">
          <g data-flip="a">
            <Leaf id={id} kind="a" />
          </g>
        </g>
      </g>
      <g data-move="b">
        <g transform="translate(26 34) rotate(30) scale(.88)">
          <g data-flip="b">
            <Leaf id={id} kind="b" />
          </g>
        </g>
      </g>
        </g>
      </g>
    </svg>
  );
}
