# -*- coding: utf-8 -*-
import sys
from pathlib import Path

ASAR = Path(r"C:\linjiu\DeepSeek\resources\app.asar")
data = ASAR.read_bytes()

needle = b'["text", "image"]'
print("count", data.count(needle))
idx = 0
for n in range(8):
    idx = data.find(needle, idx)
    if idx < 0:
        break
    seg = data[max(0, idx - 900): idx + 600].decode("utf-8", "replace")
    print("=" * 30, "hit", n, "at", idx)
    print(seg)
    idx += len(needle)
