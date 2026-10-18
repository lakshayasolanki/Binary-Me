# Crowd entrance visual review

Verdict: the current implementation demonstrates timing and foreground passage, but does not yet demonstrate the intended illusion of a living crowd settling into a photograph. Do not treat the small proof as visually approved.

Review evidence: current source and layer-building script; supplied light/dark frame sheets; live page inspected at frozen times 0, 0.6, 1.6, 2.4, and 3.1 seconds. These observations assess the sampled sequence, not a frame-by-frame video certification. No implementation changes were made for this review.

## Correct the people before refining movement

The user's updated annotation identifies G behind D. There are seven surrounding figures A–G, plus ME. G's visible upper head is currently included in the D layer. They therefore move as one rigid joined shape. The generated D donor also made this mistake; ChatGPT's earlier identification and donor preparation contributed to it.

Relevant evidence: `build_layers.py:64–71` envelopes both heads in D_REGION. The same mistaken grouping underlies the earlier D generation prompt. Preserve the new seven-person interpretation in subsequent extraction and reconstruction work.

## The visual issues, in priority order

1. **The moving object is not consistently one person.** D/G are fused. Independent motion cannot look human until each moving figure has the right anatomy and boundaries.
2. **The dominant impression is sliding cutouts.** The current movement is whole-layer horizontal travel, slight rigid rotation, and a tiny vertical dip. Head, neck, and torso keep exactly the same relationship throughout. Increasing bob or lean would not establish a believable walk and could amplify a puppet-like effect.
3. **The opening feels staged.** At the start, D/G are pulled toward ME while E stays fixed, exposing a conspicuous light gap on the right. Together with B moving in the opposite direction, the composition reads like foreground pieces parting around the subject. We want people continuing through a shared scene.
4. **The surrounding world has not been brought to life yet.** Only B and D/G move. A/F/C/E remain in a fixed back plate. This was acceptable scope for the requested small proof, but it is not the complete crowd effect and should not be judged or presented as such.
5. **Parts of the landing are concealed by opacity changes.** D's reconstructed shoulder fades over the last 70 source pixels of travel, then the animation layers are removed and the original photo is shown. The frozen end looks broadly close at the rendered size; the swap is not the largest visible problem. Nevertheless, solid clothing must not visibly dissolve or reveal a moving ME-shaped notch. The last moving pose and first still frame should be visually continuous.

## What is sound

The binary man stays in position. The foreground can cover his backing, digits, and halo. The speed profile genuinely rises and then falls: it starts at 30% of peak, reaches its peak around 0.5 seconds, stays near that speed until roughly 1.2 seconds, and then reaches zero at 3 seconds. At 2.4 seconds B has only about 2.7 source pixels of travel left. This is a reasonable soft landing; timing is not the first thing to rewrite.

The final original photograph is preserved by the end-state swap. A separate compositing check found small, localized discrepancies before that swap, so it should not be described as pixel-identical throughout. A swap is acceptable only if viewers cannot detect it; a correct final screenshot alone does not validate the transition.

## Reality check on the source material

Separate PNGs solve overlap and reveal. They do not supply missing walking poses. One still photograph cannot establish what the hidden people look like or how their bodies change during a stride. Generated concealed areas are interpretations. The current donors can help fill gaps, but they do not solve gait.

Do not promise realistic multi-step walking from rigid translation plus bob alone. Prove a convincing short passage at the actual hero size first. If the source cannot support the intended walk, state that plainly and explain what additional motion material or pose work is needed. Do not disguise the limit with more shaking, more blur, or a longer animation.

## Direction for the next proof

- Correct the A–G person map and separate G from D before proceeding.
- Keep the useful timing curve and fixed ME treatment while reassessing the visual motion.
- Demonstrate one properly isolated person's brief, weighted passage with believable occlusion. The individual should feel like a person moving through space, not a portrait being dragged across the screen.
- Keep opening gaps, overlaps, and exposed reconstructions plausible. Travel distance should be justified by the scene, not by how much of ME it can hide.
- Make the passage resolve with solid, stable anatomy. No visibly fading shoulders or sudden contour corrections.
- Judge the proof at normal playback speed in the actual hero, on both white and black, alongside its last moving and first still frames.
- Once that proof earns approval, extend the same quality to the remaining surrounding figures, with restrained individual variation and a shared overall slowdown.

The acceptance question is: does this feel like an ongoing crowd gathering momentum, losing speed, and becoming a photograph around a still person? At present, the answer is no. The current work is a useful feasibility prototype, not yet the intended visual result.
