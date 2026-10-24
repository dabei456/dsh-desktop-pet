# -*- coding: utf-8 -*-
import re
import sys
from pathlib import Path

ASAR = Path(r"C:\linjiu\DeepSeek\resources\app.asar")
data = ASAR.read_bytes()

pats = [
    r'input: z\.array',
    r'inputModalities: z\.array',
    r'reasoningEfforts: z\.',
    r'upstreamId',
    r'apiModelId',
    r'modelId:',
]
for pat in pats:
    b = pat.encode("utf-8")
    print("=" * 40, pat, "count", data.count(b))
    idx = 0
    for _ in range(3):
        idx = data.find(b, idx)
        if idx < 0:
            break
        seg = data[max(0, idx - 700): idx + 700].decode("utf-8", "replace")
        print(f"--- at {idx} ---")
        print(seg)
        idx += len(b)
