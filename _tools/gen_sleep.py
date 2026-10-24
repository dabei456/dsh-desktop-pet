import base64, json, os, sys, urllib.request

KEY = open(r'C:\Users\lin\Desktop\林九\桌宠\_key.txt', encoding='utf-8-sig').read().strip()
BASE = r'C:\Users\lin\Desktop\林九\桌宠'
ref = os.path.join(BASE, 'assets', 'char', 'whale', 'q_base.png')
b64 = base64.b64encode(open(ref, 'rb').read()).decode()

PROMPT = ("保持这个角色的全部特征（深蓝长发、白色蕾丝头饰、鲸鱼耳鳍、蓝色蝴蝶结、"
          "深蓝女仆裙、白围裙上的小鲸鱼、白色过膝袜），把姿势改成趴着睡觉："
          "侧趴在地上，头枕在自己的手臂上，闭着眼睛，身体蜷缩，尾巴自然放在身旁，"
          "Q版可爱比例，纯白背景，全身入镜，不要任何文字")

body = {
    'model': 'Qwen/Qwen-Image-Edit-2509',
    'prompt': PROMPT,
    'image': 'data:image/png;base64,' + b64,
    'image_size': '1024x1024',
    'num_inference_steps': 36,
}

out = os.path.join(BASE, 'assets', 'char', 'whale', 'q_sleep_raw.png')
req = urllib.request.Request('https://api.siliconflow.cn/v1/images/generations',
                             data=json.dumps(body).encode(),
                             headers={'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json'})
t = __import__('time').time()
try:
    r = json.loads(urllib.request.urlopen(req, timeout=300).read().decode())
    url = r['images'][0]['url']
    raw = urllib.request.urlopen(url, timeout=120).read()
    open(out, 'wb').write(raw)
    print('OK', out, len(raw), round(__import__('time').time() - t, 1), 's')
except urllib.error.HTTPError as e:
    print('HTTP', e.code, e.read().decode()[:300])
except Exception as e:
    print('ERR', type(e).__name__, e)
