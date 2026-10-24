# -*- coding: utf-8 -*-
"""定位 resolveModelInfo 实现与 inputModalities 来源。"""
import re
import sys
from pathlib import Path

ASAR = Path(r"C:\linjiu\DeepSeek\resources\app.asar")
data = ASAR.read_bytes()

def show(key, before=300, after=1800, limit=3):
    b = key.encode("utf-8")
    idx = 0
    n = 0
    print("=" * 40, key, "count", data.count(b))
    while n < limit:
        idx = data.find(b, idx)
        if idx < 0:
            break
        seg = data[max(0, idx - before): idx + after].decode("utf-8", "replace")
        print(f"--- hit {n} at {idx} ---")
        print(seg)
        idx += len(b)
        n += 1

show("resolveModelInfo(provider", 400, 1200, 4)
show("inputModalities", 200, 500, 6)
