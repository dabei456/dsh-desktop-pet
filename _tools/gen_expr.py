"""基于 front.png 生成同一角色的表情差分帧（眨眼/微笑/惊讶/开心）"""
import base64, json, os, sys, time, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF = os.path.join(ROOT, "assets", "char", "dafeiyu", "front.png")
OUT = os.path.join(ROOT, "assets", "char", "dafeiyu2")
os.makedirs(OUT, exist_ok=True)

CFG = r"C:\Users\lin\Desktop\林九\阿念\qbot\config.json"
cfg = json.load(open(CFG, encoding="utf-8"))
im = cfg["media"]["imagine"]
key = im.get("api_key") or im.get("dashscope_api_key")
base = (im.get("base_url") or "").rstrip("/")
model = im.get("model") or "qwen-image-2.1-pro"

with open(REF, "rb") as f:
    ref_b64 = "data:image/png;base64," + base64.b64encode(f.read()).decode()

BASE_PROMPT = (
    "保持参考图里这个角色的全部外观细节完全一致：深蓝色长发（发尾浅蓝渐变）、"
    "白色蕾丝女仆头饰、两侧白色鲸鱼鳍状耳饰、深蓝白色女仆裙、白色围裙上印着蓝色小鲸鱼、"
    "领口蓝宝石蝴蝶结、白色过膝袜、深蓝小皮鞋、Q版二头身比例、精致插画上色风格。"
    "只改变表情，其他所有细节、姿势、构图、服装都不变。正面全身站立，纯白背景，不要阴影，不要文字。"
)

EXPRS = {
    "blink": "表情：双眼轻轻闭合（眨眼瞬间），嘴角微微上扬微笑。",
    "smile": "表情：开心地眯眼笑，张开小嘴露出一点点牙齿，脸颊红晕。",
    "surprise": "表情：睁大眼睛，嘴巴张成小圆形，露出惊讶的表情。",
}


def gen(name, expr):
    prompt = BASE_PROMPT + expr
    body = {
        "model": model,
        "input": {
            "messages": [
                {"role": "user", "content": [{"image": ref_b64}, {"text": prompt}]}
            ]
        },
        "parameters": {"size": "1024*1024", "n": 1, "prompt_extend": False, "watermark": False},
    }
    req = urllib.request.Request(
        base + "/api/v1/services/aigc/multimodal-generation/generation",
        data=json.dumps(body).encode(),
        headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"},
        method="POST",
    )
    t0 = time.time()
    try:
        raw = json.loads(urllib.request.urlopen(req, timeout=180).read())
    except urllib.error.HTTPError as e:
        print(name, "HTTP", e.code, e.read()[:300]); return
    url = None
    for it in (raw.get("output", {}).get("choices", [{}])[0].get("message", {}).get("content", []) or []):
        if isinstance(it, dict) and it.get("image"):
            url = it["image"]
    if not url:
        print(name, "no url", json.dumps(raw)[:300]); return
    dst = os.path.join(OUT, name + ".png")
    urllib.request.urlretrieve(url, dst)
    print(name, "ok", round(time.time() - t0, 1), "s", os.path.getsize(dst), "bytes")


for n, e in EXPRS.items():
    gen(n, e)
