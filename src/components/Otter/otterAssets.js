import { ASSETS } from './assetManifest.js';
import { LAYERS, loadPlan, pickTier } from './assetPlan.js';

// 1×1 transparent AVIF (generated with Pillow). If it decodes, AVIF is supported.
const AVIF_PROBE = 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAAGGbWV0YQAAAAAAAAAhaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAAAAAAAOcGl0bQAAAAAAAQAAACxpbG9jAAAAAEQAAAIAAQAAAAEAAAHCAAAAFwACAAAAAQAAAa4AAAAUAAAAQmlpbmYAAAAAAAIAAAAaaW5mZQIAAAAAAQAAYXYwMUNvbG9yAAAAABppbmZlAgAAAAACAABhdjAxQWxwaGEAAAAAGmlyZWYAAAAAAAAADmF1eGwAAgABAAEAAADDaXBycAAAAJ1pcGNvAAAAFGlzcGUAAAAAAAAAAQAAAAEAAAAQcGl4aQAAAAADCAgIAAAADGF2MUOBAAwAAAAAE2NvbHJuY2x4AAEADQAGgAAAAA5waXhpAAAAAAEIAAAADGF2MUOBABwAAAAAOGF1eEMAAAAAdXJuOm1wZWc6bXBlZ0I6Y2ljcDpzeXN0ZW1zOmF1eGlsaWFyeTphbHBoYQAAAAAeaXBtYQAAAAAAAAACAAEEAQKDBAACBAEFhgcAAAAzbWRhdBIACgQYAAYVMgoYACihAAIhHctgEgAKBRgABgQgMgwYAAooooQAALATS9g=';

let formatPromise;
/** 'avif' when the browser decodes AVIF, else 'webp'. Resolved once per page. */
export function imageFormat() {
  formatPromise ??= new Promise((resolve) => {
    if (typeof Image === 'undefined') return resolve('webp');
    const img = new Image();
    img.src = AVIF_PROBE;
    img.decode().then(() => resolve('avif'), () => resolve('webp'));
  });
  return formatPromise;
}

const decoded = new Map(); // url → Promise (shared by every otter on the page)
function decodeUrl(url) {
  if (!decoded.has(url)) {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    decoded.set(url, img.decode().catch((err) => { decoded.delete(url); throw err; }));
  }
  return decoded.get(url);
}

const idle = (fn) => (typeof requestIdleCallback === 'function'
  ? requestIdleCallback(fn, { timeout: 2000 })
  : setTimeout(fn, 200));

/**
 * One theme × tier × format of the otter's art. Loads by priority, decodes before reporting
 * ready, and falls back per image (AVIF decode error → WebP; a failed typing layer → the
 * flat typing frame).
 */
class AssetSet {
  constructor(theme, tier, format) {
    Object.assign(this, { theme, tier, format });
    this.status = new Map(); // name → 'loading' | 'ready' | 'error'
    this.urls = new Map();   // name → the URL that decoded
    this.listeners = new Set();
    this.started = false;
  }

  url(name, format = this.format) {
    return ASSETS[this.theme][name][this.tier][format];
  }

  isReady = (name) => this.status.get(name) === 'ready';

  get criticalReady() {
    return loadPlan().critical.every((n) => this.isReady(n) || (LAYERS.includes(n) && this.isReady('typing')));
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  load(name) {
    if (this.status.has(name)) return this.pending?.get(name) ?? Promise.resolve();
    this.status.set(name, 'loading');
    const attempt = (format) => decodeUrl(this.url(name, format)).then(() => this.url(name, format));
    const p = attempt(this.format)
      .catch(() => (this.format === 'avif' ? attempt('webp') : Promise.reject()))
      .then((url) => { this.urls.set(name, url); this.status.set(name, 'ready'); },
        () => {
          this.status.set(name, 'error');
          if (LAYERS.includes(name)) this.load('typing'); // layers failed → flat typing
        })
      .finally(() => this.listeners.forEach((fn) => fn()));
    (this.pending ??= new Map()).set(name, p);
    return p;
  }

  /** critical → (idle) reactions 3–9 → (idle) thinking/sleeping. */
  start({ thinking }) {
    if (this.started) return;
    this.started = true;
    const plan = loadPlan({ thinking });
    Promise.allSettled(plan.critical.map((n) => this.load(n))).then(() => {
      idle(() => Promise.allSettled(plan.idle.map((n) => this.load(n))).then(() => {
        idle(() => plan.late.forEach((n) => this.load(n)));
      }));
    });
  }
}

const sets = new Map();
export function assetSet(theme, tier, format) {
  const key = `${theme}:${tier}:${format}`;
  if (!sets.has(key)) sets.set(key, new AssetSet(theme, tier, format));
  return sets.get(key);
}

/**
 * Warm a theme ahead of a switch, e.g. on the theme toggle's hover. Never called
 * automatically. Loads that theme in the normal priority order, at the tier an otter of
 * `size` CSS px needs on this screen. Prefer the component's `ref.prefetchTheme(theme)`,
 * which also knows the pose currently on screen and loads that first.
 *
 * @param {'light' | 'dark'} theme
 * @param {{ size?: number, thinking?: boolean }} [options] size: the otter's width in CSS px (default 160)
 * @returns {Promise<void>} resolves once loading has been started (not finished)
 */
export async function prefetchTheme(theme, { size = 160, thinking = false } = {}) {
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  assetSet(theme, pickTier(size, dpr), await imageFormat()).start({ thinking });
}
