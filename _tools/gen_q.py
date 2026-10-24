"""把 Q 版大肥鱼重绘成高清 Q 版立绘"""
import base64, json, os, sys, urllib.request
from PIL import Image

KEY = open(r"C:\Users\lin\Desktop\林九\桌宠\_key.txt", encoding="utf-8-sig").read().strip()
SRC = r"C:\Users\lin\Desktop\林九\桌宠\assets\char\dafeiyu\front.png"
OUT = r"C:\Users\lin\Desktop\林九\桌宠\assets\char\whale\q_raw.png"

im = Image.open(SRC).convert("RGBA")
bg = Image.new("RGB", im.size, (255, 255, 255))
bg.paste(im, mask=im.split()[3])
scale = 700 / max(bg.size)
if scale < 1:
    bg = bg.resize((int(bg.width * scale), int(bg.height * scale)), Image.LANCZOS)
tmp = r"C:\Users\lin\Desktop\林九\桌宠\_tmp\q_src.png"
bg.save(tmp, "PNG")
raw = base64.b64encode(open(tmp, "rb").read()).decode()

PROMPT = (
    "把这张 Q 版角色重新绘制成高清精致的二次元插画，严格保持 Q 版比例（头大身小、约三头身），"
    "角色特征不变：深蓝色长发带浅蓝渐变发尾、头顶白色蕾丝女仆头饰、两侧白色鲸鱼鳍状耳饰、"
    "蓝色眼睛、蓝宝石蝴蝶结领结、深蓝色女仆连衣裙配白色荷叶边围裙（围裙上有蓝色小鲸鱼图案）、"
    "白色过膝袜和深蓝小皮鞋、身后有鲸鱼尾巴。纯白背景、正面站立、双手自然下垂、微笑表情、"
    "清晰线条、赛璐璐上色、高质量、无文字无水印。"
)
payload = {
    "model": "Qwen/Qwen-Image-Edit-2509",
    "prompt": PROMPT,
    "image": f"data:image/png;base64,{raw}",
    "image_size": "768x1024",
    "num_inference_steps": 40,
    "seed": 1102,
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
    print("HTTP", e.code, e.read().decode()[:600]); sys.exit(1)

for i, it in enumerate(data.get("images", [])[:1]):
    with urllib.request.urlopen(it["url"], timeout=120) as r:
        open(OUT, "wb").write(r.read())
print("saved", OUT, os.path.getsize(OUT) // 1024, "KB")
