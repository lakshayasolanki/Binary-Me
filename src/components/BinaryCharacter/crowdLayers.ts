import { CROWD_PEOPLE, type CrowdId, type CrowdPerson } from "./crowdMotion";
import { SOURCE_HEIGHT, SOURCE_WIDTH } from "./binaryRenderer";

export interface CrowdLayer {
  person: CrowdPerson;
  canvas: HTMLCanvasElement;
  bounds: { x: number; y: number; width: number; height: number };
}

// These are visible-region ownership boundaries, not invented whole-body silhouettes.
// The user explicitly identified G as the upper-left crescent behind D.
// Only the internal G/D boundary needs tracing. Leave generous transparent space around
// G's crown so its fine hair/rim pixels do not get stranded on D when G moves away.
export const G_VISIBLE_PATH = "M1040 460 L1040 100 L1420 100 L1420 222 L1378 222 L1290 222 C1267 218 1253 222 1243 233 C1223 254 1216 282 1216 313 C1216 350 1221 385 1235 417 L1240 438 L1197 434 Z";
const D_VISIBLE_PATH = "M1110 140 L1345 140 L1440 255 L1462 310 L1455 400 L1420 480 L1370 525 L1335 520 L1305 580 L1300 650 L1312 800 L1325 941 L840 941 L840 540 L1100 440 Z";
const B_VISIBLE_PATH = "M0 941 L0 530 L65 542 L100 480 L65 430 L50 395 L60 367 L75 350 L82 286 Q90 235 126 216 Q203 171 270 207 Q325 226 330 280 L331 350 Q326 406 302 448 L278 473 L323 509 Q410 545 468 635 Q526 715 518 802 Q497 865 501 941 Z";

function surface(width = SOURCE_WIDTH, height = SOURCE_HEIGHT) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Crowd canvas is unavailable");
  return { canvas, ctx };
}

function pixels(image: HTMLImageElement, dx = 0, dy = 0) {
  const { ctx } = surface();
  ctx.drawImage(image, dx, dy);
  return ctx.getImageData(0, 0, SOURCE_WIDTH, SOURCE_HEIGHT).data;
}

export function createCrowdLayers(source: HTMLImageElement, background: HTMLImageElement, gDonor: HTMLImageElement, mask: HTMLImageElement): CrowdLayer[] {
  const w = SOURCE_WIDTH;
  const h = SOURCE_HEIGHT;
  const sourcePixels = pixels(source);
  const backgroundPixels = pixels(background);
  // Align the generated concealed-area donor with G's original crown. Visible pixels below
  // always come directly from the source; donor geometry never replaces the source head.
  const gPixels = pixels(gDonor, 105, 30);
  const maskPixels = pixels(mask);
  const { ctx: ownership } = surface();
  const index = (id: CrowdId) => CROWD_PEOPLE.findIndex(person => person.id === id) + 1;
  const regions = new Uint8Array(w * h);
  const fill = (id: CrowdId, path?: string, rect?: number[]) => {
    const owner = index(id);
    if (path) {
      ownership.clearRect(0, 0, w, h);
      ownership.fillStyle = "white";
      ownership.fill(new Path2D(path));
      const coverage = ownership.getImageData(0, 0, w, h).data;
      // Coverage selects one of the two neighbours. Blending numeric person IDs would
      // accidentally assign boundary pixels to a third, unrelated moving figure.
      for (let p = 0; p < regions.length; p++) if (coverage[p * 4 + 3] >= 128) regions[p] = owner;
    } else if (rect) {
      for (let y = rect[1]; y < rect[1] + rect[3]; y++) {
        regions.fill(owner, y * w + rect[0], y * w + rect[0] + rect[2]);
      }
    }
  };
  fill("E", undefined, [0, 0, w, h]);
  fill("F", undefined, [0, 0, 500, h]);
  fill("C", undefined, [430, 0, 520, h]);
  fill("A", "M0 0 H60 V450 L72 525 L130 590 L0 620 Z");
  fill("D", D_VISIBLE_PATH);
  fill("G", G_VISIBLE_PATH);
  fill("B", B_VISIBLE_PATH);
  const frontB = index("B"), frontD = index("D");

  return CROWD_PEOPLE.map(person => {
    const own = index(person.id);
    const rgba = new Uint8ClampedArray(w * h * 4);
    let minX = w, minY = h, maxX = 0, maxY = 0;
    for (let i = 0; i < sourcePixels.length; i += 4) {
      const pixel = i / 4;
      const x = pixel % w, y = Math.floor(pixel / w);
      const owner = regions[pixel];
      const sourceVisible = sourcePixels[i + 3] > 10;
      let donor: Uint8ClampedArray | null = null;
      // Reconstructed material is allowed only behind another visible person (or ME).
      // It stays solid for the entire entrance; there is no fading shoulder patch.
      const concealedByFront = sourceVisible && (owner === frontB || owner === frontD);
      const concealedByMe = maskPixels[i + 3] > 10;
      if ((concealedByFront || concealedByMe) && person.plane === "back") {
        if (person.id === "F" && x < 430) donor = backgroundPixels;
        if (person.id === "C" && x >= 430 && x < 950) donor = backgroundPixels;
        if (person.id === "E" && x >= 950 && owner !== own) donor = backgroundPixels;
        if (person.id === "G" && x > 1050 && x < 1470 && (owner === frontD || concealedByMe)) donor = gPixels;
      }
      if (donor && donor[i + 3] > 10) {
        rgba[i] = donor[i]; rgba[i + 1] = donor[i + 1]; rgba[i + 2] = donor[i + 2]; rgba[i + 3] = donor[i + 3];
      }
      if (owner === own && (sourceVisible || !donor || donor[i + 3] <= 10)) {
        // Own even the faint original alpha: the original grain and edges are not regenerated.
        rgba[i] = sourcePixels[i]; rgba[i + 1] = sourcePixels[i + 1]; rgba[i + 2] = sourcePixels[i + 2]; rgba[i + 3] = sourcePixels[i + 3];
      }
      if (rgba[i + 3] > 10) {
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + 1); maxY = Math.max(maxY, y + 1);
      }
    }
    const full = surface();
    full.ctx.putImageData(new ImageData(rgba, w, h), 0, 0);
    minX = Math.max(0, minX - 2); minY = Math.max(0, minY - 2);
    maxX = Math.min(w, maxX + 2); maxY = Math.min(h, maxY + 2);
    const bottomPad = maxY === h ? 40 : 0;
    const bounds = { x: minX, y: minY, width: maxX - minX, height: maxY - minY + bottomPad };
    const cropped = surface(bounds.width, bounds.height);
    cropped.ctx.drawImage(full.canvas, minX, minY, bounds.width, maxY - minY, 0, 0, bounds.width, maxY - minY);
    if (bottomPad) cropped.ctx.drawImage(full.canvas, minX, h - 1, bounds.width, 1, 0, h - minY, bounds.width, bottomPad);
    return { person, canvas: cropped.canvas, bounds };
  });
}
