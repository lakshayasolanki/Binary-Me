"""Builds the B / D / back layers for the crowd entrance proof.

Original crowd.png pixels are the source of truth. The generated donors
(generated-proof-v1/) are used only where the photograph has no information:
  - back:    original pixels outside B and D, donor pixels where B/D used to hide things
  - B:       original pixels inside the hand-traced B region
  - D:       original pixels inside the hand-traced D region
  - D_recon: donor pixels inside the binary man's silhouette (D's hidden left shoulder). These
             are faded out as D lands so they never cover him in the final composition.
All outputs are 1671 x (941 + PAD): the bottom row is replicated so bob / lean never exposes
a flat crop edge.
"""
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

HERE = Path(__file__).parent
SRC = HERE / "crowd.png"
MASK = HERE / "binary-man-mask.png"
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "layers-v1"
OUT.mkdir(parents=True, exist_ok=True)
PAD = 80
W, H = 1671, 941


def load(path, width=W):
    a = np.array(Image.open(path).convert("RGBA"))
    if a.shape[1] < width:  # B_full is one column narrow
        a = np.concatenate([a, np.zeros((a.shape[0], width - a.shape[1], 4), np.uint8)], 1)
    return a


orig = load(SRC)
me = load(MASK)[..., 3] > 128
donor_b = load(HERE / "generated-proof-v1/B_full.png")
donor_d = load(HERE / "generated-proof-v1/D_full.png")
donor_back = load(HERE / "generated-proof-v1/back_plate.png")

opaque = orig[..., 3] > 10


def poly(points):
    m = np.zeros((H, W), np.uint8)
    cv2.fillPoly(m, [np.array(points, np.int32)], 1)
    return m.astype(bool)


# --- B: dark profile man + the coat to the white rim line. Excludes A (far-left head sliver),
# F (pale head behind him) and everything right of the rim, which belongs to C.
B_REGION = poly([
    (0, 470), (50, 470), (50, 300), (80, 190), (330, 190), (330, 240), (326, 300),
    (322, 360), (308, 420), (300, 470), (305, 480), (365, 520), (430, 580), (480, 640),
    (515, 720), (522, 800), (505, 860), (500, 941), (0, 941),
])
F_HEAD = poly([
    (318, 245), (340, 232), (400, 242), (440, 320), (447, 375), (415, 400), (405, 470),
    (378, 508), (335, 505), (300, 470), (308, 420), (322, 360), (326, 300),
])
B_MASK = B_REGION & ~F_HEAD & opaque

# --- D: head and torso, cut along the original D/E boundary (D is in front of E). The donor D
# overshoots into E's area, so its alpha is NOT used for the boundary.
D_REGION = poly([
    (900, 140), (1345, 140), (1440, 255), (1462, 310), (1455, 400),
    (1420, 480), (1370, 525), (1335, 520), (1305, 580), (1300, 650), (1312, 800),
    (1325, 941), (900, 941),
])
D_MASK = D_REGION & opaque

# A tiny feather so moving edges stay anti-aliased instead of stair-stepped.
def soft(mask):
    return cv2.GaussianBlur(mask.astype(np.float32), (0, 0), 0.8)


def with_alpha(rgba, mask_soft):
    out = rgba.copy()
    out[..., 3] = np.clip(rgba[..., 3].astype(np.float32) * mask_soft, 0, 255).astype(np.uint8)
    return out


layer_b = with_alpha(orig, soft(B_MASK))
layer_d = with_alpha(orig, soft(D_MASK))

# --- D reconstruction inside the binary man's silhouette (kept separate so it can be faded out).
me_dil = cv2.dilate(me.astype(np.uint8), np.ones((7, 7), np.uint8)).astype(bool)
recon_mask = (donor_d[..., 3] > 128) & ~opaque & me_dil
# Only the part connected to D's real body, left of D's own left edge: keep x >= 840.
recon_mask[:, :840] = False
layer_recon = with_alpha(donor_d, soft(recon_mask))

# --- back plate: original outside B/D, donor where B/D hid things.
hole = cv2.dilate((B_MASK | D_MASK).astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool)
back = orig.copy()
back[hole] = donor_back[hole]


def pad_bottom(a):
    return np.concatenate([a, np.repeat(a[-1:, :, :], PAD, axis=0)], axis=0)


for name, arr in {"back": back, "B": layer_b, "D": layer_d, "D-recon": layer_recon}.items():
    Image.fromarray(pad_bottom(arr)).save(OUT / f"{name}.png", optimize=True)
    print(name, "ok")

# --- sanity: composite at rest vs original, on magenta
def over(bg, fg):
    return Image.alpha_composite(Image.fromarray(bg), Image.fromarray(fg))


rest = Image.fromarray(back)
for layer in (layer_b, layer_d):
    rest = Image.alpha_composite(rest, Image.fromarray(layer))
a = np.array(rest).astype(int)
o = orig.astype(int)
diff = np.abs(a[..., :3] - o[..., :3]).max(-1)
adiff = np.abs(a[..., 3] - o[..., 3])
print("rest vs original: rgb diff>24 px:", int((diff > 24).sum()), " alpha diff>24 px:", int((adiff > 24).sum()))
