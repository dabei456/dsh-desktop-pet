"""处理闭眼帧：去水印 + 抠白底 + 对齐到 base 尺寸"""
import os
from collections import deque
from PIL import Image, ImageDraw

W = r"C:\Users\lin\Desktop\林九\桌宠\assets\char\whale"
raw = Image.open(os.path.join(W, "blink_raw.png")).convert("RGBA")
w, h = raw.size

# 1) 涂白右下角水印
d = ImageDraw.Draw(raw)
d.rectangle([w - 190, h - 60, w, h], fill=(255, 255, 255, 255))

# 2) 抠白
px = raw.load()
TH = 238
seen = bytearray(w * h)
q = deque()
for x in range(w):
    q.append((x, 0)); q.append((x, h - 1))
for y in range(h):
    q.append((0, y)); q.append((w - 1, y))
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
    q.append((x + 1, y)); q.append((x - 1, y)); q.append((x, y + 1)); q.append((x, y - 1))

# 3) 对齐到 base 尺寸（两者都是同一张图缩放来的，直接 resize）
base = Image.open(os.path.join(W, "base.png"))
raw = raw.resize(base.size, Image.LANCZOS)
raw.save(os.path.join(W, "blink.png"), "PNG", optimize=True)
print("blink", raw.size, os.path.getsize(os.path.join(W, "blink.png")) // 1024, "KB")
