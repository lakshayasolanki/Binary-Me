import assert from "node:assert/strict";
import test from "node:test";
import { polishCrowdPixels } from "../src/components/BinaryCharacter/crowdPolish.ts";

test("polish preserves every alpha byte, including fine translucent contours and holes", () => {
  const width = 37, height = 29;
  const rgba = Uint8ClampedArray.from({ length: width * height * 4 }, (_, i) => (i * 73 + 19) % 256);
  const before = rgba.slice();
  polishCrowdPixels(rgba, width, height);
  for (let i = 0; i < rgba.length; i += 4) {
    assert.equal(rgba[i + 3], before[i + 3], `Alpha changed at pixel ${i / 4}`);
    if (rgba[i + 3] === 0) assert.deepEqual(rgba.slice(i, i + 4), before.slice(i, i + 4));
    else assert.ok(rgba[i] === rgba[i + 1] && rgba[i] === rgba[i + 2]);
  }
});

test("black and white remain anchored; halftone contrast is bounded and ordered", () => {
  const ramp = Uint8ClampedArray.from({ length: 256 * 4 }, (_, i) => i % 4 === 3 ? 255 : Math.floor(i / 4));
  const before = ramp.slice();
  polishCrowdPixels(ramp, 256, 1);
  assert.equal(ramp[0], 0);
  assert.equal(ramp[255 * 4], 255);
  let changed = 0;
  for (let x = 0; x < 256; x++) {
    const i = x * 4;
    assert.ok(Math.abs(ramp[i] - before[i]) <= 8, `Excessive tonal change at ${x}`);
    if (x > 0) assert.ok(ramp[i] >= ramp[i - 4], `Reversed tonal order at ${x}`);
    if (ramp[i] !== before[i]) changed++;
  }
  assert.ok(changed > 100, "Finish should refine tones, not be a no-op");
});

test("transparent neighbours cannot introduce bright or dark edge halos", () => {
  const make = (hidden: number) => Uint8ClampedArray.from([
    hidden, hidden, hidden, 0, 90, 90, 90, 128, hidden, hidden, hidden, 0,
    90, 90, 90, 128, 90, 90, 90, 255, 90, 90, 90, 128,
    hidden, hidden, hidden, 0, 90, 90, 90, 128, hidden, hidden, hidden, 0,
  ]);
  const dark = make(0), light = make(255);
  polishCrowdPixels(dark, 3, 3);
  polishCrowdPixels(light, 3, 3);
  for (let i = 0; i < dark.length; i += 4) {
    if (dark[i + 3] !== 0) assert.deepEqual(dark.slice(i, i + 4), light.slice(i, i + 4));
  }
});
