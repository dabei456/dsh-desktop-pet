import os
# -*- coding: utf-8 -*-
"""用现有立绘做表情差分：同一角色、同一构图，只换脸。

用法：python _tools\\gen_exp.py
输出：assets\\char\\表情\\raw_<name>.png
"""
import base64
import json
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "char" / "表情"
BASE_PIC = ROOT / "assets" / "char" / "立绘" / "01_正面站.png"
REF_DIR = ROOT / "_tmp" / "bili_covers"

DS = {
    "url": "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
    "key": os.environ.get("ARK_API_KEY", ""),
    "model": "qwen-image-2.1-pro",
}

LOCK = (
    "严格复制参考图1的整张角色：同一角色、同样的深蓝长发与浅蓝发尾、白色蕾丝女仆头饰、"
    "白色鲸鱼鳍耳饰、深蓝白女仆裙、围裙上的蓝色小鲸鱼、蓝宝石蝴蝶结、白色过膝袜与深蓝皮鞋；"
    "姿势、身体朝向、手臂位置、人物大小、构图、纯白色背景全部保持不变。"
    "唯一允许改动的是脸部的表情（眼睛、眉毛、嘴巴）。二次元Q版两头身、日系赛璐璐上色、粗描边。"
    "不要文字不要水印不要边框。"
)

EXPS = {
    "happy": "表情：超级开心，眼睛弯成两道月牙，张嘴笑，脸颊泛红",
    "surprise": "表情：惊讶，眼睛睁得很大，瞳孔缩小，嘴巴张成小圆形，眉毛高高上扬",
    "sleepy": "表情：困倦，眼睛半闭成一条缝，嘴巴小小地打哈欠，头微微下垂",
    "sad": "表情：委屈，眉毛下垂，眼睛里含着泪光，嘴巴微微瘪着要哭",
    "shy": "表情：害羞脸红，眼睛看向一侧，嘴角抿着笑，两只手在胸前",
}


def post_json(url, payload, headers, timeout=300):
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def b64(path: Path) -> str:
    ext = path.suffix.lower().lstrip(".")
    if ext == "jpg":
        ext = "jpeg"
    return f"data:image/{ext};base64," + base64.b64encode(path.read_bytes()).decode()


def download(url, dest: Path, timeout=300) -> bool:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        dest.write_bytes(r.read())
    return dest.stat().st_size > 10000


def gen(prompt: str, refs, dest: Path) -> bool:
    content = [{"image": b64(p)} for p in refs if p.exists()]
    content.append({"text": prompt})
    try:
        j = post_json(
            DS["url"],
            {
                "model": DS["model"],
                "input": {"messages": [{"role": "user", "content": content}]},
                "parameters": {"size": "1024*1024", "n": 1, "prompt_extend": False},
            },
            {"Authorization": "Bearer " + DS["key"], "Content-Type": "application/json"},
        )
    except Exception as e:
        body = ""
        try:
            body = e.read().decode("utf-8", "replace")[:500]
        except Exception:
            pass
        print("  ERR", e, body, flush=True)
        return False
    out = j.get("output") or {}
    url = ""
    for ch in out.get("choices") or []:
        for part in (ch.get("message") or {}).get("content") or []:
            if part.get("image"):
                url = part["image"]
                break
    if not url:
        print("  无图:", json.dumps(out, ensure_ascii=False)[:300], flush=True)
        return False
    return download(url, dest)


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    refs = [BASE_PIC]
    for name, exp in EXPS.items():
        dest = OUT / f"raw_{name}.png"
        if dest.exists() and dest.stat().st_size > 10000:
            print(f"[{name}] 已存在，跳过", flush=True)
            continue
        print(f"[{name}] 生成中 ...", flush=True)
        t0 = time.time()
        ok = gen(LOCK + exp + "。", refs, dest)
        print(f"  {'OK' if ok else 'FAIL'} {dest.name} {time.time()-t0:.0f}s", flush=True)
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    raise SystemExit(main())
