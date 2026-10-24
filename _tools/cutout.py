# -*- coding: utf-8 -*-
"""把生成的纯白底立绘抠成透明 PNG（只删与边缘连通的白，保留角色内部白色）。"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "char" / "立绘"
DST = ROOT / "assets" / "char" / "透明"


def cut_one(src: Path, dst: Path, thresh: int = 42) -> tuple:
    im = Image.open(src).convert("RGBA")
    w, h = im.size
    rgb = im.convert("RGB")
    # 四个角 + 四边中点，凡是接近纯白的都当背景起点
    seeds = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]
    mask = Image.new("L", (w, h), 255)
    for s in seeds:
        px = rgb.getpixel(s)
        if min(px) >= 255 - thresh:
            ImageDraw.floodfill(rgb, s, (255, 0, 255), thresh=thresh)

    data = rgb.load()
    alpha = mask.load()
    for y in range(h):
        for x in range(w):
            if data[x, y] == (255, 0, 255):
                alpha[x, y] = 0

    out = im.copy()
    out.putalpha(mask)
    bbox = out.split()[3].getbbox()
    if bbox:
        pad = 6
        bbox = (max(0, bbox[0] - pad), max(0, bbox[1] - pad), min(w, bbox[2] + pad), min(h, bbox[3] + pad))
        out = out.crop(bbox)
    dst.parent.mkdir(parents=True, exist_ok=True)
    out.save(dst)
    return out.size


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    for p in sorted(SRC.glob("*.png")):
        d = DST / (p.stem + ".png")
        size = cut_one(p, d)
        print("OK", d.name, size, f"{d.stat().st_size/1024:.0f}KB")
