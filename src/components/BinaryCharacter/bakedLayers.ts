import manifest from "../../assets/binary-character/baked/layers.json";
import { CROWD_PEOPLE, type CrowdId } from "./crowdMotion";
import type { CrowdLayer } from "./crowdLayers";

// Finished layers produced by bakeCrowdLayers(). Computing them in the browser is seconds of
// per-pixel work on a phone, so the runtime only decodes images.
const urls = import.meta.glob<string>("../../assets/binary-character/baked/*.png", { eager: true, query: "?url", import: "default" });

export async function loadBakedLayers(): Promise<CrowdLayer[]> {
  return Promise.all(manifest.map(async ({ id, bounds }) => {
    const person = CROWD_PEOPLE.find(candidate => candidate.id === (id as CrowdId));
    const url = urls[`../../assets/binary-character/baked/${id}.png`];
    if (!person || !url) throw new Error(`Missing baked crowd layer ${id}`);
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const result = new Image();
      result.onload = () => resolve(result);
      result.onerror = () => reject(new Error(`Could not load baked crowd layer ${id}`));
      result.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    canvas.getContext("2d")?.drawImage(image, 0, 0);
    return { person, canvas, bounds };
  }));
}
