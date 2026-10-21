import bUrl from "../../assets/binary-character/portraits/B.png";
import cUrl from "../../assets/binary-character/portraits/C.png";
import dUrl from "../../assets/binary-character/portraits/D.png";
import eUrl from "../../assets/binary-character/portraits/E.png";
import fUrl from "../../assets/binary-character/portraits/F.png";
import type { CrowdId } from "./crowdMotion";
import type { CrowdLayer } from "./crowdLayers";
import { SOURCE_HEIGHT, SOURCE_WIDTH } from "./binaryRenderer";

export type CrowdPortraits = Partial<Record<CrowdId, HTMLImageElement>>;

export async function loadCrowdPortraits(): Promise<CrowdPortraits> {
  const urls = { B: bUrl, C: cUrl, D: dUrl, E: eUrl, F: fUrl };
  const entries = await Promise.all(Object.entries(urls).map(async ([id, url]) => {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const result = new Image();
      result.onload = () => resolve(result);
      result.onerror = () => reject(new Error(`Could not load portrait ${id}`));
      result.src = url;
    });
    return [id, image] as const;
  }));
  return Object.fromEntries(entries);
}

/** Use the supplied cutout itself, including its native transparency and proportions. */
export function applyCrowdPortrait(layer: CrowdLayer, image: HTMLImageElement, mask?: HTMLImageElement): CrowdLayer {
  const id = layer.person.id;
  const bounds = { ...layer.bounds };
  // Keep the existing scene anchors. Registration aligns D's crown/collar and
  // F's head; the original artwork's silhouette is never traced or substituted.
  if (id === "D") Object.assign(bounds, { x: 839.6, y: 144.04, width: 576.72 });
  if (id === "F") Object.assign(bounds, { x: -10, y: 214, width: 445 });
  if (id === "E") {
    // E's old layer included a 40px extension below the frame. Do not stretch
    // that padding into the new face and coat; anchor the portrait at the right.
    bounds.width = 770 * image.naturalWidth / image.naturalHeight;
    bounds.x = SOURCE_WIDTH - bounds.width;
  }
  const scale = bounds.width / image.naturalWidth;
  const bottomPad = id === "E" ? Math.ceil(40 / scale) : 0;
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight + bottomPad;
  bounds.height = canvas.height * scale;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Crowd portrait canvas is unavailable");
  context.drawImage(image, 0, 0);
  if (bottomPad) context.drawImage(image, 0, image.naturalHeight - 1, canvas.width, 1,
    0, image.naturalHeight, canvas.width, bottomPad);
  if (id === "D" && mask) {
    context.globalCompositeOperation = "destination-out";
    context.drawImage(mask, -bounds.x / scale, -bounds.y / scale,
      SOURCE_WIDTH / scale, SOURCE_HEIGHT / scale);
    context.globalCompositeOperation = "source-over";
  }
  return { ...layer, canvas, bounds };
}
