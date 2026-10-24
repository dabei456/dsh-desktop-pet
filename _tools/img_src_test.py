# -*- coding: utf-8 -*-
"""测试三个图片搜索源的可用性。"""
import json
import urllib.parse
import urllib.request

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36")
PROXY = "http://127.0.0.1:7897"


def get(url, proxy=False, referer=None):
    h = {"User-Agent": UA, "Accept-Language": "zh-CN,zh;q=0.9"}
    if referer:
        h["Referer"] = referer
    req = urllib.request.Request(url, headers=h)
    if proxy:
        op = urllib.request.build_opener(urllib.request.ProxyHandler({"http": PROXY, "https": PROXY}))
    else:
        op = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    with op.open(req, timeout=25) as r:
        return r.status, r.read()


q = urllib.parse.quote("deepseek娘")

tests = [
    ("sogou-api", f"https://pic.sogou.com/napi/pc/searchList?mode=1&start=0&xml_len=30&query={q}", False, "https://pic.sogou.com/"),
    ("baidu-html", f"https://image.baidu.com/search/index?tn=baiduimage&word={q}", False, None),
    ("bing-html", f"https://www.bing.com/images/search?q={q}", True, None),
]

for name, url, proxy, ref in tests:
    try:
        st, body = get(url, proxy, ref)
        print(f"== {name} status={st} bytes={len(body)}")
        txt = body.decode("utf-8", "replace")
        print("   head:", txt[:200].replace("\n", " "))
        if name == "sogou-api":
            try:
                d = json.loads(txt)
                items = d.get("data", {}).get("items", [])
                print("   items:", len(items))
                for it in items[:5]:
                    print("    -", it.get("title", "")[:40], it.get("picUrl", "")[:100])
            except Exception as e:
                print("   json err", e)
        else:
            for key in ("objURL", "murl", "thumbURL", "picUrl"):
                print(f"   {key} count:", txt.count(key))
    except Exception as e:
        print(f"== {name} ERROR {e}")
