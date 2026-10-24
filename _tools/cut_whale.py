"""把白底立绘抠成透明，输出到 assets/char/whale/"""
import os
from collections import deque
from PIL import Image

SRC = r"C:\Users\lin\Desktop\林九\桌宠\_tmp\blue-fish-archive\原始立绘\deepseek_whale.png"
OUT = r"C:\Users\lin\Desktop\林九\桌宠\assets\char\whale"
os.makedirs(OUT, exist_ok=True)

im = Image.open(SRC).convert("RGBA")
w, h = im.size
px = im.load()

# 从四边泛洪，清掉接近纯白的背景（含轻微渐变）
TH = 238
seen = bytearray(w * h)
q = deque()
for x in range(w):
    for y in (0, h - 1):
        q.append((x, y))
for y in range(h):
    for x in (0, w - 1):
        q.append((x, y))

while q:
    x, y = q.popleft()
    if x < 0 or y < 0 or x >= w or y >= h:
        continue
    i = y * w + x
    if seen[i]:
        continue
    r, g, b, a = px[x, y]
    if r < TH or g < TH or b < TH or abs(r - g) > 12 or abs(g - b) > 12:
        continue
    seen[i] = 1
    px[x, y] = (r, g, b, 0)
    q.append((x + 1, y))
    q.append((x - 1, y))
    q.append((x, y + 1))
    q.append((x, y - 1))

bbox = im.getbbox()
im = im.crop(bbox)
im.save(os.path.join(OUT, "base.png"), "PNG", optimize=True)
print("saved", im.size, os.path.getsize(os.path.join(OUT, "base.png")) // 1024, "KB")

# 一份缩到 1/2 用于快速预览
im.resize((im.width // 2, im.height // 2), Image.LANCZOS).save(
    os.path.join(OUT, "base_half.png"), "PNG", optimize=True
)
print("ok")
