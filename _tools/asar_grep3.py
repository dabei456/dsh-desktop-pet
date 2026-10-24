# -*- coding: utf-8 -*-
import sys
from pathlib import Path

ASAR = Path(r"C:\linjiu\DeepSeek\resources\app.asar")
data = ASAR.read_bytes()

def show(key, before=200, after=1500, limit=4, tag=""):
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

show('reasoningEfforts', 600, 1400, 3)
show('inputModalities:', 300, 700, 4)
