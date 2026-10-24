# -*- coding: utf-8 -*-
"""在 app.asar 里搜关键字，打印上下文（找 image 能力判定逻辑）。"""
import sys
from pathlib import Path

ASAR = Path(r"C:\linjiu\DeepSeek\resources\app.asar")
KEYS = [
    "does not declare image input",
    "declare image input",
    "supportsImages",
    "acceptsImages",
    "inputModalities",
    "modalities",
]
data = ASAR.read_bytes()
print("asar size", len(data))
for k in KEYS:
    b = k.encode("utf-8")
    idx = data.find(b)
    print("=" * 30, k, "first at", idx, "count", data.count(b))
    if idx >= 0:
        seg = data[max(0, idx - 700): idx + 400]
        txt = seg.decode("utf-8", "replace")
        print(txt[-1100:])
