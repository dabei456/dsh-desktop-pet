# -*- coding: utf-8 -*-
"""搜网上的 DeepSeek 二次元形象（Bing 图片），把候选原图抓下来。"""
import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

OUT = Path(r"C:\Users\lin\Desktop\林九\桌宠\assets\char\参考")
OUT.mkdir(parents=True, exist_ok=True)

QUERIES = [
    "deepseek 娘 二次元",
    "deepseek 拟人 二次元 形象",
    "deepseek chan anime",
]

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")


def fetch(url: str, timeout: int = 30) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def search(q: str, n: int = 12):
    url = "https://www.bing.com/images/search?q=" + urllib.parse.quote(q) + "&form=HDRSC2&first=1"
    html = fetch(url).decode("utf-8", "replace")
    items = re.findall(r'murl&quot;:&quot;(.*?)&quot;', html)
    if not items:
        items = re.findall(r'"murl":"(.*?)"', html)
    seen, out = set(), []
    for u in items:
        u = u.replace("\\/", "/")
        if u in seen:
            continue
        seen.add(u)
        out.append(u)
        if len(out) >= n:
            break
    return out


def main() -> int:
    allurls = []
    for q in QUERIES:
        try:
            urls = search(q)
        except Exception as e:
            print("[ERR]", q, e)
            continue
        print(f"[{q}] {len(urls)} 张")
        for u in urls:
            allurls.append((q, u))

    seen = set()
    i = 0
    for q, u in allurls:
        if u in seen:
            continue
        seen.add(u)
        i += 1
        ext = ".png" if ".png" in u.lower() else ".jpg"
        dest = OUT / f"{i:02d}{ext}"
        try:
            data = fetch(u, timeout=25)
        except Exception as e:
            print("  skip", i, str(e)[:60])
            continue
        if len(data) < 20000:
            print("  skip small", i, len(data))
            continue
        dest.write_bytes(data)
        print("  saved", dest.name, len(data), u[:90])
        if i >= 24:
            break
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    raise SystemExit(main())
