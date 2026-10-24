from PIL import Image
import os
W = r"C:\Users\lin\Desktop\林九\桌宠\assets\char\whale"
for name in ("q_base", "q_blink"):
    im = Image.open(os.path.join(W, name + ".png")).convert("RGBA")
    h = 420
    w = round(im.width * h / im.height)
    im.resize((w, h), Image.LANCZOS).save(os.path.join(W, name + "_s.png"), "PNG", optimize=True)
    print(name + "_s", (w, h), os.path.getsize(os.path.join(W, name + "_s.png")) // 1024, "KB")
