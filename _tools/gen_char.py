import os
# -*- coding: utf-8 -*-
"""桌宠形象候选生成（不走 qbot 的写真包装，直接调图像 API，纯标准库）。

用法：
  python _tools\\gen_char.py            # 生成全部候选
  python _tools\\gen_char.py --one 0    # 只生成第 1 个
"""
import argparse
import json
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "char" / "候选"

ARK = {
    "url": "https://ark.cn-beijing.volces.com/api/v3/images/generations",
    "key": os.environ.get("ARK_KEY", ""),
    "model": "doubao-seedream-5-0-flash-260915",
}

DS = {
    "url": "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
    "key": os.environ.get("ARK_API_KEY", ""),
    "model": "qwen-image-2.1-pro",
}

BASE = (
    "二次元动漫风格，Q版三头身，全身立绘，正面站立，双手自然垂放，"
    "大眼睛有高光，圆脸，萌系，日系赛璐璐上色，干净的粗描边，色彩明快，"
    "纯白色背景，无阴影投在背景上，不要文字，不要水印，不要logo，原创角色"
)

CANDIDATES = [
    ("A_蓝发", "蓝紫色渐变短发，齐刘海，发梢翘起，头上一个淡蓝色小鲸鱼发饰，"
               "浅蓝色连帽卫衣，白色短裤，白色运动鞋，蓝色眼睛，开朗的笑"),
    ("B_银发", "银白色长发双马尾，蓝色瞳孔，猫耳发箍，深蓝色水手服，红色领结，"
               "白色过膝袜，黑色小皮鞋，略带傲娇的表情"),
    ("C_黑发", "黑色短发配一撮蓝色挑染，蓝色眼睛，黑色oversize卫衣印着蓝色鲸鱼图案，"
               "灰色百褶裙，白色帆布鞋，安静乖巧的表情"),
    ("D_粉发", "浅蓝色蓬松短卷发，星星形状的发夹，白色泡泡袖衬衫，浅蓝色背心裙，"
               "荷叶边，白色短袜，手里抱着一只蓝色小鲸鱼玩偶，甜甜地笑"),
]


def post_json(url: str, payload: dict, headers: dict, timeout: int = 300) -> dict:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def download(url: str, dest: Path, timeout: int = 300) -> bool:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        dest.write_bytes(r.read())
    return dest.stat().st_size > 10000


def gen_ark(prompt: str, dest: Path) -> bool:
    try:
        j = post_json(
            ARK["url"],
            {"model": ARK["model"], "prompt": prompt, "size": "1024x1024",
             "response_format": "url", "watermark": False},
            {"Authorization": "Bearer " + ARK["key"], "Content-Type": "application/json"},
        )
    except Exception as e:
        print("  ark ERR", e)
        return False
    url = ((j.get("data") or [{}])[0].get("url") or "")
    if not url:
        print("  ark 无 url:", json.dumps(j, ensure_ascii=False)[:300])
        return False
    return download(url, dest)


def gen_ds(prompt: str, dest: Path) -> bool:
    try:
        j = post_json(
            DS["url"],
            {"model": DS["model"],
             "input": {"messages": [{"role": "user", "content": [{"text": prompt}]}]},
             "parameters": {"size": "1024*1024", "n": 1, "prompt_extend": False}},
            {"Authorization": "Bearer " + DS["key"], "Content-Type": "application/json"},
        )
    except Exception as e:
        print("  ds ERR", e)
        return False
    out = j.get("output") or {}
    url = ""
    for ch in (out.get("choices") or []):
        for part in ((ch.get("message") or {}).get("content") or []):
            if part.get("image"):
                url = part["image"]
                break
    if not url:
        print("  ds 无图:", json.dumps(out, ensure_ascii=False)[:300])
        return False
    return download(url, dest)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--one", type=int, default=-1)
    a = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)

    todo = CANDIDATES if a.one < 0 else [CANDIDATES[a.one]]
    for name, desc in todo:
        prompt = f"{BASE}。角色设定：{desc}。"
        dest = OUT / f"{name}.png"
        print(f"[{name}] 生成中 ...", flush=True)
        t0 = time.time()
        ok = gen_ark(prompt, dest)
        if not ok:
            print("  换百炼再试", flush=True)
            ok = gen_ds(prompt, dest)
        print(f"  {'OK' if ok else 'FAIL'} {dest.name} {time.time()-t0:.0f}s", flush=True)
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    raise SystemExit(main())
