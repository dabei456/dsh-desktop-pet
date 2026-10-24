"""用 Qwen-Image-Edit 生成闭眼帧（只改眼睛）"""
import base64, json, os, sys, urllib.request
from PIL import Image

KEY = open(r"C:\Users\lin\Desktop\林九\桌宠\_key.txt", encoding="utf-8-sig").read().strip()
SRC = r"C:\Users\lin\Desktop\林九\桌宠\assets\char\whale\base.png"
OUT = r"C:\Users\lin\Desktop\林九\桌宠\assets\char\whale\blink_raw.png"

im = Image.open(SRC).convert("RGBA")
bg = Image.new("RGB", im.size, (255, 255, 255))
bg.paste(im, mask=im.split()[3])
# 缩到宽 768 送模型
scale = 768 / bg.width
small = bg.resize((768, int(bg.height * scale)), Image.LANCZOS)
tmp = r"C:\Users\lin\Desktop\林九\桌宠\_tmp\whale_768.png"
small.save(tmp, "PNG")
raw = base64.b64encode(open(tmp, "rb").read()).decode()

payload = {
    "model": "Qwen/Qwen-Image-Edit-2509",
    "prompt": "保持这个角色的发型、服装、姿势、背景和画风完全不变，只把眼睛改成闭上的样子（安静眨眼），睫毛闭合，表情不变。",
    "image": f"data:image/png;base64,{raw}",
    "image_size": f"{small.width}x{small.height}",
    "num_inference_steps": 30,
    "seed": 20261024,
}
req = urllib.request.Request(
    "https://api.siliconflow.cn/v1/images/generations",
    data=json.dumps(payload).encode(),
    headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"},
)
try:
    with urllib.request.urlopen(req, timeout=180) as r:
        data = json.loads(r.read())
except urllib.error.HTTPError as e:
    print("HTTP", e.code, e.read().decode()[:500])
    sys.exit(1)

url = data["images"][0]["url"]
print("url ok", url[:60])
with urllib.request.urlopen(url, timeout=120) as r:
    open(OUT, "wb").write(r.read())
print("saved", OUT, os.path.getsize(OUT) // 1024, "KB")
