import os
# -*- coding: utf-8 -*-
"""按「DeepSeek 鲸鱼娘」参考图生成桌宠立绘（正面全身 Q 版，白底）。

用法：
  python _tools\\gen_pet.py            # 生成全部 3 个姿势
  python _tools\\gen_pet.py --one 0    # 只生成第 1 个
"""
import argparse
import base64
import json
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "char" / "立绘"
REF_DIR = ROOT / "_tmp" / "bili_covers"

DS = {
    "url": "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
    "key": os.environ.get("ARK_API_KEY", ""),
    "model": "qwen-image-2.1-pro",
}

CHAR = (
    "角色必须严格照参考图里的「DeepSeek鲸鱼娘」：深蓝色长直发垂到腰、发尾带浅蓝渐变、"
    "两侧鬓角有白色鲸鱼鳍形状的耳饰、头顶白色蕾丝女仆头饰、蓝色眼睛、"
    "深蓝色女仆连衣裙配白色围裙、围裙下摆印着一只蓝色小鲸鱼、领口是蓝色宝石蝴蝶结、"
    "白色过膝袜与深蓝色小皮鞋"
)

BASE = (
    "二次元动漫风格，Q版两头身，干净的日系赛璐璐上色，粗描边，色彩明快，"
    "纯白色背景（#FFFFFF），背景上不要阴影不要渐变，不要文字不要水印不要边框，"
    "角色完整出现在画面内，四周留白"
)

POSES = [
    ("01_正面站", "正面站立，双手自然垂在身体两侧，微微歪头，开心地笑，全身完整"),
    ("02_侧面站", "正面偏侧 30 度站立，一只手抬起打招呼，另一只手垂着，微笑，全身完整"),
    ("03_蹲坐", "坐在地上，双腿并拢，双手放在膝盖上，抬头看镜头，有点好奇的表情，全身完整"),
]


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


def gen(prompt: str, refs: list, dest: Path) -> bool:
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
        print("  ERR", e, flush=True)
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
    ap = argparse.ArgumentParser()
    ap.add_argument("--one", type=int, default=-1)
    a = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    refs = [REF_DIR / "tag_cute.jpg", REF_DIR / "day0_258w.jpg"]
    todo = POSES if a.one < 0 else [POSES[a.one]]
    for name, pose in todo:
        prompt = f"{BASE}。角色设定固定：{CHAR}。姿势：{pose}。"
        dest = OUT / f"{name}.png"
        print(f"[{name}] 生成中 ...", flush=True)
        t0 = time.time()
        ok = gen(prompt, refs, dest)
        print(f"  {'OK' if ok else 'FAIL'} {dest.name} {time.time()-t0:.0f}s", flush=True)
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    raise SystemExit(main())
