"""Animated GIFs for the story player ("イーサリアムの黄金のアイコンを探せ"（仮）).

    python scripts/story_gifs.py

Writes to public/story/:
  glass-strata.gif / .png  A glass vessel in which layers settle one by one (sand, water, sand…),
                           grains falling, the water band swaying. Year 3's plateaus: one layer per
                           year. Loops seamlessly.
  voxel-heart.gif / .png   Behind the quantum world, inside a card slot, a field of voxels beats like
                           a heart (lub-dub, about once a second), with sideways glitch slices. An
                           endless loop.
The .png is the still frame used when the viewer prefers reduced motion.
Rules: no flashing (nothing turns on and off faster than 3 times a second; the glitch slides, it
never strobes); original shapes only (no artwork, faces or logos from anyone else's work).
"""
from __future__ import annotations

import math
import pathlib
import random

from PIL import Image, ImageDraw

OUT = pathlib.Path(__file__).resolve().parent.parent / "public" / "story"
OUT.mkdir(parents=True, exist_ok=True)


def save(frames: list[Image.Image], name: str, ms: int) -> None:
    pal = [f.convert("P", palette=Image.ADAPTIVE, colors=64) for f in frames]
    pal[0].save(OUT / f"{name}.gif", save_all=True, append_images=pal[1:], duration=ms, loop=0, optimize=True, disposal=2)
    frames[len(frames) // 2].save(OUT / f"{name}.png")
    print(name, len(frames), "frames,", (OUT / f"{name}.gif").stat().st_size // 1024, "KB")


# ---------- 1. glass strata ----------
def glass_strata() -> None:
    W, H, N = 240, 300, 48
    LAYERS = [(214, 196, 150), (120, 160, 190), (196, 170, 120), (90, 130, 170), (230, 214, 170), (168, 140, 100)]
    x0, x1, y0, y1 = 60, 180, 40, 270
    rng = random.Random(3)
    grains = [(rng.uniform(x0 + 6, x1 - 6), rng.uniform(0, 1)) for _ in range(70)]
    frames = []
    for f in range(N):
        t = f / N
        im = Image.new("RGB", (W, H), (246, 244, 239)); d = ImageDraw.Draw(im)
        filled = 3 + 3 * t  # layers grow from 3 to 6 over the loop, then the loop restarts at 3 (the lid "resets")
        lh = (y1 - y0) / 6.5
        for k, col in enumerate(LAYERS):
            part = max(0.0, min(1.0, filled - k))
            if part <= 0:
                continue
            top = y1 - lh * (k + part)
            water = k % 2 == 1
            if water:  # the water band sways: its top edge is a moving sine
                pts = [(x, top + 2.2 * math.sin(2 * math.pi * (x / 40 + t * 2))) for x in range(x0, x1 + 1, 4)]
                d.polygon(pts + [(x1, y1 - lh * k), (x0, y1 - lh * k)], fill=col)
            else:  # sand: a gently uneven top
                pts = [(x, top + 1.5 * math.sin(x * 0.31 + k)) for x in range(x0, x1 + 1, 4)]
                d.polygon(pts + [(x1, y1 - lh * k), (x0, y1 - lh * k)], fill=col)
                for gx in range(x0 + 3, x1 - 2, 7):  # a few darker grains in the sand
                    gy = y1 - lh * k - (gx * 13 % int(max(2, lh * part)))
                    d.point((gx, gy), fill=(col[0] - 40, col[1] - 40, col[2] - 40))
        # falling grains into the current top layer
        surface = y1 - lh * filled
        for gx, phase in grains:
            p = (phase + t * 3) % 1
            gy = y0 + p * (surface - y0)  # grains start at the rim
            if gy < surface - 2:
                d.ellipse((gx - 1, gy - 1, gx + 1, gy + 1), fill=(150, 120, 70))
        # glass: outline, rim, a highlight stripe
        d.rounded_rectangle((x0 - 4, y0 - 8, x1 + 4, y1 + 4), radius=10, outline=(60, 70, 80), width=3)
        d.line((x0 + 8, y0 + 4, x0 + 8, y1 - 10), fill=(255, 255, 255), width=3)
        d.line((x0 - 8, y0 - 8, x1 + 8, y0 - 8), fill=(60, 70, 80), width=3)
        d.text((10, H - 18), f"strata {int(filled)} / 6", fill=(87, 83, 78))
        frames.append(im)
    save(frames, "glass-strata", 90)


# ---------- 2. voxel heartbeat in a card slot ----------
HEART = [  # an upright pixel heart, 11 × 10 (1 = voxel)
    "01110001110",
    "11111011111",
    "11111111111",
    "11111111111",
    "11111111111",
    "01111111110",
    "00111111100",
    "00011111000",
    "00001110000",
    "00000100000",
]


def voxel_heart() -> None:
    W, H, N = 260, 220, 36
    frames = []
    def beat(t: float) -> float:  # lub-dub: two bumps per cycle (one cycle per loop ≈ 1 s)
        return math.exp(-((t - 0.12) / 0.05) ** 2) + 0.6 * math.exp(-((t - 0.32) / 0.06) ** 2)
    rng = random.Random(7)
    rows, cols = len(HEART), len(HEART[0])
    for f in range(N):
        t = f / N; b = beat(t)
        im = Image.new("RGB", (W, H), (14, 17, 30)); d = ImageDraw.Draw(im)
        # floor of small voxels, a slow wave running across (the slot's circuit board)
        for gx in range(0, 15):
            for gz in range(0, 4):
                hgt = 1.5 + 1.5 * math.sin(2 * math.pi * (t + gx / 15))
                x = 40 + gx * 12 + gz * 6; y = 170 + gz * 6
                d.rectangle((x, y - hgt, x + 9, y + 3), fill=(50, 66, 104))
        # the card slot frame
        d.rounded_rectangle((18, 18, W - 18, H - 18), radius=8, outline=(217, 180, 90), width=2)
        d.rectangle((W // 2 - 30, 14, W // 2 + 30, 22), fill=(14, 17, 30), outline=(217, 180, 90))
        # upright voxel heart: each voxel a cube seen slightly from above-right; the beat swells it
        sc = 1 + 0.12 * b; s = 11 * sc; depth = 4 + 7 * b
        ox = W / 2 - cols * s / 2; oy = 96 - rows * s / 2
        for r in range(rows):
            for c in range(cols):
                if HEART[r][c] != "1":
                    continue
                x = ox + c * s; y = oy + r * s
                red = (205, 38, 58); top = (240, 90, 104); side = (130, 22, 38)
                d.polygon([(x, y), (x + depth * 0.8, y - depth * 0.6), (x + s + depth * 0.8, y - depth * 0.6), (x + s, y)], fill=top)
                d.polygon([(x + s, y), (x + s + depth * 0.8, y - depth * 0.6), (x + s + depth * 0.8, y + s - depth * 0.6), (x + s, y + s)], fill=side)
                d.rectangle((x, y, x + s - 1, y + s - 1), fill=red)
        # glitch: a few horizontal slices slide sideways for two frames (no brightness flashes)
        if f % 12 in (5, 6):
            for _ in range(3):
                y = rng.randint(30, H - 40); hgt = rng.randint(3, 9); dx = rng.choice([-7, -4, 4, 7])
                band = im.crop((0, y, W, y + hgt)); im.paste(band, (dx, y))
        d = ImageDraw.Draw(im)
        d.text((26, H - 34), "slot://quantum/backside", fill=(150, 160, 190))
        frames.append(im)
    save(frames, "voxel-heart", 30)


if __name__ == "__main__":
    glass_strata()
    voxel_heart()
