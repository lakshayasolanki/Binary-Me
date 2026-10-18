"""v2 layers: corrected person map (A-G + ME) and ONE moving person, D.

Person map (source px, 1671x941):
  A  far-left head sliver        B  dark profile man with glasses (front-left)
  F  pale head behind B          C  back-turned man left of ME
  D  front-right man: skull (left lobe), bright neck/collar, coat
  G  head tilted behind D's skull: the right lobe with diagonal hair strands and the lit neck
     edge at x~1440-1455. Previously fused into D. Only its upper head/neck is visible.
  E  bald man at the far right

Only D moves in this proof. Everything else is the original pixels in `back`. Where D hides
things, invented fills sit under it:
  - G's hidden head (left half, behind D's skull)
  - G's hidden shoulder / torso (revealed as D walks left->right)
Fills are limited to pixels D covers at rest, so they are invisible in the settled photograph.
No donor imagery is used: the fills are flat black with grain sampled from the photo itself.
There is NO reconstruction inside the binary man's silhouette: D's lower-left edge is the
original coat contour (it already reads as a coat edge), so nothing has to fade out at rest.
"""
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

HERE = Path(__file__).parent
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "layers-v2"
OUT.mkdir(parents=True, exist_ok=True)
PAD = 80
W, H = 1671, 941

orig = np.array(Image.open(HERE / "crowd.png").convert("RGBA"))
opaque = orig[..., 3] > 10


def poly(points):
    m = np.zeros((H, W), np.uint8)
    cv2.fillPoly(m, [np.array(points, np.int32)], 1)
    return m.astype(bool)


# D: skull + neck + collar + coat. The right edge follows the D|G boundary through the head
# (inner curve) and the D|E coat boundary below.
D_REGION = poly([
    (900, 140), (1345, 140), (1352, 200), (1368, 250), (1380, 300), (1372, 350),
    (1352, 395), (1325, 430), (1305, 470), (1306, 520), (1305, 580), (1300, 650),
    (1312, 800), (1325, 941), (900, 941),
])
G_REGION = poly([
    (1345, 140), (1440, 255), (1462, 310), (1455, 400), (1420, 480), (1370, 525),
    (1335, 520), (1306, 520), (1305, 470), (1325, 430), (1352, 395), (1372, 350),
    (1380, 300), (1368, 250), (1352, 200),
])
D_MASK = D_REGION & opaque
G_VISIBLE = G_REGION & opaque


def soft(mask, sigma=0.8):
    return cv2.GaussianBlur(mask.astype(np.float32), (0, 0), sigma)


layer_d = orig.copy()
layer_d[..., 3] = np.clip(orig[..., 3].astype(np.float32) * soft(D_MASK), 0, 255).astype(np.uint8)

# ---- back plate: original minus D, plus invented G fills under D --------------------------
back = orig.copy()
back[D_MASK] = (0, 0, 0, 0)

# grain sampled from D's own dark coat so the fills match the halftone
ref = orig[650:940, 1000:1290, :3]
reps = (int(np.ceil(H / ref.shape[0])) + 1, int(np.ceil(W / ref.shape[1])) + 1, 1)
tile = np.tile(ref, reps)[:H, :W]

# G's hidden head: an ellipse continuing the visible outer contour behind D's skull
ys, xs = np.mgrid[0:H, 0:W]
g_head = (((xs - 1385) / 118.0) ** 2 + ((ys - 345) / 160.0) ** 2) <= 1.0
# G's hidden shoulder: a smooth slope from his neck down and away to the left
g_torso = poly([
    (1306, 466), (1270, 476), (1230, 490), (1190, 510), (1150, 536), (1115, 568),
    (1092, 606), (1080, 660), (1076, 760), (1076, 941), (1330, 941), (1330, 520),
])
fill = (g_head | g_torso) & D_MASK  # only where D hides things at rest
# Extend the fill a few px into G's (opaque) original pixels so the blur below can't leave a
# semi-transparent seam where the fill meets G's visible crescent.
fill_ext = fill | (cv2.dilate(fill.astype(np.uint8), np.ones((9, 9), np.uint8)).astype(bool) & G_VISIBLE)
alpha_fill = soft(fill_ext, 1.0)
for c in range(3):
    back[..., c] = np.where(fill, tile[..., c], back[..., c])
back[..., 3] = np.maximum(back[..., 3], np.clip(alpha_fill * 255, 0, 255).astype(np.uint8))


def pad_bottom(a):
    return np.concatenate([a, np.repeat(a[-1:, :, :], PAD, axis=0)], axis=0)


Image.fromarray(pad_bottom(back)).save(OUT / "back.png", optimize=True)
Image.fromarray(pad_bottom(layer_d)).save(OUT / "D.png", optimize=True)

# ---- annotated person map for review ------------------------------------------------------
im = Image.new("RGBA", (W, H), (255, 0, 255, 255))
im.alpha_composite(Image.fromarray(orig))
a = np.array(im.convert("RGB")).astype(np.float32)
tint = np.zeros_like(a)
tint[D_MASK] = (255, 160, 0)
tint[G_VISIBLE] = (0, 255, 255)
me = np.array(Image.open(HERE / "binary-man-mask.png").convert("RGBA"))[..., 3] > 128
tint[me] = (120, 120, 255)
mask_any = D_MASK | G_VISIBLE | me
a[mask_any] = a[mask_any] * 0.55 + tint[mask_any] * 0.45
img = Image.fromarray(a.astype(np.uint8))
from PIL import ImageDraw, ImageFont

d = ImageDraw.Draw(img)
try:
    f = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 40)
except Exception:
    f = ImageFont.load_default()
for k, (x, y) in {"A": (6, 330), "B": (150, 300), "F": (345, 300), "C": (560, 300), "ME": (800, 420),
                  "D": (1215, 300), "G": (1385, 330), "E": (1530, 300)}.items():
    d.rectangle([x - 6, y - 4, x + len(k) * 30 + 8, y + 50], fill=(255, 255, 255))
    d.text((x, y), k, fill=(0, 0, 0), font=f)
img.save(HERE / "person-map-v2.png")
print("layers-v2 + person-map-v2.png written")
