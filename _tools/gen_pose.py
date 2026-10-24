import base64, json, os, sys, time, urllib.request

KEY = open(r'C:\Users\lin\Desktop\林九\桌宠\_key.txt', encoding='utf-8-sig').read().strip()
BASE = r'C:\Users\lin\Desktop\林九\桌宠'
OUT = os.path.join(BASE, 'assets', 'char', 'whale')
REF = os.path.join(OUT, 'q_base.png')
B64 = base64.b64encode(open(REF, 'rb').read()).decode()

KEEP = ("保持这个角色的全部特征（深蓝长发、白色蕾丝头饰、鲸鱼耳鳍、蓝色蝴蝶结、"
        "深蓝女仆裙、白围裙上的小鲸鱼、白色过膝袜、深蓝小皮鞋），Q版可爱比例，纯白背景，全身入镜，不要任何文字。")

POSES = {
    'q_stretch': "把姿势改成伸懒腰：双手举过头顶向上伸展，身体拉长，闭着眼睛，脚尖微微踮起。",
    'q_sit': "把姿势改成坐在地上：双腿并拢向前，双手撑在身体两侧，微微歪头看着镜头。",
    'q_wave': "把姿势改成挥手打招呼：一只手举起来挥手，另一只手放在身侧，开心地笑，眼睛弯弯的。",
    'q_blow': "把姿势改成在吹泡泡：嘴巴嘟起来吹气，一只手举着一根小圆环泡泡棒放在嘴边。",
    'q_walk1': "把姿势改成正在走路的第一步：左腿向前迈出，右腿在后，手臂自然摆动，身体微微前倾。",
    'q_walk2': "把姿势改成正在走路的第二步：右腿向前迈出，左腿在后，手臂自然摆动，身体微微前倾。",
    'q_walk3': "把姿势改成走路中间的过渡帧：左腿踩地支撑，右腿抬起向前摆，身体重心略往左。",
    'q_walk4': "把姿势改成走路中间的过渡帧：右腿踩地支撑，左腿抬起向前摆，身体重心略往右。",
    'q_angry': "把姿势改成生气：双手叉腰，鼓着腮帮子，皱着眉头瞪眼，嘴巴抿紧。",
    'q_shy': "把姿势改成害羞：双手捧着自己的脸，脸红，眼神躲闪看向一边。",
}

which = sys.argv[1:] or list(POSES)

for name in which:
    body = {
        'model': 'Qwen/Qwen-Image-Edit-2509',
        'prompt': KEEP + POSES[name],
        'image': 'data:image/png;base64,' + B64,
        'image_size': '1024x1024',
        'num_inference_steps': 36,
    }
    out = os.path.join(OUT, name + '_raw.png')
    req = urllib.request.Request('https://api.siliconflow.cn/v1/images/generations',
                                 data=json.dumps(body).encode(),
                                 headers={'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json'})
    t = time.time()
    try:
        r = json.loads(urllib.request.urlopen(req, timeout=300).read().decode())
        raw = urllib.request.urlopen(r['images'][0]['url'], timeout=120).read()
        open(out, 'wb').write(raw)
        print('OK', name, len(raw), round(time.time() - t, 1), 's', flush=True)
    except urllib.error.HTTPError as e:
        print('HTTP', name, e.code, e.read().decode()[:200], flush=True)
    except Exception as e:
        print('ERR', name, type(e).__name__, e, flush=True)
