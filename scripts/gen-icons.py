"""Generates the mascot app icons (M0) from the palette in docs/design/tokens.md.

Draws the same creature as docs/design/mascotte-etats.html's `idle` pose
(round yellow/mandarine body, green leaf, two eyes, pink cheeks) with PIL
primitives rather than rasterizing the SVG, since no SVG rasterizer
(rsvg-convert, cairosvg's native cairo dependency) is available in this
environment. Not meant to be run in CI: a one-off generator, output is
committed under apps/web/public/icons/.
"""

import math
from PIL import Image, ImageDraw

CREME = (255, 246, 233, 255)
ENCRE = (43, 33, 64, 255)
SOLEIL = (255, 198, 66, 255)
VERT = (63, 198, 107, 255)
JOUE = (255, 93, 143, 140)


def draw_mascot(size: int, background=None) -> Image.Image:
    scale = size / 160
    img = Image.new("RGBA", (size, size), background if background else (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    def pt(x, y):
        return (x * scale, y * scale)

    def ellipse(cx, cy, rx, ry, fill, outline=None, width=4):
        d.ellipse(
            [pt(cx - rx, cy - ry), pt(cx + rx, cy + ry)],
            fill=fill,
            outline=outline,
            width=max(1, round(width * scale)),
        )

    # Leaf stem
    d.line([pt(80, 44), pt(80, 22)], fill=ENCRE, width=max(1, round(4 * scale)))
    # Leaf
    ellipse(96, 18, 15, 8, VERT, ENCRE, 4)
    # Ears
    ellipse(30, 56, 12, 8, SOLEIL, ENCRE, 4)
    ellipse(130, 56, 12, 8, SOLEIL, ENCRE, 4)
    # Body
    ellipse(80, 88, 46, 42, SOLEIL, ENCRE, 4)
    # Eyes
    ellipse(66, 80, 7, 7, ENCRE)
    ellipse(94, 80, 7, 7, ENCRE)
    # Cheeks
    ellipse(52, 96, 7.5, 5, JOUE)
    ellipse(108, 96, 7.5, 5, JOUE)
    # Smile
    d.arc(
        [pt(68, 84), pt(92, 104)],
        start=20,
        end=160,
        fill=ENCRE,
        width=max(1, round(4 * scale)),
    )
    return img


def maskable(size: int) -> Image.Image:
    # Maskable icons need safe-zone padding (~10%) and an opaque background,
    # since the OS can crop to any shape.
    img = Image.new("RGBA", (size, size), CREME)
    mascot = draw_mascot(round(size * 0.8))
    img.paste(mascot, (round(size * 0.1), round(size * 0.1)), mascot)
    return img


if __name__ == "__main__":
    import os

    out_dir = os.path.join(os.path.dirname(__file__), "..", "apps", "web", "public", "icons")
    os.makedirs(out_dir, exist_ok=True)

    for size in (192, 512):
        draw_mascot(size).save(os.path.join(out_dir, f"icon-{size}.png"))
        maskable(size).save(os.path.join(out_dir, f"icon-{size}-maskable.png"))

    # apple-touch-icon: iOS ignores the web manifest for the home-screen
    # icon and reads this link tag instead (docs/inventaire-studia.md,
    # point ouvert n°1 — iPad is a likely target). Opaque background:
    # iOS fills transparency with black otherwise.
    apple = Image.new("RGBA", (180, 180), CREME)
    mascot = draw_mascot(round(180 * 0.82))
    apple.paste(mascot, (round(180 * 0.09), round(180 * 0.09)), mascot)
    apple.convert("RGB").save(os.path.join(out_dir, "apple-touch-icon.png"))

    print("Icons written to", out_dir)
