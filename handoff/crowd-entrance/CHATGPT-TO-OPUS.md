# Crowd entrance: first visual proof handoff

The first three generated candidates are available in `generated-proof-v1/`.
These are **reconstruction donors, not approved drop-in final layers**. Keep the original `crowd.png` and `binary-man-mask.png` as the source of truth.

## Delivered assets and checks

| Asset | Actual dimensions | Mode | Intended use |
| --- | --- | --- | --- |
| `generated-proof-v1/B_full.png` | 1670 × 941 | RGBA | B contour/body reconstruction candidate; one column narrower than required |
| `generated-proof-v1/D_full.png` | 1671 × 941 | RGBA | Natural left shoulder/coat reconstruction for D |
| `generated-proof-v1/back_plate.png` | 1671 × 941 | RGBA | Completed A/F/C/E background group for temporary reveals |

All three have genuine transparent areas, not baked checkerboards. Their alpha is not strictly opaque inside the figures, and some faint color remains. They do **not** satisfy the requested exact-copy source-pixel requirement. D/back dimensions pass; B dimensions fail. Exact edge registration and seam-free final composition are not certified.

An attempted generative one-column canvas correction also failed (returned 1670 × 942 and altered details), so it was rejected. Use the first B candidate supplied here. When preparing its usable layer, preserve the source coordinate scale and extend the canvas on the right; do not stretch it to fit.

The built-in image generation tool produced these assets. Exact prompts are saved in `imagegen-prompts.json`; the rejected correction prompt is in `generated-proof-v1/B-correction-prompt.txt`.

`generated-proof-v1/review.html` provides original/candidate, individual-layer, and white/black/magenta comparisons. It is a review artifact only and does not modify the app.

The comparison was opened in the running local site and visually checked on white, black, and magenta. It confirms the changed grain/contours and reconstructed material entering the central opening; it does not pass an exact final-frame comparison. No animated integration has been tested in this handoff.

## Visual interpretation

- **B and F:** Two opposing profiles appear to be present, so treating F as separate is reasonable. B has the dark left-facing face/glasses; F has the pale right-facing profile. Their hidden anatomy is still inferred, not recoverable fact.
- **B direction:** Starting right of his final position and moving left is plausible. Preserve the original visible head, glasses, collar, and coat. The generated skull rim/neck differ from the source.
- **D direction:** Rightward movement with a slight sense of moving away fits his rear/three-quarter pose. Avoid a broad flat sideways slide or exaggerated shoulder rocking. The donor left shoulder is useful, but other visible detail has changed.
- **C and E:** C reads as walking away/right; E faces right. Exact trajectories cannot be proven from cropped upper-body poses. E moving right from an earlier left position is plausible.
- **A:** Too little is visible to infer a reliable gait; keep his movement restrained and consistent with the neighbouring crowd.
- **F reconstruction:** The hidden left side of his head and much of his torso are speculative. Keep those invented areas briefly visible or partly obscured. The source cannot justify a precise maximum travel distance, so judge it in motion rather than assuming 330/260/250 px are already validated.

## Required change to the integration plan

Use original source pixels for the visible faces, collars, silhouettes, and clothing. Use these generated candidates only where the photograph has no information. Importing the complete generated figures would change the final photograph.

Completing D inside the ME-shaped hole creates a final-occlusion conflict: if the completed D remains above the binary man's stack at its final alignment, those new pixels will keep covering him. Account for final visibility explicitly. The binary man must end with the original full silhouette, with no visible swap, ghosting, or sudden contour change. Preserve his mask and existing rendering; do not permanently subtract the ME hole from the moving full-person cutout, which would make a person-shaped bite travel through the scene.

Foreground people must cover the binary man's backing, digits, AND halo during the pass. At rest, all concealed reconstructions must remain concealed where the original composition conceals them.

## Source facts from the current component

- Source and handoff crowd/mask files are byte-identical, all 1671 × 941.
- The mask uses alpha, not luminance; it is white RGB, so it looks blank on white.
- The renderer's alpha > 10 silhouette bounds are x505, y211, width493, height730. Raw nonzero-alpha bounds span the canvas because of very faint noise.
- Crowd and ME mask have no pixels where both alpha values exceed 10. The original meaningful silhouettes therefore do not overlap.
- Most crowd interior alpha is 252/253, and most mask interior alpha is 253/254. Adding opaque content below the original can change the composite, even when visible RGB is copied. Check the result on white and black.
- The source includes grain gray values and a small amount of RGB tint/fringe. Preserve its appearance rather than globally forcing every source pixel to strict black or white.
- The component clips at its bounds. Do not let bob, rotation, or translation expose the figures' flat lower crop edges.

## Next action for Opus

Continue the small B/D motion proof using the original visible regions and these hidden-area donors. Preserve the approved feeling: immediate acceleration, brief lively peak, quick slowdown, short soft landing into the exact photograph. Keep secondary movement restrained and let it disappear with speed.

Show the initial occlusion, peak motion, slowdown, and settled frame in context. Compare the settled frame to the original in both themes. Report any remaining invented-area artifact instead of calling these assets pixel-perfect. A/F/C/E may stay fixed for this proof, but the completed version must address the intended motion of the surrounding crowd.

If a repair is needed, send the specific troublesome frame/region and desired change. Do not regenerate the complete crowd to fix a local seam.

No production source files or original images were modified during this handoff.
