# -*- coding: utf-8 -*-
"""下载 B 站 deepseek 鲸鱼娘相关封面，供识图确认形象。"""
import os
import urllib.request

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36")
OUT = r"C:\Users\lin\Desktop\林九\桌宠\_tmp\bili_covers"
os.makedirs(OUT, exist_ok=True)

items = {
    "day0_258w.jpg": "https://i1.hdslb.com/bfs/archive/3e3f44c0c51ee095abf3b1dc8f2b01692c3ecf1c.jpg",
    "first_video.png": "https://i1.hdslb.com/bfs/archive/6a4cf66783feb24a37a12b9719bff71685630ab8.png",
    "real_pretty.jpg": "https://i1.hdslb.com/bfs/archive/45c73fdd0d946da160f7a5ba190cd2a2ba2ac183.jpg",
    "with_claude.png": "https://i1.hdslb.com/bfs/archive/130765d91a649d8bc148d3e61e18af108b0ac3c2.jpg",
    "tag_cute.jpg": "https://i0.hdslb.com/bfs/archive/d4eb0d11c17710390ab57397def458e619d44229.jpg",
    "day2.jpg": "https://i0.hdslb.com/bfs/archive/f109449898f230703eb71d4d9d83fa446d806222.jpg",
}

op = urllib.request.build_opener(urllib.request.ProxyHandler({}))
for name, url in items.items():
    dst = os.path.join(OUT, name)
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Referer": "https://www.bilibili.com/"})
        data = op.open(req, timeout=25).read()
        with open(dst, "wb") as f:
            f.write(data)
        print("OK", name, len(data))
    except Exception as e:
        print("ERR", name, e)
