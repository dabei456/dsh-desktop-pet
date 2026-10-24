from PIL import Image
from collections import deque
import os

BASE = r'C:\Users\lin\Desktop\林九\桌宠\assets\char\whale'
src = os.path.join(BASE, 'q_sleep_raw.png')
dst = os.path.join(BASE, 'q_sleep.png')

im = Image.open(src).convert('RGBA')
w, h = im.size

# 1) 涂掉右下角“AI 生成”水印
d = im.load()
for y in range(int(h * 0.9), h):
    for x in range(int(w * 0.72), w):
        d[x, y] = (255, 255, 255, 255)

# 2) 边缘 BFS：纯白→透明
px = im.load()
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
    if not (r > 236 and g > 236 and b > 236):
        continue
    seen[i] = 1
    px[x, y] = (r, g, b, 0)
    q.append((x + 1, y)); q.append((x - 1, y)); q.append((x, y + 1)); q.append((x, y - 1))

# 3) 裁边
bbox = Image.eval(im.getchannel('A'), lambda v: 255 if v > 8 else 0).getbbox()
if bbox:
    im = im.crop(bbox)

im.save(dst, 'PNG')
print('OK', dst, im.size)
