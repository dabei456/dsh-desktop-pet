# -*- coding: utf-8 -*-
"""把大肥鱼 GIF 拆成透明 PNG 序列，并把三视图归到 assets/char/dafeiyu/"""
import shutil
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
REF = ROOT / "_tmp" / "refs"
OUT = ROOT / "assets" / "char" / "dafeiyu"
OUT.mkdir(parents=True, exist_ok=True)

GIFS = {
    "idle": REF / "deepseek-fat-fish-codex-pet" / "assets" / "idle.gif",
    "hover": REF / "deepseek-fat-fish-codex-pet" / "assets" / "hover.gif",
    "working": REF / "deepseek-fat-fish-codex-pet" / "assets" / "working.gif",
    "success": REF / "deepseek-fat-fish-codex-pet" / "assets" / "success.gif",
}

for name, path in GIFS.items():
    if not path.exists():
        print("missing", path)
        continue
    im = Image.open(path)
    n = getattr(im, "n_frames", 1)
    for i in range(n):
        im.seek(i)
        frame = im.convert("RGBA")
        # 用上一帧做底（GIF 帧可能是局部）
        frame.save(OUT / f"{name}_{i}.png")
    print(name, n, im.size)

# 三视图
SPR = REF / "dafeiyu-pet" / "sprites"
for src, dst in [("正面_306.png", "front.png"), ("侧面_306.png", "side.png"), ("背面_306.png", "back.png")]:
    p = SPR / src
    if p.exists():
        shutil.copy2(p, OUT / dst)
        print("copied", dst)
