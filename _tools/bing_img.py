# -*- coding: utf-8 -*-
"""Bing 图片搜索抓取：直接正则提取 murl/turl。"""
import html as htmlmod
import re
import sys
import urllib.parse
import urllib.request

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36")
PROXY = "http://127.0.0.1:7897"


def get(url, proxy=True):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "zh-CN,zh;q=0.9"})
    handler = urllib.request.ProxyHandler({"http": PROXY, "https": PROXY}) if proxy else urllib.request.ProxyHandler({})
    with urllib.request.build_opener(handler).open(req, timeout=25) as r:
        return r.read()


def search(word, first=1):
    q = urllib.parse.quote(word)
    url = f"https://www.bing.com/images/search?q={q}&form=HDRSC2&first={first}"
    page = get(url).decode("utf-8", "replace")
    murls = re.findall(r'"murl":"(.*?)"', page)
    turls = re.findall(r'"turl":"(.*?)"', page)
    titles = re.findall(r'"t":"(.*?)"', page)
    out = []
    for i, m in enumerate(murls):
        out.append(
            {
                "murl": htmlmod.unescape(m),
                "turl": htmlmod.unescape(turls[i]) if i < len(turls) else "",
                "title": htmlmod.unescape(titles[i])[:70] if i < len(titles) else "",
            }
        )
    return out


if __name__ == "__main__":
    words = sys.argv[1:] or ["deepseek娘 动漫"]
    for w in words:
        print("=" * 25, w)
        try:
            items = search(w)
        except Exception as e:
            print("ERR", e)
            continue
        print("got", len(items))
        for i, it in enumerate(items[:20]):
            print(f"  [{i}] {it['title']}")
            print(f"      {it['murl'][:150]}")
