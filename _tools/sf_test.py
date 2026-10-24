import json, os, urllib.request, urllib.error, base64, sys

KEY = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("SF_KEY", "")
URL = "https://api.siliconflow.cn/v1/images/generations"

PROMPT = (
    "chibi anime girl full body, long deep navy blue hair with light blue gradient tips, "
    "white lace frilled maid headdress, small whale-fin shaped hair ornaments, navy blue and white maid dress, "
    "white apron with a little blue whale embroidery, blue eyes, standing, arms at sides, "
    "clean thick lineart, flat cel shading, pure white background, no shadow, front view"
)

def gen(prompt, seed=1, model="Kwai-Kolors/Kolors", size="1024x1024"):
    steps = 4 if "schnell" in model else 20
    gs = 3.5 if "schnell" in model else 7.5
    body = {
        "model": model,
        "prompt": prompt,
        "image_size": size,
        "batch_size": 1,
        "num_inference_steps": steps,
        "guidance_scale": gs,
        "seed": seed,
    }
    req = urllib.request.Request(
        URL,
        data=json.dumps(body).encode(),
        headers={"Authorization": "Bearer " + KEY, "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            data = json.loads(r.read().decode())
            return data["images"][0]["url"]
    except urllib.error.HTTPError as e:
        return "ERR%d %s" % (e.code, e.read().decode()[:400])
    except Exception as e:
        return "EXC " + str(e)

if __name__ == "__main__":
    MODEL = os.environ.get("SF_MODEL", "Kwai-Kolors/Kolors")
    url = gen(PROMPT, model=MODEL)
    print(url)
    if url.startswith("http"):
        out = os.path.join(r"C:\Users\lin\Desktop\林九\桌宠\_tmp", os.environ.get("SF_OUT", "sf_test.png"))
        urllib.request.urlretrieve(url, out)
        print("saved", out, os.path.getsize(out))
