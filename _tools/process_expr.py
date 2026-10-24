import os, sys
from PIL import Image
from collections import deque

ROOT = r"C:\Users\lin\Desktop\林九\桌宠"
SRC = os.path.join(ROOT, "assets", "char", "expr")
OUT = os.path.join(ROOT, "assets", "char", "expr_cut")
os.makedirs(OUT, exist_ok=True)

def white_to_alpha(im):
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    seen = bytearray(w * h)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            q.append((x, y))
    def is_white(p):
        r, g, b, a = p
        return a > 0 and r > 236 and g > 236 and b > 236 and (max(r, g, b) - min(r, g, b)) < 12
    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h:
            continue
        i = y * w + x
        if seen[i]:
            continue
        seen[i] = 1
        if not is_white(px[x, y]):
            continue
        px[x, y] = (0, 0, 0, 0)
        q.append((x + 1, y)); q.append((x - 1, y))
        q.append((x, y + 1)); q.append((x, y - 1))
    return im

def process(name):
    p = os.path.join(SRC, name)
    im = Image.open(p).convert("RGBA")
    w, h = im.size
    # 右下角 AI 水印：涂白
    d = Image.new("RGBA", (int(w * 0.30), int(h * 0.10)), (255, 255, 255, 255))
    im.paste(d, (int(w * 0.70), int(h * 0.90)))
    im = white_to_alpha(im)
    bbox = im.getbbox()
    if not bbox:
        print(name, "EMPTY")
        return
    body = im.crop(bbox)
    bw, bh = body.size
    # 统一画布：高 1000，宽 760（0.76），底部留 8px
    CH, CW = 1000, 760
    canvas = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    scale = min(CW / bw, (CH - 10) / bh)
    nw, nh = max(1, int(bw * scale)), max(1, int(bh * scale))
    body = body.resize((nw, nh), Image.LANCZOS)
    canvas.alpha_composite(body, ((CW - nw) // 2, CH - nh - 8))
    out = os.path.join(OUT, os.path.splitext(name)[0] + ".png")
    canvas.save(out)
    print(name, "->", out, canvas.size)

for n in sorted(os.listdir(SRC)):
    if n.lower().endswith(".png"):
        process(n)

# 原立绘也走一遍，保证同一画布
base = os.path.join(ROOT, "assets", "char", "dafeiyu", "front.png")
im = Image.open(base).convert("RGBA")
bbox = im.getbbox()
body = im.crop(bbox)
bw, bh = body.size
CH, CW = 1000, 760
canvas = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
scale = min(CW / bw, (CH - 10) / bh)
nw, nh = max(1, int(bw * scale)), max(1, int(bh * scale))
body = body.resize((nw, nh), Image.LANCZOS)
canvas.alpha_composite(body, ((CW - nw) // 2, CH - nh - 8))
canvas.save(os.path.join(OUT, "normal.png"))
print("normal ->", os.path.join(OUT, "normal.png"))
