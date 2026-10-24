import json, os, sys, base64, urllib.request, urllib.error
from PIL import Image

KEY = sys.argv[1]
SRC = sys.argv[2]
PROMPT = sys.argv[3]
OUT = sys.argv[4]
MODEL = os.environ.get("SF_EDIT_MODEL", "Qwen/Qwen-Image-Edit-2509")

tmp = r"C:\Users\lin\Desktop\林九\桌宠\_tmp\_edit_src.png"
im = Image.open(SRC).convert("RGBA")
bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
bg.alpha_composite(im)
bg.convert("RGB").resize((976, 1024), Image.LANCZOS).save(tmp)

b64 = base64.b64encode(open(tmp, "rb").read()).decode()
body = {
    "model": MODEL,
    "prompt": PROMPT,
    "image": "data:image/png;base64," + b64,
    "image_size": "1024x1024",
    "batch_size": 1,
    "num_inference_steps": 20,
}
req = urllib.request.Request(
    "https://api.siliconflow.cn/v1/images/generations",
    data=json.dumps(body).encode(),
    headers={"Authorization": "Bearer " + KEY, "Content-Type": "application/json"},
    method="POST",
)
try:
    with urllib.request.urlopen(req, timeout=180) as r:
        d = json.loads(r.read().decode())
        url = d["images"][0]["url"]
        urllib.request.urlretrieve(url, OUT)
        print("OK", OUT, os.path.getsize(OUT))
except urllib.error.HTTPError as e:
    print("ERR", e.code, e.read().decode()[:500])
except Exception as e:
    print("EXC", e)
