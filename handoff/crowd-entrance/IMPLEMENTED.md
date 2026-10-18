# Crowd entrance — implemented

Review the working component at `/handoff/crowd-entrance/motion-review.html` while Vite is running. The hero at `/` plays once on mount. The source identification page remains at `generated-proof-v1/review.html`.

## Experimental finish blur

The entrance uses the original three-second timing. Its paths and normalized motion curve are unchanged. `useCrowdFinish.tsx` adds a horizontal photographic blur with fixed streak variation from 2.05s to 3s, then holds it without another animation loop. Blur timing scales with the entrance duration. Only crowd layers are filtered. The subject mask prevents blur spilling into the exposed binary silhouette while preserving actual foreground overlap.

The hero uses `crowdBlur={1}` by default. The review's **Finish blur** control offers Off (0), Subtle (0.6), Motion (1), and Stronger (1.5), and updates the finish without replaying. Off bypasses the filter completely and restores phase one. Filter dimensions scale with the component; frozen stages and still-image fallbacks receive the appropriate finish. The underlying alignment comparison intentionally excludes this visual filter.

Verified the light review and dark mobile hero, sharp binary digits, early-stage filter bypass, paused landing, end-state handoff, and live strength switching. Build, lint, and the existing seven motion tests pass. Preview: `blur-finish-preview.jpg`.

## Current behavior

- Seven independently moving people: A, B, C, D, E, F, G. G is the upper-left crescent behind the lower/right head D, following the user's annotation.
- B moves left into place; D, G, E, F and C move right by different amounts; the left-edge sliver A moves slightly left. B and D pass above the stationary binary silhouette. The five other people remain behind it.
- The three-second speed profile rises smoothly for 0.38s, holds until 0.95s, then falls quickly and tapers to zero. Position comes from integrating this speed profile. The crowd shares the slowdown, with individual stride phases and amounts. All timing milestones scale with `ENTRANCE_DURATION`.
- A continuous mesh gives each figure slight head, shoulder and body articulation. Every displacement, rotation and scale reaches its original value at the end. The binary man never translates, scales or rotates.
- The original `crowd.png` takes over when playback finishes; the entrance renderer stops and releases its resources. Theme/color changes do not replay it. There is no exit animation.
- Reduced motion, hidden tabs, unavailable/lost WebGL contexts, failed images, or preparation exceeding 650ms show the original photograph. Preparation stays hidden until the first pose or the fallback is ready, avoiding a final-photo flash before motion.

## Source and reconstruction

`crowdLayers.ts` partitions visible source pixels into seven owners. Ownership uses coverage masks, so antialiasing cannot accidentally assign a seam pixel to a third person. Visible faces, lighting and grain come from the original photo.

`src/assets/binary-character/reconstruction/background.png` reuses the earlier generated background plate only for concealed areas behind B, D or ME. `reconstruction/G.png` is the new G donor; it is aligned and used only in areas hidden in the final photograph. Its generation prompt is saved in `G-reconstruction-prompt.txt`. These are texture donors, not replacement final photographs.

The older `D_full.png` and `crowd-layers/D.png` incorrectly combined/reversed D and G. The new renderer does not import them. They are retained as historical handoff material, not current runtime inputs.

The motion is a short passage made from a still image. Hidden anatomy is inferred, and full walking cycles are not present. The front figures retain their visible silhouettes; travel is constrained to avoid requiring speculative full bodies. Larger displacements need another visual review of the overlaps.

## Where to adjust

- `src/components/BinaryCharacter/crowdMotion.ts`: people, offsets, anchors, stride phases and shared timing.
- `crowdLayers.ts`: source ownership, donor restrictions and original alignment.
- `crowdEntrance.ts`: continuous mesh deformation, front/back planes and short-lived renderer.
- `BinaryCharacter.tsx`: component lifecycle and still-image fallback.

Development only: `?crowdT=0`, `0.6`, `1.4`, `2.4` or `3` freezes the actual hero at that time. `&crowdStudy=G` moves only G while retaining the other six at their final pose. These URL controls are ignored in production. The review page derives its stage times from normalized progress and `ENTRANCE_DURATION`, so its controls stay synchronized with timing changes. Its layered-end view compares the rendered crowd with the source outside ME before the final source-image handoff.

## Verification

`npm run build`, `npm run lint`, and `node --experimental-strip-types --test tests/crowdMotion.test.ts` pass (seven motion tests). Browser review covered the start, slowdown and final poses, G moving independently, real hero playback, phone-width playback, and theme changes without replay. Browser error/warning logs were empty during these checks.

The pre-handoff comparison at the 800px review size measured approximately 0.92/255 mean RGB difference outside ME, with about 0.08% of pixels differing by over 20 levels. Raster filtering, ownership seams and translucent overlapping source pixels account for residual differences. The final settled crowd is the original image directly, rather than a regenerated approximation.
