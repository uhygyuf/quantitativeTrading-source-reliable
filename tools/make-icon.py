#!/usr/bin/env python
"""Generate quantitativeTrading-source-reliable icon PNGs (512 and 180 px).

Design: rounded teal-to-blue gradient tile, white candlesticks, green uptrend.
Original artwork, no third-party assets. Output goes to ../assets/.
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "assets"
OUT.mkdir(parents=True, exist_ok=True)

SIZE = 512
# Diagonal gradient: #17a589 -> #0b4a8f
c0 = np.array([23, 165, 137], dtype=np.float32)
c1 = np.array([11, 74, 143], dtype=np.float32)
y, x = np.mgrid[0:SIZE, 0:SIZE].astype(np.float32)
t = (x + y) / (2 * (SIZE - 1))
grad = (c0[None, None, :] * (1 - t[..., None]) + c1[None, None, :] * t[..., None]).astype(np.uint8)
img = Image.fromarray(grad, "RGB").convert("RGBA")

mask = Image.new("L", (SIZE, SIZE), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, SIZE - 1, SIZE - 1], radius=96, fill=255)
img.putalpha(mask)
d = ImageDraw.Draw(img)

# Candlesticks: wick + body, ascending, white
candles = [
    (150, 330, 380, 150, 60),   # left
    (256, 270, 330, 200, 56),   # middle
    (362, 200, 270, 250, 62),   # right
]
for cx, top, bottom, body_top, half in candles:
    d.line([cx, top, cx, bottom], fill=(255, 255, 255, 200), width=10)
    d.rounded_rectangle([cx - half // 2, body_top, cx + half // 2, body_top + 96],
                        radius=12, fill=(255, 255, 255, 245))

# Green uptrend check-ish stroke over the candles
trend = (46, 204, 113, 255)
d.line([(120, 392), (236, 300), (330, 236), (414, 168)], fill=trend, width=22, joint="curve")
# Arrow head
d.polygon([(414, 168), (368, 176), (404, 212)], fill=trend)

img.save(OUT / "icon-512.png")
img.resize((180, 180), Image.LANCZOS).save(OUT / "icon-180.png")
print("wrote", OUT / "icon-512.png", "and", OUT / "icon-180.png")
