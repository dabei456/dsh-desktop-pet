# -*- coding: utf-8 -*-
"""抓百度图片搜索结果，用于找 DeepSeek 二次元形象参考。"""
import json
import sys
import urllib.parse
import urllib.request

PROXY = "http://127.0.0.1:7897"


def fetch(url, use_proxy=False, referer="https://image.baidu.com/"):
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                          "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
            "Accept": "*/*",
            "Referer": referer,
        },
    )
    if use_proxy:
        op = urllib.request.build_opener(
            urllib.request.ProxyHandler({"http": PROXY, "https": PROXY})
        )
    else:
        op = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    with op.open(req, timeout=20) as r:
        return r.read()


def baidu_images(word, pn=0, rn=30):
    q = urllib.parse.quote(word)
    url = (
        f"https://image.baidu.com/search/acjson?tn=resultjson_com&logid=0&ipn=rj&ct=201326592"
        f"&fp=result&word={q}&pn={pn}&rn={rn}&gsm=1e"
    )
    raw = fetch(url)
    txt = raw.decode("utf-8", "replace")
    try:
        data = json.loads(txt)
    except Exception as e:
        print("PARSE FAIL", e, txt[:200])
        return []
    out = []
    for it in data.get("data", []):
        if not isinstance(it, dict):
            continue
        out.append(
            {
                "fromPageTitle": it.get("fromPageTitleEnc", "")[:60],
                "thumb": it.get("thumbURL") or it.get("middleURL"),
                "mid": it.get("middleURL"),
                "width": it.get("width"),
                "height": it.get("height"),
                "obj": it.get("objURL", "")[:80],
            }
        )
    return out


if __name__ == "__main__":
    words = sys.argv[1:] or ["deepseek娘动漫", "deepseek拟人二次元"]
    for w in words:
        print("=" * 20, w)
        items = baidu_images(w)
        print("got", len(items))
        for i, it in enumerate(items[:10]):
            print(f"  [{i}] {it['width']}x{it['height']} {it['fromPageTitle']}")
            print(f"      {it['mid']}")
