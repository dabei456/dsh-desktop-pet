# -*- coding: utf-8 -*-
"""把 GIF 帧的灰底(#EEEDED)变透明：只清「与图像边缘连通」的灰底，人物内部阴影不动。"""
from collections import deque
from pathlib import Path
from PIL import Image

D = Path(__file__).resolve().parent.parent / "assets" / "char" / "dafeiyu"

def is_bg(px, tol=10):
    r, g, b, a = px
    if a == 0:
        return True
    mx, mn = max(r, g, b), min(r, g, b)
    # 低饱和 + 中灰到浅灰 = 棋盘/灰底；白裙(≈255 纯白)也排除在外（>252）
    return (mx - mn) <= 12 and 170 <= r <= 252

def cutout(p: Path):
    im = Image.open(p).convert("RGBA")
    w, h = im.size
    px = im.load()
    seen = bytearray(w * h)
    q = deque()
    for x in range(w):
        q.append((x, 0)); q.append((x, h - 1))
    for y in range(h):
        q.append((0, y)); q.append((w - 1, y))
    n = 0
    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h:
            continue
        i = y * w + x
        if seen[i]:
            continue
        seen[i] = 1
        if not is_bg(px[x, y]):
            continue
        px[x, y] = (0, 0, 0, 0)
        n += 1
        q.append((x + 1, y)); q.append((x - 1, y)); q.append((x, y + 1)); q.append((x, y - 1))
    im.save(p)
    return n, im.split()[3].getbbox()

for p in sorted(D.glob("*.png")):
    if p.stem in ("front", "side", "back"):
        continue
    n, bb = cutout(p)
    print(p.name, "cleared=", n, "bbox=", bb)
