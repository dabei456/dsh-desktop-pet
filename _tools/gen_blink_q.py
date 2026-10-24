"""Q 版闭眼帧"""
import base64, json, os, sys, urllib.request
from PIL import Image

KEY = open(r"C:\Users\lin\Desktop\林九\桌宠\_key.txt", encoding="utf-8-sig").read().strip()
W = r"C:\Users\lin\Desktop\林九\桌宠\assets\char\whale"
im = Image.open(os.path.join(W, "q_base.png")).convert("RGBA")
bg = Image.new("RGB", im.size, (255, 255, 255))
bg.paste(im, mask=im.split()[3])
scale = 760 / bg.width
small = bg.resize((760, int(bg.height * scale)), Image.LANCZOS)
tmp = r"C:\Users\lin\Desktop\林九\桌宠\_tmp\q768.png"
small.save(tmp, "PNG")
raw = base64.b64encode(open(tmp, "rb").read()).decode()

payload = {
    "model": "Qwen/Qwen-Image-Edit-2509",
    "prompt": "保持这个 Q 版角色的发型、头饰、服装、姿势、背景和画风完全不变，只把眼睛改成闭上的样子（安静眨眼，睫毛闭合，眼线成一条弧），表情保持温柔微笑。",
    "image": f"data:image/png;base64,{raw}",
    "image_size": f"{small.width}x{small.height}",
    "num_inference_steps": 32,
    "seed": 1103,
}
req = urllib.request.Request(
    "https://api.siliconflow.cn/v1/images/generations",
    data=json.dumps(payload).encode(),
    headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"},
)
try:
    with urllib.request.urlopen(req, timeout=240) as r:
        data = json.loads(r.read())
except urllib.error.HTTPError as e:
    print("HTTP", e.code, e.read().decode()[:500]); sys.exit(1)
out = os.path.join(W, "q_blink_raw.png")
with urllib.request.urlopen(data["images"][0]["url"], timeout=120) as r:
    open(out, "wb").write(r.read())
print("saved", os.path.getsize(out) // 1024, "KB")
