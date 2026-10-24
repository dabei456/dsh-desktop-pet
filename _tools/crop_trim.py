# -*- coding: utf-8 -*-
"""裁掉透明留白：每组动画用并集 bbox 统一裁剪，避免帧间跳动。"""
from pathlib import Path
from PIL import Image

D = Path(__file__).resolve().parent.parent / "assets" / "char" / "dafeiyu"

GROUPS = {
    "idle": [f"idle_{i}.png" for i in range(6)],
    "hover": [f"hover_{i}.png" for i in range(5)],
    "success": [f"success_{i}.png" for i in range(6)],
    "working": [f"working_{i}.png" for i in range(6)],
    "front": ["front.png"],
    "side": ["side.png"],
    "back": ["back.png"],
}

def solid_bbox(im, thr=12):
    a = im.split()[3].point(lambda v: 255 if v > thr else 0)
    return a.getbbox()

for name, files in GROUPS.items():
    ims = [Image.open(D / f).convert("RGBA") for f in files]
    boxes = [solid_bbox(im) for im in ims]
    boxes = [b for b in boxes if b]
    if not boxes:
        print(name, "no content")
        continue
    union = (min(b[0] for b in boxes), min(b[1] for b in boxes),
             max(b[2] for b in boxes), max(b[3] for b in boxes))
    for f, im in zip(files, ims):
        im.crop(union).save(D / f)
    print(name, union, "size", ims[0].crop(union).size)
