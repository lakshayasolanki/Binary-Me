/**
 * A photographic finish for the existing pixels, not a new silhouette.
 * Only RGB is written: alpha, dimensions, contours and pixel locations are fixed.
 */
const tone = Float32Array.from({ length: 256 }, (_, value) => {
  const x = value / 255;
  // A gentle contrast curve leaves black and white anchored and opens highlights.
  return 255 * (x + 0.10 * Math.sin(Math.PI * x) * (x - 0.40));
});

export function polishCrowdPixels(rgba: Uint8ClampedArray, width: number, height: number): void {
  if (rgba.length !== width * height * 4) throw new Error("Crowd pixel dimensions do not match");
  const luminance = new Uint8Array(width * height);
  for (let p = 0; p < luminance.length; p++) {
    const i = p * 4;
    luminance[p] = (54 * rgba[i] + 183 * rgba[i + 1] + 19 * rgba[i + 2] + 128) >> 8;
  }
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const p = y * width + x, i = p * 4;
    if (rgba[i + 3] === 0) continue;
    const light = luminance[p];
    let detail = 0;
    // Work only inside solid material. Do not sharpen transparency boundaries,
    // move edges, soften the print grain, or turn the fine grain into white halos.
    if (x > 0 && x < width - 1 && y > 0 && y < height - 1 &&
        rgba[i + 3] >= 250 && rgba[i - 1] >= 250 && rgba[i + 7] >= 250 &&
        rgba[i - width * 4 + 3] >= 250 && rgba[i + width * 4 + 3] >= 250) {
      const local = (luminance[p - 1] + luminance[p + 1] + luminance[p - width] + luminance[p + width]) / 4;
      const difference = light - local;
      detail = Math.max(-10, Math.min(10, difference)) * 0.22 *
        Math.max(0, 1 - Math.abs(difference) / 64);
    }
    const polished = Math.max(0, Math.min(255, tone[light] + detail));
    // Neutralize colored edge contamination without erasing any edge pixels.
    rgba[i] = polished;
    rgba[i + 1] = polished;
    rgba[i + 2] = polished;
  }
}

export function polishCrowdCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const sourceContext = source.getContext("2d", { willReadFrequently: true });
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!sourceContext || !context) throw new Error("Crowd polish canvas is unavailable");
  const pixels = sourceContext.getImageData(0, 0, source.width, source.height);
  polishCrowdPixels(pixels.data, source.width, source.height);
  context.putImageData(pixels, 0, 0);
  return canvas;
}
