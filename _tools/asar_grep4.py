# -*- coding: utf-8 -*-
import sys
from pathlib import Path

ASAR = Path(r"C:\linjiu\DeepSeek\resources\app.asar")
data = ASAR.read_bytes()

def show(key, before=100, after=1600, limit=3, tag=""):
    b = key.encode("utf-8")
    idx = 0
    n = 0
    print("=" * 40, tag or key, "count", data.count(b))
    while n < limit:
        idx = data.find(b, idx)
        if idx < 0:
            break
        seg = data[max(0, idx - before): idx + after].decode("utf-8", "replace")
        print(f"--- hit {n} at {idx} ---")
        print(seg)
        idx += len(b)
        n += 1

show("catalogModelFields", 900, 900, 3)
show("input:", 250, 500, 6)
