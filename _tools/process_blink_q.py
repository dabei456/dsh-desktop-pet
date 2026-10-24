import os
from collections import deque
from PIL import Image, ImageDraw

W = r"C:\Users\lin\Desktop\林九\桌宠\assets\char\whale"
raw = Image.open(os.path.join(W, "q_blink_raw.png")).convert("RGBA")
w, h = raw.size
d = ImageDraw.Draw(raw)
d.rectangle([w - 210, h - 70, w, h], fill=(255, 255, 255, 255))

px = raw.load()
TH = 236
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
    if r < TH or g < TH or b < TH or abs(r - g) > 14 or abs(g - b) > 14:
        continue
    seen[i] = 1
    px[x, y] = (r, g, b, 0)
    q.append((x + 1, y)); q.append((x - 1, y)); q.append((x, y + 1)); q.append((x, y - 1))

base = Image.open(os.path.join(W, "q_base.png"))
raw = raw.crop(raw.getbbox()).resize(base.size, Image.LANCZOS)
raw.save(os.path.join(W, "q_blink.png"), "PNG", optimize=True)
print("q_blink", raw.size, os.path.getsize(os.path.join(W, "q_blink.png")) // 1024, "KB")
