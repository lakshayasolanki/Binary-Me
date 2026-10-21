import reconstructionUrl from "../../assets/binary-character/reconstruction/background.webp";
import gReconstructionUrl from "../../assets/binary-character/reconstruction/G.webp";
import bImageUrl from "../../assets/binary-character/reconstruction/B.webp";
import gImageUrl from "../../assets/binary-character/reconstruction/G-uploaded.png";
import dImageUrl from "../../assets/binary-character/reconstruction/D-uploaded.png";
import cImageUrl from "../../assets/binary-character/reconstruction/C-uploaded.png";
import maskUrl from "../../assets/binary-character/person-mask.webp";
import crowdUrl from "../../assets/binary-character/crowd.webp";
import { createCrowdLayers } from "./crowdLayers";
import { loadCrowdPortraits } from "./crowdPortraits";

const load = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error(`Could not load ${src}`));
  image.src = src;
});

/**
 * Dev-only. Building the layers is seconds of per-pixel work on a phone, so run it once on a
 * desktop and save the finished layers under assets/binary-character/baked/ (the Vite dev server
 * accepts the posts). Re-run from the dev page after changing any crowd artwork:
 *   await (await import("/src/components/BinaryCharacter/bakeCrowdLayers.ts")).bakeCrowdLayers()
 */
export async function bakeCrowdLayers() {
  const [source, background, gDonor, mask, bImage, gImage, dImage, cImage, portraits] = await Promise.all([
    load(crowdUrl), load(reconstructionUrl), load(gReconstructionUrl), load(maskUrl),
    load(bImageUrl), load(gImageUrl), load(dImageUrl), load(cImageUrl), loadCrowdPortraits(),
  ]);
  const layers = createCrowdLayers(source, background, gDonor, mask, bImage, gImage, dImage, cImage, { portraits });
  const post = (name: string, body: Blob | string) => fetch(`/__bake/${name}`, { method: "POST", body });
  for (const { person, canvas } of layers) {
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error(`Could not encode ${person.id}`);
    await post(`${person.id}.png`, blob);
  }
  await post("layers.json", JSON.stringify(layers.map(({ person, bounds }) => ({ id: person.id, bounds })), null, 2));
  return layers.map(({ person, canvas, bounds }) => ({ id: person.id, width: canvas.width, height: canvas.height, bounds }));
}
