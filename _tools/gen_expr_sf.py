import os
import subprocess, os, sys

KEY = os.environ.get("SF_API_KEY", "")
ROOT = r"C:\Users\lin\Desktop\林九\桌宠"
PY = r"C:\Users\lin\.agents\binaries\python\envs\default\Scripts\python.exe"
SRC = os.path.join(ROOT, "assets", "char", "dafeiyu", "front.png")
OUTDIR = os.path.join(ROOT, "assets", "char", "expr")
os.makedirs(OUTDIR, exist_ok=True)

BASE = "保持这个角色的长相、发型、服装、姿势、画风完全不变，只改表情："
JOBS = [
    ("blink", "眼睛闭成弯弯的一条线（眨眼），嘴角微微上扬，白色背景"),
    ("surprise", "眼睛睁得很大、瞳孔变小，嘴巴张成圆形，惊讶的样子，白色背景"),
    ("sleepy", "眼睛半闭、眼皮下垂，嘴巴小小的，困倦的样子，白色背景"),
    ("angry", "鼓起脸颊，眉毛皱起，嘴巴抿成一条线，生气的样子，白色背景"),
]

for name, p in JOBS:
    out = os.path.join(OUTDIR, name + ".png")
    if os.path.exists(out) and os.path.getsize(out) > 10000:
        print(name, "skip-exists")
        continue
    r = subprocess.run([PY, os.path.join(ROOT, "_tools", "sf_edit.py"), KEY, SRC, BASE + p, out],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    ok = os.path.exists(out) and os.path.getsize(out) > 10000
    print(name, "OK" if ok else "FAIL", (r.stdout or "").strip()[:80].encode("ascii", "replace").decode())
