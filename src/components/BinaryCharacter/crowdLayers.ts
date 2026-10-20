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
const D_VISIBLE_PATH = "M1040 100 H1420 L1420 240 L1468 285 L1474 350 L1460 410 L1432 465 L1375 517 L1340 530 L1310 595 L1328 680 L1328 800 L1325 941 L840 941 L840 540 L1100 440 Z";
// Trace only the shared B/F contour tightly. The outside of B's crown has
// transparent padding, so bright hair pixels cannot remain on F during travel.
// B's reference includes the bright shoulder and sleeve down to the hem.
// Keep that entire jacket with B; only the rear head/neck belongs to F.
const B_VISIBLE_PATH = "M0 941 L0 570 L72 560 L115 513 L116 475 L82 445 L65 430 L50 395 L60 367 L70 350 L65 280 L65 150 H250 L290 220 Q330 250 330 300 L328 365 Q325 413 300 440 L278 473 L323 509 Q410 545 468 635 Q526 715 522 802 Q510 865 501 941 Z";

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

export function createCrowdLayers(source: HTMLImageElement, background: HTMLImageElement, gDonor: HTMLImageElement, mask: HTMLImageElement, bImage: HTMLImageElement, gImage: HTMLImageElement, dImage: HTMLImageElement, cImage: HTMLImageElement): CrowdLayer[] {
  const w = SOURCE_WIDTH;
  const h = SOURCE_HEIGHT;
  const sourcePixels = pixels(source);
  const backgroundPixels = pixels(background);
  void gDonor; // Retained in the shared loading interface for existing callers.
  // The source has a thin bright fringe outside ME's cutout. Include that fringe
  // in the concealed area so it cannot become part of a moving person's coat.
  const expandedMask = surface();
  for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
    if (dx * dx + dy * dy <= 36) expandedMask.ctx.drawImage(mask, dx, dy);
  }
  const fringePixels = expandedMask.ctx.getImageData(0, 0, w, h).data;
  const maskPixels = pixels(mask);
  const { ctx: ownership } = surface();
  const index = (id: CrowdId) => CROWD_PEOPLE.findIndex(person => person.id === id) + 1;
  const regions = new Uint8Array(w * h);
  const fill = (id: CrowdId, path?: string, rect?: number[], target = regions) => {
    const owner = index(id);
    if (path) {
      ownership.clearRect(0, 0, w, h);
      ownership.fillStyle = "white";
      ownership.fill(new Path2D(path));
      const coverage = ownership.getImageData(0, 0, w, h).data;
      // Coverage selects one of the two neighbours. Blending numeric person IDs would
      // accidentally assign boundary pixels to a third, unrelated moving figure.
      for (let p = 0; p < target.length; p++) if (coverage[p * 4 + 3] >= 128) target[p] = owner;
    } else if (rect) {
      for (let y = rect[1]; y < rect[1] + rect[3]; y++) {
        target.fill(owner, y * w + rect[0], y * w + rect[0] + rect[2]);
      }
    }
  };
  fill("E", undefined, [0, 0, w, h]);
  fill("F", undefined, [0, 0, 500, h]);
  fill("C", undefined, [430, 0, 520, h]);
  // F's glasses extend past x=430. Keep the entire head on F rather than
  // leaving the outer lens on C, which moves independently.
  fill("F", undefined, [100, 150, 360, 350]);
  fill("A", "M0 0 H60 V450 L72 525 L130 590 L0 620 Z");
  fill("D", D_VISIBLE_PATH);
  fill("G", G_VISIBLE_PATH);
  fill("B", B_VISIBLE_PATH);
  const frontB = index("B"), frontD = index("D");
  // The reconstruction plate contains A and C as well as F. Its boundaries
  // differ from the source photo, so partition it before filling hidden pixels.
  const donorRegions = new Uint8Array(w * h);
  fill("F", undefined, [0, 0, w, h], donorRegions);
  fill("A", "M0 0 H100 V500 L135 500 Q80 540 50 600 Q15 650 0 700 Z", undefined, donorRegions);
  fill("C", "M450 0 H950 V941 H540 Q520 720 470 620 Q435 565 390 535 L430 510 L450 450 Z", undefined, donorRegions);

  return CROWD_PEOPLE.map(person => {
    if (["C"].includes(person.id)) {
      // Complete supplied portrait: preserve its silhouette instead of tracing
      // the old source/reconstruction seam through its coat.
      const bounds = { x: 330, y: 205, width: 565, height: 753.33 };
      const { canvas, ctx } = surface(cImage.naturalWidth, cImage.naturalHeight);
      ctx.drawImage(cImage, 0, 0);
      return { person, canvas, bounds };
    }
    if (person.id === "G" || person.id === "D") {
      const image = person.id === "G" ? gImage : dImage;
      const bounds = person.id === "G"
        ? { x: 930, y: 20, width: 531.3, height: 921.9 }
        : { x: 845, y: 130, width: 552.96, height: 829.44 };
      const { canvas, ctx } = surface(image.naturalWidth, image.naturalHeight);
      ctx.drawImage(image, 0, 0);
      if (person.id === "D") {
        // Trim the final overlap against the same silhouette used by the binary
        // subject, transformed from scene coordinates into this portrait's pixels.
        const scaleX = image.naturalWidth / bounds.width;
        const scaleY = image.naturalHeight / bounds.height;
        ctx.globalCompositeOperation = "destination-out";
        ctx.drawImage(mask, -bounds.x * scaleX, -bounds.y * scaleY,
          SOURCE_WIDTH * scaleX, SOURCE_HEIGHT * scaleY);
        ctx.globalCompositeOperation = "source-over";
      }
      return { person, canvas, bounds };
    }
    if (person.id === "B") {
      // Use the user's complete transparent cutout without tracing it again.
      const scale = 0.51;
      const bounds = { x: 0, y: 172, width: bImage.naturalWidth * scale, height: bImage.naturalHeight * scale };
      const { canvas, ctx } = surface(bImage.naturalWidth, bImage.naturalHeight);
      ctx.drawImage(bImage, 0, 0);
      return { person, canvas, bounds };
    }
    const own = index(person.id);
    const rgba = new Uint8ClampedArray(w * h * 4);
    let minX = w, minY = h, maxX = 0, maxY = 0;
    for (let i = 0; i < sourcePixels.length; i += 4) {
      const pixel = i / 4;
      const x = pixel % w, y = Math.floor(pixel / w);
      const owner = regions[pixel];
      const sourceVisible = sourcePixels[i + 3] > 10;
      // C's rectangular reconstruction range also catches F's bright sleeve.
      // Use the traced coat boundary for both source and donor pixels below
      // the shoulder, rather than carrying that neighbouring sleeve with C.
      if (person.id === "C" && y >= 535 && donorRegions[pixel] !== own) continue;
      // F's old source region contains fragments of B's profile. Use the clean
      // rear-person plate instead, and keep its head clear of A and C.
      if (person.id === "F" && y < 500 && x < 100) continue;
      let donor: Uint8ClampedArray | null = null;
      // Reconstructed material is allowed only behind another visible person (or ME).
      // It stays solid for the entire entrance; there is no fading shoulder patch.
      const concealedByFront = sourceVisible && (owner === frontB || owner === frontD);
      const cSilhouette = person.id === "C" && x >= 430 && x < 950 && y >= 480 && fringePixels[i + 3] > 128;
      const concealedByMe = maskPixels[i + 3] > 10 || cSilhouette;
      if ((concealedByFront || concealedByMe) && person.plane === "back") {
        if (person.id === "F" && x < 430) donor = backgroundPixels;
        if (person.id === "C" && x >= 430 && x < 950) donor = backgroundPixels;
        if (person.id === "E" && x >= 950 && owner !== own) donor = backgroundPixels;
      }
      if (person.id === "F" && owner === own) donor = backgroundPixels;
      const fMaterial = (owner === index("F") || concealedByFront || concealedByMe) &&
        x < (y < 500 ? 460 : 430);
      const transferredFMaterial = fMaterial && donorRegions[pixel] !== index("F");
      if (person.id === "F" && donorRegions[pixel] !== own) donor = null;
      if (transferredFMaterial && donorRegions[pixel] === own) donor = backgroundPixels;
      if (donor && donor[i + 3] > 10) {
        rgba[i] = donor[i]; rgba[i + 1] = donor[i + 1]; rgba[i + 2] = donor[i + 2]; rgba[i + 3] = donor[i + 3];
      }
      if (owner === own && person.id !== "F" && !cSilhouette &&
          !(transferredFMaterial && donorRegions[pixel] === own) &&
          (sourceVisible || !donor || donor[i + 3] <= 10)) {
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
