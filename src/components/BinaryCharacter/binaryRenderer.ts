// Canvas-based binary digit field. Owns its own animation loop (requestAnimationFrame +
// delta time) and never touches React state, so a running field never triggers a render.

/** Reference coordinate system: every asset (crowd, mask) is authored at this resolution. */
export const SOURCE_WIDTH = 1671;
export const SOURCE_HEIGHT = 941;

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BinaryFieldOptions {
  /** Number of vertical glyph columns. Omit to derive it from columnSpacing. */
  streamCount?: number;
  /** Slowest column speed, in source-image px/second. */
  minSpeed?: number;
  /** Fastest column speed, in source-image px/second. */
  maxSpeed?: number;
  /** Glyph size, in source-image px. */
  fontSize?: number;
  /** Horizontal gap between columns, in source-image px (used when streamCount is omitted). */
  columnSpacing?: number;
  /** Vertical gap between glyphs in a column, in source-image px. */
  lineHeight?: number;
  /** Final alpha multiplier applied on top of each glyph's own brightness. */
  opacity?: number;
  /** How far a glyph's brightness can pulse above its resting baseline, 0-1. */
  opacityVariance?: number;
  /** CSS hex color for the glyphs (also the seed color for the atmospheric halo). */
  binaryColor?: string;
  /** Direction the streams travel. */
  direction?: "up" | "down";
  /** Background the field sits on. Flips the brightness->lightness ramp so "hot" glyphs
   *  stay high-contrast against either a black or a white backdrop instead of washing out. */
  theme?: "light" | "dark";
  /** Strength multiplier for the hover glow (digit lift, edge rim, halo). 0 turns it off,
   *  1 is the default look, 2 doubles it. */
  glowIntensity?: number;
}

type ResolvedOptions = Required<BinaryFieldOptions>;

const DEFAULT_OPTIONS: Omit<ResolvedOptions, "streamCount"> & { streamCount: number | undefined } = {
  streamCount: undefined,
  minSpeed: 20,
  maxSpeed: 50,
  fontSize: 24,
  columnSpacing: 28,
  lineHeight: 25,
  opacity: 1,
  opacityVariance: 0.4,
  binaryColor: "#166534",
  direction: "up",
  theme: "dark",
  glowIntensity: 1,
};

export const DEFAULT_BINARY_COLOR = DEFAULT_OPTIONS.binaryColor;

/** How often, on average, a glyph flips its 0/1 value while idle (chance per second). */
const GLYPH_FLIP_CHANCE_PER_SEC = 0.12;
const MAX_DELTA_SECONDS = 0.05;
/** Fraction of glyph slots left blank so the field reads as irregular rather than a solid grid.
 *  Kept high: the silhouette should read as a dense living mass of digits, with the dark gaps
 *  between individual glyphs (from font/line spacing) doing the work instead of empty slots. */
const ACTIVE_CHANCE = 0.97;
/** Brightness above which a glyph earns a small bloom. */
const BLOOM_THRESHOLD = 0.65;
/** How many discrete steps the dim -> bright color ramp is baked into. */
const PALETTE_STEPS = 48;

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function randRange([min, max]: [number, number]): number {
  return min + Math.random() * (max - min);
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function randomGlyph(): string {
  return Math.random() < 0.5 ? "0" : "1";
}

type Rgb = [number, number, number];

function hexToRgb(hex: string): Rgb | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  let value = match[1];
  if (value.length === 3) {
    value = value
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const num = Number.parseInt(value, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function rgbToCss([r, g, b]: Rgb, alpha = 1): string {
  return `rgba(${r | 0}, ${g | 0}, ${b | 0}, ${alpha})`;
}

/** Returns [hue 0-360, saturation 0-1, lightness 0-1]. */
function rgbToHsl([r, g, b]: Rgb): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h * 60, s, l];
}

function hue2rgb(p: number, q: number, t: number): number {
  let tt = t;
  if (tt < 0) tt += 1;
  if (tt > 1) tt -= 1;
  if (tt < 1 / 6) return p + (q - p) * 6 * tt;
  if (tt < 1 / 2) return q;
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
  return p;
}

/** hue in 0-360, saturation/lightness in 0-1. */
function hslToRgb(h: number, s: number, l: number): Rgb {
  if (s === 0) {
    const v = l * 255;
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hn = h / 360;
  return [
    hue2rgb(p, q, hn + 1 / 3) * 255,
    hue2rgb(p, q, hn) * 255,
    hue2rgb(p, q, hn - 1 / 3) * 255,
  ];
}

export interface GlyphPalette {
  /** Precomputed dim -> bright color ramp, indexed by brightness. */
  steps: string[];
  /** Lightened accent used for bloom / halo tinting. */
  glow: string;
}

/**
 * Builds a dim -> bright color ramp from a single seed color, driven entirely through HSL
 * lightness at a boosted, fixed saturation. Earlier revisions lerped the bright end toward
 * white in RGB space, which desaturates fast and reads as washed-out pastel green instead
 * of neon; holding saturation high while only lightness climbs keeps bright glyphs vivid.
 * The same `glow` accent is reused for glyph bloom and the atmospheric halo so everything
 * stays visually consistent with whatever color the caller passes in.
 *
 * The ramp direction flips with `theme`: on a black backdrop, "dim" needs to sink toward
 * black (low lightness) and "hot" needs to rise toward white (high lightness) to keep
 * contrast. On a white backdrop that inverts — "dim" should be a pale tint that nearly
 * blends into the page, while "hot" needs to be a deep, saturated tone so it still pops
 * against white instead of washing out toward it.
 */
export function buildPalette(hex: string, theme: "light" | "dark" = "dark"): GlyphPalette {
  const rgb = hexToRgb(hex) ?? (hexToRgb(DEFAULT_BINARY_COLOR) as Rgb);
  const [hue, baseSat] = rgbToHsl(rgb);
  const sat = clamp(Math.max(baseSat, 0.75), 0, 1);

  const dim =
    theme === "light"
      ? hslToRgb(hue, clamp(sat * 0.55, 0, 1), 0.83)
      : hslToRgb(hue, clamp(sat * 0.95, 0, 1), 0.15);
  const bright =
    theme === "light"
      ? hslToRgb(hue, clamp(sat * 1.2, 0, 1), 0.28)
      : hslToRgb(hue, clamp(sat * 1.1, 0, 1), 0.78);

  const steps: string[] = [];
  for (let i = 0; i < PALETTE_STEPS; i++) {
    steps.push(rgbToCss(mixRgb(dim, bright, i / (PALETTE_STEPS - 1))));
  }

  const glow =
    theme === "light"
      ? hslToRgb(hue, clamp(sat * 1.05, 0, 1), 0.4)
      : hslToRgb(hue, clamp(sat * 1.15, 0, 1), 0.58);
  return { steps, glow: rgbToCss(glow) };
}

/**
 * Scans a loaded mask image once and returns the tight bounding box (in the mask's own
 * pixel coordinates) of its non-transparent / non-black silhouette region.
 */
export function computeMaskBounds(maskImage: HTMLImageElement): Bounds {
  const width = maskImage.naturalWidth;
  const height = maskImage.naturalHeight;
  const offscreen = document.createElement("canvas");
  offscreen.width = width;
  offscreen.height = height;
  const ctx = offscreen.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return { x: 0, y: 0, width, height };
  }
  ctx.drawImage(maskImage, 0, 0);
  const { data } = ctx.getImageData(0, 0, width, height);

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * width * 4;
    for (let x = 0; x < width; x++) {
      const alpha = data[rowOffset + x * 4 + 3];
      if (alpha > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) {
    return { x: 0, y: 0, width, height };
  }
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/** Fraction of the silhouette's bounding-box height occupied by the head/neck/shoulders. */
const HEAD_GLOW_RATIO = 0.4;
/** Blur radius for the bright inner core of the rim — kept very tight so the luminous edge
 *  reads as thin, not a diffuse aura; brightness comes from opacity, not spread. */
const CORE_RIM_BLUR_RATIO = 0.006;
/** Blur radius for the soft feather laid under the core — a short falloff past the core, not
 *  a wide halo. Blur, unlike a uniform scale-from-center erosion, pushes every point of the
 *  boundary outward along its own local normal, so concave detail (an ear notch, the neck's
 *  curve into the collar) dilates in place instead of being smoothed toward the shape's
 *  centroid. That's what lets the glow hug the exact profile. */
const EDGE_GLOW_BLUR_RATIO = 0.014;
/** Extra blur layered on just the head/shoulder pass, on top of the core rim, for a slightly
 *  wider reach there — kept small so "more pronounced" stays about brightness, not size. */
const HEAD_EXTRA_BLUR_RATIO = 0.01;

/** Some browsers (older Safari/iOS) ignore `CanvasRenderingContext2D.filter`. Reading the property
 *  back is no proof of support there, since assigning to an unknown property just stores it, so
 *  blur a single pixel and check that it actually spread. Without a working blur the halo ring
 *  cancels itself out entirely. */
const SUPPORTS_CANVAS_FILTER = (() => {
  try {
    const probe = document.createElement("canvas");
    probe.width = 9;
    probe.height = 9;
    const pctx = probe.getContext("2d", { willReadFrequently: true });
    if (!pctx) return false;
    pctx.filter = "blur(2px)";
    pctx.fillRect(4, 4, 1, 1);
    return pctx.getImageData(2, 4, 1, 1).data[3] > 0;
  } catch {
    return false;
  }
})();

/** Draws `source` (w×h, painted in `color`) blurred by `blurPx`. Without canvas filters the same
 *  blur comes from `shadowBlur`: the source is drawn off-canvas and only its shadow lands in view. */
function drawBlurred(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  blurPx: number,
  color: string,
  w: number,
  h: number,
): void {
  if (SUPPORTS_CANVAS_FILTER) {
    ctx.filter = `blur(${blurPx}px)`;
    ctx.drawImage(source, 0, 0, w, h);
    ctx.filter = "none";
    return;
  }
  const scale = ctx.getTransform().a || 1;
  const away = w + blurPx * 4 + 16;
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 2 * blurPx * scale;
  ctx.shadowOffsetX = away * scale;
  ctx.drawImage(source, -away, 0, w, h);
  ctx.restore();
}

/** Phones have no hover to light the outline, so on touch screens the resting outline (outer
 *  halo and inner edge rim) is stronger, and reaches further because its edge line saturates. */
const TOUCH_GLOW_BOOST = 2.5;
const TOUCH_GLOW_REACH = 1.5;
const COARSE_POINTER = typeof window !== "undefined" ? window.matchMedia("(pointer: coarse)") : null;
/** Desktop gets a milder version of the same lift so the resting outline reads more strongly. */
const DESKTOP_GLOW_BOOST = 1.8;
const DESKTOP_GLOW_REACH = 1.4;
const glowBoost = () => (COARSE_POINTER?.matches ? TOUCH_GLOW_BOOST : DESKTOP_GLOW_BOOST);

/**
 * Paints a thin, bright luminous rim that follows the silhouette's exact *edge*, stronger
 * around the head/shoulders and subtler down the body. Two layers, both built by blurring the
 * mask (which dilates it outward, detail intact) and punching the sharp, unblurred mask back
 * out via `destination-out` — what's left is zero in the solid interior (blur ≈ original
 * there, so they cancel), strongest immediately outside the true edge, and fading fast beyond
 * it: a very tight, high-opacity core for the bright edge itself, and a slightly wider,
 * softer layer underneath for the short feather past it. Unlike a filled-and-blurred
 * silhouette (solid in the interior, washing out the dark gaps between digits), the interior
 * stays untouched. Drawn once per layout pass (not per animation frame) directly into `ctx`,
 * assumed already transformed so its drawing surface matches CSS pixels. Deliberately not
 * clipped by the hard person-mask so the glow can feather past the edge.
 */
export function renderHalo(
  ctx: CanvasRenderingContext2D,
  maskImage: HTMLImageElement,
  cssWidth: number,
  cssHeight: number,
  bounds: Bounds,
  hexColor: string,
  theme: "light" | "dark" = "dark",
): void {
  ctx.clearRect(0, 0, cssWidth, cssHeight);
  if (cssWidth <= 0 || cssHeight <= 0 || bounds.height <= 0) return;

  const glowColor = buildPalette(hexColor, theme).glow;

  const w = Math.max(1, Math.round(cssWidth));
  const h = Math.max(1, Math.round(cssHeight));

  const tint = document.createElement("canvas");
  tint.width = w;
  tint.height = h;
  const tctx = tint.getContext("2d");
  if (!tctx) return;
  tctx.drawImage(maskImage, 0, 0, w, h);
  tctx.globalCompositeOperation = "source-in";
  tctx.fillStyle = glowColor;
  tctx.fillRect(0, 0, w, h);

  // Build a soft-edged ring by blurring the tinted silhouette by `blurPx` (dilating it
  // outward, detail intact) then punching the sharp, untransformed mask back out.
  function buildRing(blurPx: number): HTMLCanvasElement {
    const canvasEl = document.createElement("canvas");
    canvasEl.width = w;
    canvasEl.height = h;
    const rctx = canvasEl.getContext("2d");
    if (!rctx) return canvasEl;
    drawBlurred(rctx, tint, blurPx, glowColor, w, h);
    rctx.globalCompositeOperation = "destination-out";
    rctx.drawImage(maskImage, 0, 0, w, h);
    rctx.globalCompositeOperation = "source-over";
    return canvasEl;
  }

  const boost = glowBoost();
  const reach = COARSE_POINTER?.matches ? TOUCH_GLOW_REACH : DESKTOP_GLOW_REACH;
  const coreBlur = clamp(bounds.width * CORE_RIM_BLUR_RATIO, 1, 3) * reach;
  const edgeBlur = clamp(bounds.width * EDGE_GLOW_BLUR_RATIO, 2, 8) * reach;
  const coreRing = buildRing(coreBlur);
  const softRing = buildRing(edgeBlur);

  ctx.save();

  // Short soft feather immediately past the edge, then a thin bright core right at it — both
  // already soft from their own construction, so no extra blur on either here.
  ctx.globalAlpha = Math.min(1, 0.22 * boost);
  ctx.drawImage(softRing, 0, 0, w, h);
  ctx.globalAlpha = Math.min(1, 0.55 * boost);
  ctx.drawImage(coreRing, 0, 0, w, h);

  // Stronger, still-thin glow concentrated around the head and shoulders — brighter there,
  // not wider, so it stays a rim rather than a hazy aura.
  const headStart = clamp(bounds.y / cssHeight, 0, 1);
  const headEnd = clamp(headStart + (bounds.height * HEAD_GLOW_RATIO) / cssHeight, headStart + 0.02, 1);

  const headLayer = document.createElement("canvas");
  headLayer.width = w;
  headLayer.height = h;
  const hctx = headLayer.getContext("2d");
  if (hctx) {
    hctx.drawImage(coreRing, 0, 0);
    hctx.globalCompositeOperation = "destination-in";
    const gradient = hctx.createLinearGradient(0, headStart * h, 0, headEnd * h);
    gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    hctx.fillStyle = gradient;
    hctx.fillRect(0, 0, w, h);

    const headExtraBlur = clamp(bounds.width * HEAD_EXTRA_BLUR_RATIO, 1, 5);
    ctx.globalAlpha = Math.min(1, 0.5 * boost);
    drawBlurred(ctx, headLayer, headExtraBlur, glowColor, w, h);
  }

  ctx.restore();
  ctx.filter = "none";
  ctx.globalAlpha = 1;
}

/**
 * Fills the silhouette with a flat color via canvas compositing rather than a CSS mask: paint
 * the fill, then keep only where the mask (drawn straight from the source image, no transform)
 * is opaque. Drawn once per layout pass — this fill is static — on its own canvas. Used for
 * both the always-black backing beneath the halo and digit field (so the character always
 * sits on a black backdrop no matter the page theme) and the debug-mask overlay (opaque
 * magenta, see BinaryCharacter's `debugMask` prop). Using the same drawImage-based compositing
 * the digit field itself uses (see `setMask` in createBinaryField) means every layer agrees on
 * the silhouette to the pixel instead of each going through its own separately-rasterized CSS
 * mask.
 */
export function renderMaskFill(
  ctx: CanvasRenderingContext2D,
  maskImage: HTMLImageElement,
  cssWidth: number,
  cssHeight: number,
  fillColor: string,
): void {
  ctx.clearRect(0, 0, cssWidth, cssHeight);
  if (cssWidth <= 0 || cssHeight <= 0) return;

  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = fillColor;
  ctx.fillRect(0, 0, cssWidth, cssHeight);

  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(maskImage, 0, 0, cssWidth, cssHeight);
  ctx.globalCompositeOperation = "source-over";
}

type GlyphClass = "faint" | "dim" | "hot";
type PulsePhase = "idle" | "rise" | "hold" | "fall";

interface ClassConfig {
  base: [number, number];
  peak: [number, number];
  idle: [number, number];
}

interface GlyphSlot {
  /** Whether this slot renders at all; false slots stay blank to break up the grid. */
  active: boolean;
  char: string;
  cls: GlyphClass;
  brightness: number;
  phase: PulsePhase;
  timer: number;
  duration: number;
  fromB: number;
  toB: number;
  /** Fixed per-slot position nudge (CSS px) baked in at layout time. */
  dx: number;
  dy: number;
  /** Fixed per-slot alpha multiplier so neighboring glyphs at the same brightness still differ. */
  alphaNoise: number;
}

const CLASS_WEIGHTS: [GlyphClass, number][] = [
  ["faint", 0.13],
  ["dim", 0.65],
  ["hot", 0.22],
];

function pickClass(): GlyphClass {
  const r = Math.random();
  let acc = 0;
  for (const [cls, weight] of CLASS_WEIGHTS) {
    acc += weight;
    if (r <= acc) return cls;
  }
  return "dim";
}

function buildClassConfig(opacityVariance: number): Record<GlyphClass, ClassConfig> {
  const variance = clamp(opacityVariance, 0, 1);
  return {
    faint: { base: [0.07, 0.16], peak: [0.26, 0.38 + variance * 0.15], idle: [2.4, 5.5] },
    dim: { base: [0.3, 0.48], peak: [0.62, 0.76 + variance * 0.2], idle: [0.9, 2.6] },
    hot: { base: [0.5, 0.68], peak: [0.96, 1], idle: [0.3, 1.1] },
  };
}

interface BinaryColumn {
  x: number;
  speed: number;
  offset: number;
  glyphs: GlyphSlot[];
}

interface Layout {
  columns: BinaryColumn[];
  fontSizePx: number;
  lineHeightPx: number;
  tileHeight: number;
}

const EMPTY_LAYOUT: Layout = { columns: [], fontSizePx: 0, lineHeightPx: 0, tileHeight: 1 };

function createGlyphSlot(classConfig: Record<GlyphClass, ClassConfig>, columnSpacingPx: number, lineHeightPx: number): GlyphSlot {
  const cls = pickClass();
  const base = randRange(classConfig[cls].base);
  return {
    active: Math.random() < ACTIVE_CHANCE,
    char: randomGlyph(),
    cls,
    brightness: base,
    phase: "idle",
    timer: randRange(classConfig[cls].idle),
    duration: 0,
    fromB: base,
    toB: base,
    dx: (Math.random() - 0.5) * columnSpacingPx * 0.3,
    dy: (Math.random() - 0.5) * lineHeightPx * 0.3,
    alphaNoise: 0.82 + Math.random() * 0.36,
  };
}

function updateGlyphBrightness(g: GlyphSlot, dt: number, classConfig: Record<GlyphClass, ClassConfig>) {
  const cfg = classConfig[g.cls];
  g.timer -= dt;

  if (g.phase === "idle") {
    if (g.timer <= 0) {
      g.phase = "rise";
      g.duration = randRange([0.35, 0.95]);
      g.timer = g.duration;
      g.fromB = g.brightness;
      g.toB = randRange(cfg.peak);
    }
    return;
  }

  if (g.phase === "hold") {
    if (g.timer <= 0) {
      g.phase = "fall";
      g.duration = randRange([0.5, 1.2]);
      g.timer = g.duration;
      g.fromB = g.brightness;
      g.toB = randRange(cfg.base);
    }
    return;
  }

  // "rise" or "fall": ease smoothly between fromB and toB.
  const t = clamp(1 - g.timer / g.duration, 0, 1);
  g.brightness = g.fromB + (g.toB - g.fromB) * easeInOutCubic(t);

  if (g.timer <= 0) {
    if (g.phase === "rise") {
      g.phase = "hold";
      g.duration = randRange([0.15, 0.5]);
      g.timer = g.duration;
      g.brightness = g.toB;
    } else {
      g.phase = "idle";
      g.timer = randRange(cfg.idle);
      g.brightness = g.toB;
    }
  }
}

function buildLayout(bounds: Bounds, scale: number, options: ResolvedOptions): Layout {
  if (bounds.width <= 0 || bounds.height <= 0 || scale <= 0) {
    return EMPTY_LAYOUT;
  }

  const fontSizePx = options.fontSize * scale;
  const lineHeightPx = options.lineHeight * scale;
  const columnSpacingPx = options.columnSpacing * scale;
  const classConfig = buildClassConfig(options.opacityVariance);

  const rows = Math.max(4, Math.ceil(bounds.height / lineHeightPx) + 2);
  const tileHeight = rows * lineHeightPx;

  const columnCount =
    options.streamCount ?? Math.max(1, Math.round(bounds.width / columnSpacingPx));

  const directionSign = options.direction === "up" ? -1 : 1;

  const columns: BinaryColumn[] = [];
  for (let i = 0; i < columnCount; i++) {
    const t = columnCount === 1 ? 0.5 : i / (columnCount - 1);
    const jitter = (Math.random() - 0.5) * columnSpacingPx * 0.55;
    const x = clamp(bounds.x + t * bounds.width + jitter, bounds.x, bounds.x + bounds.width);

    const speedMagnitude =
      (options.minSpeed + Math.random() * (options.maxSpeed - options.minSpeed)) * scale;

    columns.push({
      x,
      speed: speedMagnitude * directionSign,
      offset: Math.random() * tileHeight,
      glyphs: Array.from({ length: rows }, () =>
        createGlyphSlot(classConfig, columnSpacingPx, lineHeightPx),
      ),
    });
  }

  return { columns, fontSizePx, lineHeightPx, tileHeight };
}

/** Every pointer interaction of the binary man, individually switchable (see DebugBar). */
export interface BinaryInteractions {
  /** Spotlight lift, edge rim and halo brightening while hovering the silhouette. */
  glow: boolean;
  /** Glyphs under the cursor re-randomize 0↔1. */
  flip: boolean;
  /** Press-and-hold builds glow intensity; releasing bursts it outward from the cursor. */
  charge: boolean;
}

export const DEFAULT_INTERACTIONS: BinaryInteractions = { glow: true, flip: true, charge: true };

export interface BinaryFieldController {
  start(): void;
  stop(): void;
  setBounds(bounds: Bounds, scale: number): void;
  /** Pre-rasterizes the mask at the field's current CSS pixel size so every frame's
   *  destination-in clip (see draw()) blits a ready bitmap instead of rescaling the source
   *  image each time. Call whenever the field's CSS size changes, alongside setBounds. */
  setMask(maskImage: HTMLImageElement, cssWidth: number, cssHeight: number): void;
  /** Swaps the glyph palette (and the edge-rim tint derived from it) in place, so a color
   *  change never restarts the streams. */
  setColor(hex: string): void;
  /** Changes the hover glow strength live (see BinaryFieldOptions.glowIntensity). */
  setGlowIntensity(intensity: number): void;
  /** Cursor position in CSS px relative to the field, or null once it leaves. Drives the
   *  hover spotlight, which only lights up while the point is over the silhouette itself. */
  setPointer(x: number | null, y?: number): void;
  /** Press state for the charge interaction; a press only counts while over the silhouette,
   *  and releasing after a hold fires the burst. */
  setPressed(pressed: boolean): void;
  /** Enables/disables individual hover interactions live (all on by default). */
  setInteractions(next: Partial<BinaryInteractions>): void;
  destroy(): void;
}

/** How deep, as a fraction of CSS width, the inner edge-rim tint reaches into the silhouette
 *  before fading to nothing — kept shallow so it only touches glyphs right at the boundary. */
const EDGE_RIM_DEPTH_RATIO = 0.012;
/** Blend strength of the edge-rim tint against glyphs it touches — applied with
 *  `source-atop`, so it only ever brightens existing glyph pixels, never fills a gap. */
const EDGE_RIM_TINT_ALPHA = 0.35;

/** How far up the brightness ramp every glyph is nudged while hovered — a slight lift, so
 *  each glyph stays on its own shade instead of the field flattening toward the top. */
const HOVER_BRIGHTNESS_BOOST = 0.12;
/** Around the cursor the lift is eased off by up to this fraction (full dip right under it,
 *  none past HOVER_DIP_RADIUS_RATIO), so the pointer sits in a barely-dimmer pocket. */
const HOVER_POINTER_DIP = 0.35;
/** Radius of that pocket, as a fraction of the silhouette's height. */
const HOVER_DIP_RADIUS_RATIO = 0.3;
/** Time constants (seconds) for the glow fading in/out and its focus trailing the cursor. */
const SPOTLIGHT_FADE_TAU = 0.12;
const SPOTLIGHT_FOLLOW_TAU = 0.06;
/** Mask alpha (0-255) above which a pixel counts as "on the silhouette" for hover. */
const HOVER_ALPHA_THRESHOLD = 128;
/** Glyphs within this many font sizes of the cursor re-randomize while it is over the silhouette. */
const HOVER_FLIP_RADIUS_EM = 7;
/** Chance per second that a glyph under the cursor flips 0↔1 (idle flips are far rarer). */
const HOVER_FLIP_RATE_PER_SEC = 14;
/** Seconds of holding to reach full charge. */
const CHARGE_SECONDS = 1.4;
/** Extra brightness-ramp lift at full charge (on top of hover), strongest near the cursor. */
const CHARGE_BRIGHTNESS_BOOST = 0.45;
/** Halo brightening at full charge / peak burst, in units of the hover glow amount. */
const CHARGE_HALO_GAIN = 1.6;
const BURST_HALO_GAIN = 2.4;
/** The release burst: a ring expanding from the cursor at this many silhouette-heights per
 *  second, lifting the glyphs it passes and fading out over BURST_SECONDS. */
const BURST_SECONDS = 0.8;
const BURST_RING_SPEED_RATIO = 1.5;
const BURST_RING_WIDTH_RATIO = 0.22;
const BURST_BRIGHTNESS_BOOST = 0.6;
/** Chance per second that a glyph inside the ring re-randomizes. */
const BURST_FLIP_RATE_PER_SEC = 18;
/** Edge-rim tint strength at full hover (EDGE_RIM_TINT_ALPHA at rest), so the inner outline
 *  brightens along with the glyphs. */
const EDGE_RIM_HOVER_ALPHA = 0.65;

/**
 * `onHoverChange`, if given, is called with the effective glow amount (eased 0-1 hover times
 * glowIntensity) whenever it moves, so layers the field doesn't own (the halo canvas) can
 * brighten in step with it.
 */
export function createBinaryField(
  canvas: HTMLCanvasElement,
  options: BinaryFieldOptions = {},
  onHoverChange?: (amount: number) => void,
): BinaryFieldController {
  const ctx = canvas.getContext("2d");
  const definedOptions = Object.fromEntries(
    Object.entries(options).filter(([, value]) => value !== undefined),
  );
  const resolved: ResolvedOptions = {
    ...DEFAULT_OPTIONS,
    ...definedOptions,
  } as ResolvedOptions;

  const classConfig = buildClassConfig(resolved.opacityVariance);
  let palette = buildPalette(resolved.binaryColor, resolved.theme);
  let lastMask: { image: HTMLImageElement; cssWidth: number; cssHeight: number } | null = null;

  let bounds: Bounds = { x: 0, y: 0, width: 0, height: 0 };
  let layout: Layout = EMPTY_LAYOUT;
  let rafId: number | null = null;
  let lastTime = 0;
  let maskCanvas: HTMLCanvasElement | null = null;
  let edgeRimCanvas: HTMLCanvasElement | null = null;
  let maskAlpha: { data: Uint8ClampedArray; width: number; height: number } | null = null;

  let pointer: { x: number; y: number } | null = null;
  let spot = { x: 0, y: 0 };
  let hover = 0;
  let pressed = false;
  let charge = 0;
  let burst: { x: number; y: number; peak: number; age: number } | null = null;
  let lastGlowAmount = 0;
  const interactions: BinaryInteractions = { ...DEFAULT_INTERACTIONS };
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function setBounds(newBounds: Bounds, scale: number) {
    bounds = newBounds;
    layout = buildLayout(bounds, scale, resolved);
  }

  function setMask(maskImage: HTMLImageElement, cssWidth: number, cssHeight: number) {
    lastMask = { image: maskImage, cssWidth, cssHeight };
    const w = Math.max(1, Math.round(cssWidth));
    const h = Math.max(1, Math.round(cssHeight));
    if (!maskCanvas) maskCanvas = document.createElement("canvas");
    maskCanvas.width = w;
    maskCanvas.height = h;
    const mctx = maskCanvas.getContext("2d");
    if (!mctx) return;
    mctx.clearRect(0, 0, w, h);
    mctx.drawImage(maskImage, 0, 0, w, h);
    // Cached once per layout so hover hit-testing is a single array lookup per frame.
    const pixels = mctx.getImageData(0, 0, w, h).data;
    const alpha = new Uint8ClampedArray(w * h);
    for (let i = 0; i < alpha.length; i++) alpha[i] = pixels[i * 4 + 3];
    maskAlpha = { data: alpha, width: w, height: h };

    // Inner edge rim: the sharp mask, tinted, minus a blurred copy of itself. Deep in the
    // interior the blur ≈ the sharp mask (surrounded by silhouette on every side within the
    // blur radius), so they cancel to ~0. Near the boundary the blur is pulled down toward
    // the exterior's zero while the sharp mask stays ~1, so the difference peaks right at the
    // edge and fades out over the blur radius — a thin band that traces the true contour
    // exactly, reusing the same glow color as the halo rather than introducing a new one.
    if (!edgeRimCanvas) edgeRimCanvas = document.createElement("canvas");
    edgeRimCanvas.width = w;
    edgeRimCanvas.height = h;
    const ectx = edgeRimCanvas.getContext("2d");
    if (!ectx) return;
    ectx.clearRect(0, 0, w, h);
    ectx.drawImage(maskImage, 0, 0, w, h);
    ectx.globalCompositeOperation = "source-in";
    ectx.fillStyle = palette.glow;
    ectx.fillRect(0, 0, w, h);
    ectx.globalCompositeOperation = "source-over";

    const rimDepth = clamp(w * EDGE_RIM_DEPTH_RATIO, 2, 8);
    const blurredMask = document.createElement("canvas");
    blurredMask.width = w;
    blurredMask.height = h;
    const bctx = blurredMask.getContext("2d");
    if (bctx) {
      drawBlurred(bctx, maskImage, rimDepth, "#000", w, h);
      ectx.globalCompositeOperation = "destination-out";
      ectx.drawImage(blurredMask, 0, 0);
      ectx.globalCompositeOperation = "source-over";
    }
  }

  function setGlowIntensity(intensity: number) {
    if (intensity === resolved.glowIntensity) return;
    resolved.glowIntensity = intensity;
    notifyGlow(true);
  }

  /** Burst envelope, 1 at release easing to 0 over BURST_SECONDS. */
  function burstLevel(): number {
    if (!burst) return 0;
    const t = Math.max(0, 1 - burst.age / BURST_SECONDS);
    return burst.peak * t * t;
  }

  /** Reports the combined hover + charge + burst glow to the halo layer when it changes. */
  function notifyGlow(force = false) {
    const amount = (hover + charge * CHARGE_HALO_GAIN + burstLevel() * BURST_HALO_GAIN) * resolved.glowIntensity;
    if (!force && amount === lastGlowAmount) return;
    lastGlowAmount = amount;
    onHoverChange?.(amount);
  }

  function setPressed(next: boolean) {
    if (next) {
      if (!interactions.charge || reducedMotion.matches) return;
      if (!pointer || !isOverSilhouette(pointer.x, pointer.y)) return;
      pressed = true;
      return;
    }
    if (!pressed) return;
    pressed = false;
    if (charge > 0.05 && pointer) burst = { x: pointer.x, y: pointer.y, peak: charge, age: 0 };
    charge = 0;
  }

  function setColor(hex: string) {
    if (hex === resolved.binaryColor) return;
    resolved.binaryColor = hex;
    palette = buildPalette(hex, resolved.theme);
    // The edge rim is baked with the glow color, so it has to be re-tinted too.
    if (lastMask) setMask(lastMask.image, lastMask.cssWidth, lastMask.cssHeight);
  }

  function setInteractions(next: Partial<BinaryInteractions>) {
    Object.assign(interactions, next);
  }

  function setPointer(x: number | null, y = 0) {
    pointer = x == null ? null : { x, y };
  }

  function isOverSilhouette(x: number, y: number): boolean {
    if (!maskAlpha) return false;
    const px = Math.floor(x);
    const py = Math.floor(y);
    if (px < 0 || py < 0 || px >= maskAlpha.width || py >= maskAlpha.height) return false;
    return maskAlpha.data[py * maskAlpha.width + px] >= HOVER_ALPHA_THRESHOLD;
  }

  function updateSpotlight(dt: number) {
    const active = interactions.glow && pointer != null && isOverSilhouette(pointer.x, pointer.y);
    if (pointer) {
      if (hover < 0.01) {
        // Fading in from nothing: start at the cursor instead of sliding over from the last spot.
        spot = { ...pointer };
      } else {
        const follow = 1 - Math.exp(-dt / SPOTLIGHT_FOLLOW_TAU);
        spot.x += (pointer.x - spot.x) * follow;
        spot.y += (pointer.y - spot.y) * follow;
      }
    }
    const fade = 1 - Math.exp(-dt / SPOTLIGHT_FADE_TAU);
    hover += ((active ? 1 : 0) - hover) * fade;
    if (hover < 0.001) hover = 0;
    if (hover > 0.999) hover = 1;
  }

  function update(dt: number) {
    updateSpotlight(dt);
    if (pressed && !interactions.charge) pressed = false;
    if (pressed) charge = Math.min(1, charge + dt / CHARGE_SECONDS);
    else if (charge > 0) charge = Math.max(0, charge - dt / 0.25);
    if (burst) {
      burst.age += dt;
      if (burst.age >= BURST_SECONDS) burst = null;
    }
    notifyGlow();
    const { columns, tileHeight, fontSizePx, lineHeightPx } = layout;
    const ringRadius = burst ? burst.age * bounds.height * BURST_RING_SPEED_RATIO : 0;
    const ringWidth = bounds.height * BURST_RING_WIDTH_RATIO;
    const flipRadius = fontSizePx * HOVER_FLIP_RADIUS_EM;
    const flipping =
      interactions.flip && pointer != null && !reducedMotion.matches && isOverSilhouette(pointer.x, pointer.y);
    for (const column of columns) {
      column.offset = mod(column.offset + column.speed * dt, tileHeight);
      const glyphs = column.glyphs;
      for (let i = 0; i < glyphs.length; i++) {
        const glyph = glyphs[i];
        updateGlyphBrightness(glyph, dt, classConfig);
        const flipChance = GLYPH_FLIP_CHANCE_PER_SEC * dt * (0.6 + glyph.brightness * 1.2);
        if (Math.random() < flipChance) {
          glyph.char = glyph.char === "0" ? "1" : "0";
        }
        if ((flipping || burst) && glyph.active) {
          const pos = mod(i * lineHeightPx - column.offset, tileHeight);
          const y = bounds.y - lineHeightPx + pos + lineHeightPx / 2 + glyph.dy;
          const x = column.x + glyph.dx;
          if (flipping && Math.hypot(x - pointer!.x, y - pointer!.y) < flipRadius && Math.random() < HOVER_FLIP_RATE_PER_SEC * dt) {
            glyph.char = glyph.char === "0" ? "1" : "0";
          }
          if (burst && Math.abs(Math.hypot(x - burst.x, y - burst.y) - ringRadius) < ringWidth && Math.random() < BURST_FLIP_RATE_PER_SEC * dt) {
            glyph.char = Math.random() < 0.5 ? "0" : "1";
          }
        }
      }
    }
  }

  function draw() {
    if (!ctx) return;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    const { columns, fontSizePx, lineHeightPx, tileHeight } = layout;
    if (columns.length === 0 || fontSizePx <= 0) return;

    ctx.font = `600 ${fontSizePx}px ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const lastStep = palette.steps.length - 1;
    const maxBloom = fontSizePx * 0.16;
    const dipRadius = bounds.height * HOVER_DIP_RADIUS_RATIO;
    const glow = hover * resolved.glowIntensity;
    const burstAmount = burstLevel();
    const burstRing = burst ? burst.age * bounds.height * BURST_RING_SPEED_RATIO : 0;
    const burstWidth = bounds.height * BURST_RING_WIDTH_RATIO;
    const hoverOn = glow > 0 && dipRadius > 0;

    for (const column of columns) {
      const glyphs = column.glyphs;
      for (let i = 0; i < glyphs.length; i++) {
        const glyph = glyphs[i];
        if (!glyph.active) continue;

        const pos = mod(i * lineHeightPx - column.offset, tileHeight);
        const y = bounds.y - lineHeightPx + pos + lineHeightPx / 2 + glyph.dy;
        const x = column.x + glyph.dx;

        let brightness = glyph.brightness;
        if (hoverOn) {
          const near = 1 - Math.min(1, Math.hypot(x - spot.x, y - spot.y) / dipRadius);
          const dip = HOVER_POINTER_DIP * near * near;
          brightness = Math.min(1, brightness + HOVER_BRIGHTNESS_BOOST * glow * (1 - dip));
        }

        let bloomBrightness = glyph.brightness;
        if (charge > 0) {
          const near = 1 - Math.min(1, Math.hypot(x - spot.x, y - spot.y) / (bounds.height * 0.6));
          brightness = Math.min(1, brightness + CHARGE_BRIGHTNESS_BOOST * charge * (0.4 + 0.6 * near));
          bloomBrightness = Math.max(bloomBrightness, brightness);
        }
        if (burst) {
          const band = Math.max(0, 1 - Math.abs(Math.hypot(x - burst.x, y - burst.y) - burstRing) / burstWidth);
          brightness = Math.min(1, brightness + BURST_BRIGHTNESS_BOOST * burstAmount * (0.35 + 0.65 * band));
          bloomBrightness = Math.max(bloomBrightness, brightness);
        }

        const stepIndex = clamp(Math.round(brightness * lastStep), 0, lastStep);
        ctx.fillStyle = palette.steps[stepIndex];
        const baseAlpha = clamp(0.24 + brightness * 0.78, 0.18, 1);
        ctx.globalAlpha = clamp(baseAlpha * glyph.alphaNoise, 0.05, 1) * resolved.opacity;

        if (bloomBrightness > BLOOM_THRESHOLD) {
          ctx.shadowColor = palette.glow;
          ctx.shadowBlur = maxBloom * ((bloomBrightness - BLOOM_THRESHOLD) / (1 - BLOOM_THRESHOLD));
        } else {
          ctx.shadowBlur = 0;
        }

        ctx.fillText(glyph.char, x, y);
      }
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    // Clip this frame's glyphs to the exact mask via canvas compositing rather than a CSS
    // mask — every glyph is drawn in full first (including whatever straddles the boundary),
    // then only the pixels the mask actually covers survive, anti-aliased edge included. This
    // is the same drawImage-based mechanism renderBacking uses for the backing layer, so the
    // two agree on the silhouette to the pixel instead of each going through a separately
    // rasterized CSS mask.
    if (maskCanvas) {
      ctx.globalCompositeOperation = "destination-in";
      ctx.drawImage(maskCanvas, 0, 0);
      ctx.globalCompositeOperation = "source-over";
    }

    // A small amount of brighter binary right at the silhouette edge, so the glyphs
    // themselves help trace the contour. `source-atop` only paints where a glyph already
    // survived the clip above — it can't brighten a gap into a fill, and it never touches
    // glyphs outside the thin rim (see setMask), so density/color elsewhere is untouched.
    if (edgeRimCanvas) {
      ctx.globalCompositeOperation = "source-atop";
      ctx.globalAlpha = Math.min(1, EDGE_RIM_TINT_ALPHA * glowBoost() + (EDGE_RIM_HOVER_ALPHA - EDGE_RIM_TINT_ALPHA) * glow);
      ctx.drawImage(edgeRimCanvas, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    }
  }

  function frame(now: number) {
    if (lastTime === 0) lastTime = now;
    const dt = Math.min((now - lastTime) / 1000, MAX_DELTA_SECONDS);
    lastTime = now;

    update(dt);
    draw();

    rafId = requestAnimationFrame(frame);
  }

  function start() {
    if (rafId != null) return;
    lastTime = 0;
    rafId = requestAnimationFrame(frame);
  }

  function stop() {
    if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function destroy() {
    stop();
  }

  return { start, stop, setBounds, setMask, setColor, setGlowIntensity, setPointer, setPressed, setInteractions, destroy };
}
