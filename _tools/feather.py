from PIL import Image
import os

BASE = r'C:\Users\lin\Desktop\林九\桌宠\assets\char\whale'
NAMES = ['q_base', 'q_blink', 'q_sleep', 'q_stretch', 'q_sit', 'q_wave', 'q_shy']


def feather(im):
    """把贴边的亮像素（白边）羽化掉，避免抠白后一圈毛边。"""
    w, h = im.size
    px = im.load()
    src = im.copy().load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = src[x, y]
            if a == 0:
                continue
            # 邻接透明？
            edge = False
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and src[nx, ny][3] == 0:
                    edge = True
                    break
            if not edge:
                continue
            lum = (r + g + b) / 3.0
            if lum > 248:
                px[x, y] = (r, g, b, 0)
            elif lum > 200:
                px[x, y] = (r, g, b, int(a * (248 - lum) / 48.0))
    return im


for n in NAMES:
    p = os.path.join(BASE, n + '.png')
    if not os.path.exists(p):
        print('MISS', n)
        continue
    im = Image.open(p).convert('RGBA')
    im = feather(im)
    im.save(p, 'PNG')
    print('OK', n, im.size)
