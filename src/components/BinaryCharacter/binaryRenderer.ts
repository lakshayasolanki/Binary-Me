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
    rctx.filter = `blur(${blurPx}px)`;
    rctx.drawImage(tint, 0, 0);
    rctx.filter = "none";
    rctx.globalCompositeOperation = "destination-out";
    rctx.drawImage(maskImage, 0, 0, w, h);
    rctx.globalCompositeOperation = "source-over";
    return canvasEl;
  }

  const coreBlur = clamp(bounds.width * CORE_RIM_BLUR_RATIO, 1, 3);
  const edgeBlur = clamp(bounds.width * EDGE_GLOW_BLUR_RATIO, 2, 8);
  const coreRing = buildRing(coreBlur);
  const softRing = buildRing(edgeBlur);

  ctx.save();

  // Short soft feather immediately past the edge, then a thin bright core right at it — both
  // already soft from their own construction, so no extra blur on either here.
  ctx.globalAlpha = 0.22;
  ctx.drawImage(softRing, 0, 0, w, h);
  ctx.globalAlpha = 0.55;
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
    ctx.filter = `blur(${headExtraBlur}px)`;
    ctx.globalAlpha = 0.5;
    ctx.drawImage(headLayer, 0, 0, w, h);
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

export interface BinaryFieldController {
  start(): void;
  stop(): void;
  setBounds(bounds: Bounds, scale: number): void;
  /** Pre-rasterizes the mask at the field's current CSS pixel size so every frame's
   *  destination-in clip (see draw()) blits a ready bitmap instead of rescaling the source
   *  image each time. Call whenever the field's CSS size changes, alongside setBounds. */
  setMask(maskImage: HTMLImageElement, cssWidth: number, cssHeight: number): void;
  destroy(): void;
}

/** How deep, as a fraction of CSS width, the inner edge-rim tint reaches into the silhouette
 *  before fading to nothing — kept shallow so it only touches glyphs right at the boundary. */
const EDGE_RIM_DEPTH_RATIO = 0.012;
/** Blend strength of the edge-rim tint against glyphs it touches — applied with
 *  `source-atop`, so it only ever brightens existing glyph pixels, never fills a gap. */
const EDGE_RIM_TINT_ALPHA = 0.35;

export function createBinaryField(
  canvas: HTMLCanvasElement,
  options: BinaryFieldOptions = {},
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
  const palette = buildPalette(resolved.binaryColor, resolved.theme);

  let bounds: Bounds = { x: 0, y: 0, width: 0, height: 0 };
  let layout: Layout = EMPTY_LAYOUT;
  let rafId: number | null = null;
  let lastTime = 0;
  let maskCanvas: HTMLCanvasElement | null = null;
  let edgeRimCanvas: HTMLCanvasElement | null = null;

  function setBounds(newBounds: Bounds, scale: number) {
    bounds = newBounds;
    layout = buildLayout(bounds, scale, resolved);
  }

  function setMask(maskImage: HTMLImageElement, cssWidth: number, cssHeight: number) {
    const w = Math.max(1, Math.round(cssWidth));
    const h = Math.max(1, Math.round(cssHeight));
    if (!maskCanvas) maskCanvas = document.createElement("canvas");
    maskCanvas.width = w;
    maskCanvas.height = h;
    const mctx = maskCanvas.getContext("2d");
    if (!mctx) return;
    mctx.clearRect(0, 0, w, h);
    mctx.drawImage(maskImage, 0, 0, w, h);

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
      bctx.filter = `blur(${rimDepth}px)`;
      bctx.drawImage(maskImage, 0, 0, w, h);
      ectx.globalCompositeOperation = "destination-out";
      ectx.drawImage(blurredMask, 0, 0);
      ectx.globalCompositeOperation = "source-over";
    }
  }

  function update(dt: number) {
    const { columns, tileHeight } = layout;
    for (const column of columns) {
      column.offset = mod(column.offset + column.speed * dt, tileHeight);
      for (const glyph of column.glyphs) {
        updateGlyphBrightness(glyph, dt, classConfig);
        const flipChance = GLYPH_FLIP_CHANCE_PER_SEC * dt * (0.6 + glyph.brightness * 1.2);
        if (Math.random() < flipChance) {
          glyph.char = glyph.char === "0" ? "1" : "0";
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

    for (const column of columns) {
      const glyphs = column.glyphs;
      for (let i = 0; i < glyphs.length; i++) {
        const glyph = glyphs[i];
        if (!glyph.active) continue;

        const pos = mod(i * lineHeightPx - column.offset, tileHeight);
        const y = bounds.y - lineHeightPx + pos + lineHeightPx / 2 + glyph.dy;
        const x = column.x + glyph.dx;

        const stepIndex = clamp(Math.round(glyph.brightness * lastStep), 0, lastStep);
        ctx.fillStyle = palette.steps[stepIndex];
        const baseAlpha = clamp(0.24 + glyph.brightness * 0.78, 0.18, 1);
        ctx.globalAlpha = clamp(baseAlpha * glyph.alphaNoise, 0.05, 1) * resolved.opacity;

        if (glyph.brightness > BLOOM_THRESHOLD) {
          ctx.shadowColor = palette.glow;
          ctx.shadowBlur = maxBloom * ((glyph.brightness - BLOOM_THRESHOLD) / (1 - BLOOM_THRESHOLD));
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
      ctx.globalAlpha = EDGE_RIM_TINT_ALPHA;
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

  return { start, stop, setBounds, setMask, destroy };
}
