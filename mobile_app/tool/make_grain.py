"""Paper grain tile, after the website's --grain (globals.css): fractal noise
tinted warm brown, at low alpha. Tileable: the noise is blurred with
wrap-around, so the edges meet. Run: python tool/make_grain.py"""
import numpy as np
from PIL import Image

SIZE = 160
rng = np.random.default_rng(7)


def octave(scale: int) -> np.ndarray:
    small = rng.random((SIZE // scale, SIZE // scale))
    big = np.kron(small, np.ones((scale, scale)))
    # Wrap-around box blur so cells soften and the tile repeats cleanly.
    out = big.copy()
    for axis in (0, 1):
        out = (np.roll(out, 1, axis) + out + np.roll(out, -1, axis)) / 3
    return out


noise = 0.6 * octave(1) + 0.4 * octave(2)
noise = (noise - noise.min()) / (noise.max() - noise.min())
alpha = (noise * 0.2 * 255).astype(np.uint8)
rgb = np.zeros((SIZE, SIZE, 3), np.uint8)
rgb[..., 0], rgb[..., 1], rgb[..., 2] = 56, 41, 20  # 0.22, 0.16, 0.08
Image.fromarray(np.dstack([rgb, alpha]), "RGBA").save(
    "assets/img/grain.png", optimize=True
)
