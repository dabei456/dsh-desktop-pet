// DeepSeek 桌宠 · 渲染与行为（v0.3：换成鲸鱼娘立绘）
const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');

let W = 0, H = 0, GROUND = 0, DPR = 1;

const GRAVITY = 2600;
const MIN_H = 90, MAX_H = 420;
let PET_H = 170;            // 显示高度（px），滚轮可调
let HIT_W = 80;             // 碰撞/点击宽（比图窄一点，避免点到空白）
let PET_W = 93;
try {
  const saved = parseInt(localStorage.getItem('petH'), 10);
  if (saved >= MIN_H && saved <= MAX_H) PET_H = saved;
  if (saved && saved < 120) { PET_H = 170; try { localStorage.setItem('petH', '170'); } catch (e) {} }
} catch {}

// 表情素材：同一张立绘的 6 个表情（760x1000 统一画布，脚底对齐）
const EXPR_BASE = '../assets/char/expr_cut/';
const EXPR = { normal: null, blink: null, smile: null, surprise: null, sleepy: null, angry: null };
const EXPR_SRC = ['normal', 'blink', 'smile', 'surprise', 'sleepy', 'angry'];

// 旧素材（暂停用，保留给走路/背面）
const BASE = '../assets/char/dafeiyu/';
const ANIM = { idle: [], hover: [], success: [] };
const STILL = { front: null, side: null, back: null };
const WHALE = { base: new Image(), blink: new Image(), ready: false };
WHALE.base.onload = () => { WHALE.ready = true; };
WHALE.base.src = '../assets/char/whale/q_base_s.png';
WHALE.blink.src = '../assets/char/whale/q_blink_s.png';
const SRC = {
  idle: [0, 1, 2, 3, 4, 5].map((i) => `${BASE}idle_${i}.png`),
  hover: [0, 1, 2, 3, 4].map((i) => `${BASE}hover_${i}.png`),
  success: [0, 1, 2, 3, 4, 5].map((i) => `${BASE}success_${i}.png`),
  front: [`${BASE}front.png`],
  side: [`${BASE}side.png`],
  back: [`${BASE}back.png`],
};

const pet = {
  asleep: false,
  knocked: false,
  downT: 0,
  tiredT: 0,
  sleepT: 0,
  x: 300, y: 100,
  vx: 0, vy: 0,
  facing: 1,
  state: 'fall',      // idle | walk | fall | drag | dizzy
  stateT: 0,
  dragDX: 0, dragDY: 0,
  dizzyT: 0,
  bubbleT: 0,
  bubbleText: '',
  hitInside: false,
  dragging: false,
  blushT: 0,
  sleepyT: 0,
  idleFor: 0,
  hearts: [],
  cheerT: 0,
  hungryT: 480,
  standId: 0,
  hitCd: 0,
  squash: 0,
  curiousT: 360,
  blinkT: 0,
  blinkCd: 2.4,
  angryT: 0,
  hideCd: 25 + Math.random() * 35,
  hideT: 0,
  peekT: 0,
  peeking: false,
  hideDir: -1,
  hideBase: 0,
};

let mouse = { x: -9999, y: -9999 };
let lastHit = false;
let dragVX = 0, dragVY = 0, lastMoveT = 0;

// ---------- 歌词 ----------
let lyrics = [];
let lyricIdx = -1;
let lyricStart = 0;
let singPlan = [];
let singNext = 0;
const LYRIC_DB_KEY = 'lyricDb';

function lyricDbRead() {
  try { return JSON.parse(localStorage.getItem(LYRIC_DB_KEY) || '[]'); } catch { return []; }
}
function lyricDbSave(title, artist, lines) {
  if (!title || !lines || !lines.length) return;
  try {
    const db = lyricDbRead().filter((x) => !(x.title === title && x.artist === (artist || '')));
    db.unshift({ title, artist: artist || '', lines: lines.slice(0, 60), ts: Date.now() });
    localStorage.setItem(LYRIC_DB_KEY, JSON.stringify(db.slice(0, 80)));
  } catch {}
}
function planSinging() {
  singPlan = [];
  singNext = 0;
  if (!lyrics.length) return;
  const total = Math.max(20, lyrics[lyrics.length - 1].t || 20);
  const n = 1 + Math.floor(Math.random() * 2); // 1~2 句，别一直唱
  for (let i = 0; i < n; i++) singPlan.push(4 + Math.random() * (total - 6));
  singPlan.sort((a, b) => a - b);
}

function parseLrc(raw) {
  const out = [];
  for (const line of String(raw).split('\n')) {
    const mm = line.match(/^\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\](.*)$/);
    if (!mm) continue;
    const t = (+mm[1]) * 60 + (+mm[2]) + (mm[3] ? Number('0.' + mm[3]) : 0);
    const s = (mm[4] || '').trim();
    if (s && s[0] !== '[') out.push({ t, s });
  }
  return out.sort((a, b) => a.t - b.t);
}

async function loadLyric(title, artist, posSec) {
  lyrics = [];
  lyricIdx = -1;
  lyricStart = performance.now() - (posSec || 0) * 1000;
  if (!String(title || '').trim()) return;
  let raw = null;
  try { raw = await window.petAPI.fetchLyric(title, artist); } catch {}
  if (!raw) return;
  lyrics = parseLrc(raw);
  lyricStart = performance.now() - (posSec || 0) * 1000;
  planSinging();
  if (lyrics.length) lyricDbSave(title, artist, lyrics.map((l) => l.s));
}

// 其它窗口的「顶边」= 可以站上去的平台
let platforms = [];
let prevRects = new Map();
let ORIGIN = { x: 0, y: 0 };

function floorAt(cx, bottom, vy) {
  let best = GROUND;
  if (vy >= 0) {
    for (const p of platforms) {
      if (cx > p.x + 6 && cx < p.x + p.w - 6 && p.y >= bottom - 8 && p.y < best) best = p.y;
    }
  }
  return best;
}

// 挑一个窗口，闪现到它上边缘，扒着往下看
function perchOnWindow() {
  const cand = platforms.filter((p) => p.fg && p.y >= 0 && p.y < GROUND - 120 && p.w > 260);
  if (!cand.length) return false;
  const p = cand[Math.floor(Math.random() * cand.length)];
  pet.x = p.x + 60 + Math.random() * Math.max(20, p.w - 120 - PET_W);
  pet.y = Math.max(0, p.y - PET_H * 0.58);
  pet.standId = p.id;
  pet.vx = 0;
  pet.vy = 0;
  pet.stuck = 0;
  pet.perched = true;
  pet.perchEdge = p.y;
  pet.perchT = 14 + Math.random() * 20;
  setState('idle');
  pet.cheerT = 1.6;
  say(pickLine('found', ['咦…你在干嘛', '我看看你在干嘛', '这上面风好大']), 2.4);
  return true;
}

function platformIdAt(cx, y) {
  for (const p of platforms) {
    if (Math.abs(p.y - y) < 2 && cx > p.x + 6 && cx < p.x + p.w - 6) return p.id;
  }
  return 0;
}

// 系统正在播的歌
let media = { playing: false, title: '', artist: '', app: '' };
const HUM = ['♪ 嗯～', '♪ 啦～啦～', '这首好听', '♪ 呜～'];
pet.humT = 6;

function isListening() {
  if (!media.playing || !media.title) return false;
  // 主进程 20 秒没推过媒体状态，就当她没在听（防止探测脚本卡住时音符一直飘）
  if (media.ts && Date.now() - media.ts > 20000) return false;
  return true;
}

// 困不困：夜里、心情低、快饿扁，都不唱
let singMode = false;
function tooTired() {
  const h = new Date().getHours();
  const night = h >= 23 || h < 7;
  return night || needs.mood < 6;
}

function loadOne(src) {
  return new Promise((res) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => {
      console.error('图片加载失败', src);
      res(null);
    };
    im.src = src;
  });
}

async function loadImages() {
  for (const k of EXPR_SRC) {
    EXPR[k] = await loadOne(EXPR_BASE + k + '.png');
  }
  for (const k of ['idle', 'hover', 'success']) {
    ANIM[k] = (await Promise.all(SRC[k].map(loadOne))).filter(Boolean);
  }
  for (const k of ['front', 'side', 'back']) {
    STILL[k] = (await Promise.all(SRC[k].map(loadOne)))[0] || null;
  }
  const ref = EXPR.normal || STILL.front || ANIM.idle[0];
  if (ref) {
    const refEl = WHALE.base.naturalWidth ? WHALE.base : ref;
  PET_W = Math.round((refEl.width / refEl.height) * PET_H);
    HIT_W = Math.round(PET_W * 0.86);
  }
}

// —— Live2D 渲染层 ——
const L2D = { app: null, model: null, ready: false, baseH: 0, curExpr: '' };
const L2D_K = 1.55; // 画布比人物大一圈，放大补回来
function petTop() { return L2D.ready ? pet.y + PET_H - PET_H * L2D_K : pet.y; }

async function setupL2D() {
  try {
    const cv = document.getElementById('l2d');
    L2D.app = new PIXI.Application({
      view: cv,
      width: W,
      height: H,
      backgroundAlpha: 0,
      antialias: true,
      resolution: DPR,
      autoDensity: true,
    });
    L2D.model = await PIXI.live2d.Live2DModel.from('models/whalegirl/c_0120.model3.json', { autoInteract: false });
    L2D.app.stage.addChild(L2D.model);
    L2D.model.anchor.set(0.5, 1);
    L2D.baseH = L2D.model.height;
    L2D.ready = true;
    L2D.model.motion('idle');
    console.log('L2D OK baseH=' + Math.round(L2D.baseH));
    setTimeout(() => {
      const m = L2D.model;
      console.log('L2D DBG screen=' + L2D.app.screen.width + 'x' + L2D.app.screen.height +
        ' renderer=' + L2D.app.renderer.width + 'x' + L2D.app.renderer.height +
        ' model=' + Math.round(m.width) + 'x' + Math.round(m.height) +
        ' pos=' + Math.round(m.x) + ',' + Math.round(m.y) + ' scale=' + m.scale.x.toFixed(4) +
        ' anchor=' + m.anchor.x + ',' + m.anchor.y);
    }, 3000);
  } catch (e) {
    console.log('L2D FAIL ' + e.message);
  }
}

function l2dMotion(name) {
  if (!L2D.ready) return;
  try {
    L2D.model.motion(name);
  } catch {}
}

function l2dExpr(name) {
  if (!L2D.ready || L2D.curExpr === name) return;
  L2D.curExpr = name;
  try {
    L2D.model.expression(name);
  } catch {}
}

function syncL2D(now) {
  if (!L2D.ready) return;
  const m = L2D.model;
  const s = (PET_H * L2D_K) / L2D.baseH;
  const cx = pet.x + PET_W / 2;
  const bottom = pet.y + PET_H;
  const sway = pet.state === 'idle' ? Math.sin(now / 1500) * 0.02 : 0;
  const shake = pet.state === 'drag' ? Math.sin(now / 45) * 0.04 : 0;
  const lean = pet.state === 'walk' ? Math.sin(now / 200) * 0.05 : sway;
  m.scale.set(pet.facing * s, s);
  m.x = cx;
  m.y = bottom;
  m.rotation = lean + shake;
}

async function init() {
  await loadImages();  const info = await window.petAPI.screenInfo();
  DPR = Math.min(window.devicePixelRatio || 1, 1.25);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  GROUND = info.workArea.y + info.workArea.height - info.bounds.y;
  ORIGIN = { x: info.bounds.x, y: info.bounds.y };
  console.log('SIZE', JSON.stringify({ PET_H, PET_W, HIT_W, saved: localStorage.getItem('petH'), DPR, W, H }));

  pet.x = W * 0.5 - PET_W / 2;
  pet.y = GROUND - PET_H;

  loadNeeds();
  // setupL2D();  // 换成立绘，Live2D 停用

  // 换 Live2D 后第一次启动，位置回到屏幕中间
  try {
    if (localStorage.getItem('whale_v1') !== '1') {
      localStorage.removeItem('petX');
      localStorage.setItem('whale_v1', '1');
    }
  } catch {}

  // 恢复上次站的位置
  try {
    const sx = parseInt(localStorage.getItem('petX'), 10);
    if (!isNaN(sx)) pet.x = Math.max(0, Math.min(W - PET_W, sx));
  } catch {}
  pet.state = 'idle';
  pet.stateT = 0;

  try {
    media = await window.petAPI.getMedia();
  } catch {}
  window.petAPI.onMedia((m) => {
    const was = isListening();
    const changedSong = !media || m.title !== media.title;
    media = m;
    const now = isListening();
    if (now && (!was || changedSong)) {
      const tired = tooTired();
      singMode = !tired && Math.random() < 0.7;
      if (singMode) {
        pet.humT = 3;
        loadLyric(m.title || '', m.artist || '', m.position || 0);
      } else {
        lyrics = [];
        lyricIdx = -1;
        if (tired) say('困…不想唱', 2.2);
        else if (Math.random() < 0.5) say('这歌不错', 2.2);
      }
    } else if (now && singMode && typeof m.position === 'number' && m.position > 1 && lyrics.length) {
      // 播放器给了真实进度才校准（网易云只给 0，忽略）
      lyricStart = performance.now() - m.position * 1000;
    }
    if (!now && was) {
      lyrics = [];
      lyricIdx = -1;
      singPlan = [];
      singNext = 0;
      singMode = false;
      say('不听了？', 1.6);
    }
  });

  last = performance.now();
  requestAnimationFrame(loop);
}

function setState(s) {
  if (pet.state === s) return;
  if (s !== 'idle') { pet.perched = false; pet.perchEdge = 0; }
  pet.state = s;
  pet.stateT = 0;
}

// 藏到屏幕边上，只露半张脸偷看；离得远就是「闪现」过去
function goHide() {
  const dir = Math.random() < 0.5 ? -1 : 1;
  const far = Math.abs(pet.x - (dir < 0 ? 0 : W)) > 420;
  pet.hideDir = dir;
  pet.hideBase = dir < 0 ? -PET_W * 0.72 : W - PET_W * 0.28;
  pet.x = pet.hideBase + dir * PET_W * 0.14;
  pet.y = GROUND - PET_H;
  pet.hideT = 12 + Math.random() * 18;
  pet.peekT = 1.2 + Math.random() * 1.8;
  pet.peeking = false;
  pet.squash = 0;
  setState('hide');
  pet.bubbleT = 0;
  if (far) say('嗖——', 0.9);
}

function say(text, secs = 3) {
  pet.bubbleText = text;
  pet.bubbleT = secs;
}

// ---------- 内部需求（不外显，只影响行为和语气） ----------

const needs = {
  hunger: 76,   // 0–100，越高质量越好：吃饱
  mood: 68,     // 0–100，心情
  saveCd: 2.5,
};

const HUNGER_DECAY = 0.0012;  // 每秒掉多少，约 23 小时从满到空
const MOOD_DECAY = 0.0008;    // 约 35 小时

function loadNeeds() {
  try {
    const raw = localStorage.getItem('needs');
    if (!raw) return;
    const s = JSON.parse(raw);
    const gap = Math.min((Date.now() - (s.ts || Date.now())) / 1000, 86400);
    needs.hunger = Math.max(0, Math.min(100, (s.h ?? 76) - gap * HUNGER_DECAY));
    needs.mood = Math.max(0, Math.min(100, (s.m ?? 68) - gap * MOOD_DECAY));
  } catch {}
}

function saveNeeds() {
  try {
    localStorage.setItem('needs', JSON.stringify({
      h: Math.round(needs.hunger),
      m: Math.round(needs.mood),
      ts: Date.now(),
    }));
  } catch {}
}

// 交互/事件统一入口：只调内部值，不显示
function feel(moodDelta, hungerDelta = 0) {
  needs.mood = Math.max(0, Math.min(100, needs.mood + moodDelta));
  needs.hunger = Math.max(0, Math.min(100, needs.hunger + hungerDelta));
  if (needs.hunger > 45) pet.midFed = false;
}

// 饿的时候说什么
const HUNGRY_LINES = [
  '肚子叫了…',
  '有 txt 吗，随便一个都行',
  '你是不是忘了喂我',
  '饿…想吃文件',
  '再不吃我要瘦成小鱼干了',
];

const HAPPY_LINES = [
  '今天心情不错',
  '嘿嘿',
  '你在忙什么呀',
  '陪我玩会儿',
];

function needLine() {
  if (needs.hunger < 15) return HUNGRY_LINES[Math.floor(Math.random() * HUNGRY_LINES.length)];
  if (needs.mood < 25) return ['不理你了', '哼', '心情不好，别碰我'][Math.floor(Math.random() * 3)];
  if (needs.mood > 78) return HAPPY_LINES[Math.floor(Math.random() * HAPPY_LINES.length)];
  return null;
}

// ---------- 物理 ----------

let last = performance.now();

function loop(now) {
  requestAnimationFrame(loop);
  if (now - last < 33) return;   // 锁 30fps，省 GPU/合成
  let dt = (now - last) / 1000;
  last = now;
  dt = Math.min(dt, 0.05);
  update(dt);
  draw(now);
}

function update(dt) {
  pet.stateT += dt;
  if (pet.bubbleT > 0) pet.bubbleT -= dt;
  if (pet.blushT > 0) pet.blushT -= dt;
  if (pet.sleepyT > 0) pet.sleepyT -= dt;

  // 困了就自己睡，睡够了或者不困了再自己起来
  if (!pet.asleep && !pet.dragging) {
    if (tooTired()) {
      pet.tiredT += dt;
      if (pet.tiredT > 12) {
        pet.asleep = true;
        pet.tiredT = 0;
        pet.sleepT = 0;
        setState('sleep');
        say('困了…我先睡一会儿', 2.4);
      }
    } else {
      pet.tiredT = 0;
    }
  }
  if (pet.asleep) {
    pet.sleepT += dt;
    pet.vx = 0;
    if ((!tooTired() && pet.sleepT > 60) || pet.sleepT > 3600) {
      pet.asleep = false;
      pet.sleepT = 0;
      setState('idle');
      say('睡饱了～', 2.2);
    }
  }
  if (pet.cheerT > 0) pet.cheerT -= dt;
  // 内部需求缓慢变化（不外显）
  needs.hunger = Math.max(0, needs.hunger - dt * HUNGER_DECAY);
  needs.mood = Math.max(0, needs.mood - dt * MOOD_DECAY);
  if (needs.hunger < 20) needs.mood = Math.max(0, needs.mood - dt * 0.02);

  if (!pet.dragging && pet.bubbleT <= 0) {
    pet.needTalkT = (pet.needTalkT ?? 40) - dt;
    if (pet.needTalkT <= 0) {
      const line = needLine();
      if (line) say(line, 3.2);
      pet.needTalkT = needs.hunger < 20 ? 45 + Math.random() * 60 : 100 + Math.random() * 140;
    }
  }

  // 吃饱了会慢慢变开心
  if (needs.hunger >= 85 && needs.mood < 100) {
    pet.fullMoodT = (pet.fullMoodT || 45) - dt;
    if (pet.fullMoodT <= 0) { pet.fullMoodT = 60; feel(1); }
  }
  if (isListening() && singMode) {
    pet.musicMoodT = (pet.musicMoodT || 0) - dt;
    if (pet.musicMoodT <= 0) { pet.musicMoodT = 90; feel(1); }
  }
  // 只在饥饿跨过 45% / 1% 的那一刻触发一次，不轮询
  if (pet.prevHunger === undefined) pet.prevHunger = needs.hunger;
  if (pet.prevHunger > 45 && needs.hunger <= 45 && !pet.midFed) {
    pet.midFed = true;
    if (Math.random() < 0.6) scheduleSelfFeed();
  }
  if (pet.prevHunger > 1 && needs.hunger <= 1) scheduleSelfFeed();
  pet.prevHunger = needs.hunger;
  if (pet.showNeedT > 0) pet.showNeedT -= dt;
  needs.saveCd -= dt;
  if (needs.saveCd <= 0) { needs.saveCd = 3; saveNeeds(); }

  if (pet.state !== 'hide') { pet.x = Math.max(-PET_W * 0.35, Math.min(W - PET_W * 0.65, pet.x)); }
  if (!pet.perched && pet.state !== 'hide') { pet.y = Math.min(GROUND - PET_H, Math.max(-PET_H * 0.2, pet.y)); }
  pet.hideCd = (pet.hideCd || 0) - dt;
  if (pet.hideCd <= 0 && pet.state !== 'hide' && !pet.dragging && !pet.asleep && needs.mood > 8) goHide();

  // 心情/饥饿映射到表情（低概率，不刷屏）
  if (needs.mood < 22 && pet.angryT <= 0 && Math.random() < dt * 0.06) pet.angryT = 2.2;
  if (needs.hunger < 12 && pet.sleepyT <= 0 && Math.random() < dt * 0.04) pet.sleepyT = 2.5;

  // 长时间没人理 → 犯困
  if (!pet.dragging) {
    pet.idleFor += dt;
    if (pet.idleFor > 150 && pet.sleepyT <= 0 && pet.bubbleT <= 0) {
      pet.idleFor = 120;
      if (tooTired()) {
        pet.sleepyT = 6;
        say('好困…', 1.8);
      } else {
        selfAmuse();
      }
    }
    // 没人理太久了，就真的趴下睡
    if (pet.idleFor > 900 && !pet.asleep && pet.bubbleT <= 0) {
      pet.asleep = true;
      pet.sleepT = 0;
      pet.tiredT = 0;
      setState('sleep');
      say('先眯一会儿…', 2.2);
    }
  }

  if (singMode && tooTired()) {
    singMode = false;
    lyrics = [];
    lyricIdx = -1;
    if (pet.bubbleT <= 0) say('困了…先不唱了', 2.4);
  }

  // 听歌：偶尔跟着唱两句（不是每句都唱）
  if (isListening() && singMode && !pet.dragging) {
    if (lyrics.length && singPlan.length) {
      const el = (performance.now() - lyricStart) / 1000;
      if (singNext < singPlan.length && el >= singPlan[singNext]) {
        if (pet.bubbleT <= 0) {
          let idx = -1;
          for (let i = 0; i < lyrics.length; i++) {
            if (lyrics[i].t <= el) idx = i; else break;
          }
          if (idx >= 0) say('♪ ' + lyrics[idx].s.slice(0, 22), 4.2);
          singNext++;
        }
      }
    } else if (pet.bubbleT <= 0) {
      pet.humT -= dt;
      if (pet.humT <= 0) {
        say(HUM[Math.floor(Math.random() * HUM.length)], 2.2);
        pet.humT = 9 + Math.random() * 12;
      }
    }
  }

  // 自己也会随机哼两句记录过的歌词
  if (pet.selfSingT === undefined) pet.selfSingT = 90 + Math.random() * 150;
  pet.selfSingT -= dt;
  if (pet.selfSingT <= 0) {
    pet.selfSingT = 150 + Math.random() * 240;
    if (!isListening() && pet.bubbleT <= 0 && !pet.dragging) {
      const db = lyricDbRead();
      if (db.length) {
        const song = db[Math.floor(Math.random() * db.length)];
        const line = song.lines[Math.floor(Math.random() * song.lines.length)];
        if (line) say('♪ ' + line.slice(0, 22), 3.6);
      }
    }
  }

  // 睡着的时候不说话
  if (pet.asleep) {
    pet.bubbleT = Math.min(pet.bubbleT, 0);
    return;
  }

  // 隔一阵子发个呆、问点什么
  if (!pet.dragging && pet.bubbleT <= 0) {
    pet.curiousT -= dt;
    if (pet.curiousT <= 0) {
      pet.curiousT = 420 + Math.random() * 480;
      const h = new Date().getHours();
      const pool = h >= 23 || h < 6
        ? ['这么晚了…你不睡吗', '几点了…困', '你还在敲键盘']
        : ['你在忙什么呀', '屏幕上一堆字，看不懂', '你在发消息给谁', '现在是几点了…'];
      say(pool[Math.floor(Math.random() * pool.length)], 3.2);
      if (Math.random() < 0.4) pet.stateT = 0;
    }
  }

  // 爱心飘动
  for (let i = pet.hearts.length - 1; i >= 0; i--) {
    const h = pet.hearts[i];
    h.t += dt;
    h.y -= 34 * dt;
    h.x += h.vx * dt;
    if (h.t > 1.6) pet.hearts.splice(i, 1);
  }

  // 被别的窗口「撞」到：窗口正在快速移动且正好压过她
  if (pet.hitCd > 0) pet.hitCd -= dt;
  else {
    const cx = pet.x + PET_W / 2;
    const cy = pet.y + PET_H / 2;
    for (const p of platforms) {
      if (p.id === pet.standId) continue;
      if (Math.abs(p.dx) < 22 && Math.abs(p.dy) < 22) continue;
      if (cx > p.x - 14 && cx < p.x + p.w + 14 && cy > p.y - 14 && cy < p.y + p.hh + 14) {
        setState('fall');
        pet.dizzyT = 1.3;
        pet.hitCd = 3;
        pet.vy = -300;
        pet.vx = Math.max(-560, Math.min(560, (p.dx || 0) * 0.9 + (p.dy || 0) * 0.5));
        pet.knocked = true;
        feel(-10);
        say(pickLine('bump', ['哇啊！撞到我了', '撞、撞到了', '哎哟你干嘛']), 1.6);
        break;
      }
    }
  }

  // 眨眼
  pet.blinkCd -= dt;
  if (pet.blinkCd <= 0) {
    pet.blinkT = 0.13;
    pet.blinkCd = 2.2 + Math.random() * 4;
  }
  if (pet.blinkT > 0) pet.blinkT -= dt;
  if (pet.angryT > 0) pet.angryT -= dt;

  // 隔一会儿记一下位置
  pet.saveCd = (pet.saveCd || 0) - dt;
  if (pet.saveCd <= 0) {
    pet.saveCd = 2.5;
    try { localStorage.setItem('petX', String(Math.round(pet.x))); } catch {}
  }

  // 上报屏幕矩形（主进程判断光标是否在它身上，拖文件才收得到）
  pet.rectCd = (pet.rectCd || 0) - dt;
  if (pet.rectCd <= 0) {
    pet.rectCd = 0.25;
    try {
      window.petAPI.petRect({ x: ORIGIN.x + pet.x, y: ORIGIN.y + pet.y, w: PET_W, h: PET_H });
    } catch {}
  }

  if (pet.perched) {
    pet.perchT = (pet.perchT || 0) - dt;
    if (pet.perchT <= 0 || pet.dragging) {
      pet.perched = false;
      pet.standId = 0;
      pet.vy = 30;
      setState('fall');
    }
  }
  if (pet.squash > 0) pet.squash *= Math.pow(0.0002, dt);

  // 躲起来偷看
  if (pet.state === 'hide') {
    pet.vx = 0;
    pet.vy = 0;
    pet.standId = 0;
    pet.hideT -= dt;
    pet.peekT -= dt;
    if (pet.peekT <= 0) {
      pet.peeking = !pet.peeking;
      pet.peekT = pet.peeking ? 1.6 + Math.random() * 2.2 : 2.4 + Math.random() * 4.5;
    }
    const target = pet.peeking
      ? pet.hideBase + pet.hideDir * PET_W * 0.66
      : pet.hideBase + pet.hideDir * PET_W * 0.14;
    pet.x += (target - pet.x) * Math.min(1, dt * 7);
    pet.y = GROUND - PET_H;
    if (pet.hideT <= 0) {
      setState('idle');
      pet.hideCd = 12 + Math.random() * 20;
    }
    return;
  }

  // 躲藏计时
  if (!pet.dragging) {
    pet.hideCd -= dt;
    if (pet.hideCd <= 0 && needs.mood > 8) goHide();
  }

  if (pet.dragging) {
    pet.x = Math.max(0, Math.min(W - PET_W, mouse.x - pet.dragDX));
    pet.y = Math.max(0, Math.min(GROUND - PET_H, mouse.y - pet.dragDY));
    pet.vx = 0;
    pet.vy = 0;
    return;
  }

  pet.vy += GRAVITY * dt;
  pet.x += pet.vx * dt;
  pet.y += pet.vy * dt;

  // 站在别的窗口顶上：跟着窗口一起走（连位置带高度），只有窗口消失或猛地甩动才掉
  if (pet.standId) {
    const p = platforms.find((q) => q.id === pet.standId);
    if (!p) {
      pet.standId = 0;
    } else {
      // 跟随窗口：缓动 + 单帧上限，别跟着窗户飞
      var mdx = Math.max(-45, Math.min(45, p.dx || 0));
      var mdy = Math.max(-45, Math.min(45, p.dy || 0));
      pet.x += mdx * 0.35;
      pet.y += mdy * 0.35;
      if (Math.abs(p.dx) > 700 || Math.abs(p.dy) > 700) {
        pet.standId = 0;
        pet.vy = 40;
        setState('fall');
        say('呜哇——', 1.2);
      }
    }
  }

  const bottomY = pet.y + PET_H;
  const f = floorAt(pet.x + PET_W / 2, bottomY, pet.vy);
  if (bottomY >= f) {
    const fell = pet.vy > 500;
    pet.y = f - PET_H;
    pet.vy = 0;
    pet.standId = platformIdAt(pet.x + PET_W / 2, f);
    if (pet.state === 'fall') {
      if (pet.knocked) {
        pet.knocked = false;
        feel(-8);
        setState('down');
        pet.downT = 2.4;
        pet.squash = 0.34;
        say(pickLine('fall', ['哎哟…', '摔、摔到了', '腿软了']), 1.6);
      } else if (fell) {
        feel(-4);
        setState('dizzy');
        pet.dizzyT = 0.8;
        pet.squash = 0.28;
        say(pickLine('fall', ['哎哟…', '摔、摔到了']), 1.4);
      } else {
        setState('idle');
      }
    }
  } else if (pet.state !== 'fall') {
    setState('fall');
  }

  if (pet.x < 0) { pet.x = 0; pet.vx = Math.abs(pet.vx); pet.facing = 1; }
  if (pet.x > W - PET_W) { pet.x = W - PET_W; pet.vx = -Math.abs(pet.vx); pet.facing = -1; }

  switch (pet.state) {
    case 'idle': {
      pet.vx *= 0.9;
      const lazy = needs.mood < 30;
      const full = needs.hunger > 80 && needs.mood > 65;
      const wait = lazy ? 8 + Math.random() * 10 : full ? 1.6 : 2.5 + Math.random() * 3;
      if (pet.stateT > wait) {
        if (Math.random() < 0.22 && perchOnWindow()) { pet.stateT = 0; break; }
        if (lazy && Math.random() < 0.6) { pet.stateT = 0; break; }
        const cx0 = pet.x + PET_W / 2;
        const dx = mouse.x - cx0;
        const keen = needs.hunger < 35 || full;
        if (mouse.x > 0 && Math.abs(dx) > 200 && Math.random() < (keen ? 0.6 : 0.35)) {
          pet.facing = dx > 0 ? 1 : -1;
        } else {
          pet.facing = Math.random() < 0.5 ? -1 : 1;
        }
        setState('walk');
      }
      break;
    }
    case 'down': {
      pet.vx *= 0.7;
      pet.downT -= dt;
      if (pet.downT <= 0) setState('idle');
      break;
    }
    case 'walk':
      pet.vx = pet.facing * 52;
      if (pet.x <= 0) pet.facing = 1;
      if (pet.x >= W - PET_W) pet.facing = -1;
      if (pet.stateT > 2 + Math.random() * 2) setState('idle');
      break;
    case 'dizzy':
      pet.vx *= 0.85;
      pet.dizzyT -= dt;
      if (pet.dizzyT <= 0) setState('idle');
      break;
    case 'fall':
      pet.vx *= 0.995;
      break;
  }
}

// ---------- 画 ----------

function currentFrame() {
  // 表情切换：眨眼 > 惊讶(被撞/被拖) > 困 > 开心(被摸/吃饱) > 生气 > 普通
  if (pet.blinkT > 0 && EXPR.blink) return EXPR.blink;
  if ((pet.state === 'dizzy' || pet.dragging) && EXPR.surprise) return EXPR.surprise;
  if (pet.sleepyT > 0 && EXPR.sleepy) return EXPR.sleepy;
  if ((pet.cheerT > 0 || pet.blushT > 0) && EXPR.smile) return EXPR.smile;
  if (pet.angryT > 0 && EXPR.angry) return EXPR.angry;
  return EXPR.normal || STILL.front || ANIM.idle[0] || null;
}

function draw(now) {
  ctx.clearRect(0, 0, W, H);
  syncL2D(now);
  drawPet(now);
  drawNeeds();
  if (pet.bubbleT > 0) drawBubble();
}

// 按当前显示尺寸预缩放，避免每帧对 640px 大图重采样
const WCACHE = { base: null, blink: null, h: 0 };
function cacheWhale() {
  if (!WHALE.base.complete || !WHALE.base.naturalWidth) return;
  const targetH = Math.max(64, Math.min(900, Math.round(PET_H * DPR * 1.15)));
  if (WCACHE.h === targetH && WCACHE.base) return;
  const make = (img) => {
    const c = document.createElement('canvas');
    const w = Math.round((img.width / img.height) * targetH);
    c.width = w;
    c.height = targetH;
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, w, targetH);
    return c;
  };
  WCACHE.base = make(WHALE.base);
  WCACHE.blink = WHALE.blink.complete && WHALE.blink.naturalWidth ? make(WHALE.blink) : null;
  WCACHE.h = targetH;
}


function drawNeeds() {
  if (!pet.showNeedT || pet.showNeedT <= 0) return;
  const a = Math.min(1, pet.showNeedT);
  const txt = '饱腹 ' + Math.round(needs.hunger) + '%   心情 ' + Math.round(needs.mood) + '%';
  ctx.save();
  ctx.globalAlpha = a;
  ctx.font = '600 12px "Microsoft YaHei", "PingFang SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  const bx = pet.x + PET_W / 2;
  const by = pet.y - 8;
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(20,24,40,0.8)';
  ctx.strokeText(txt, bx, by);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(txt, bx, by);
  ctx.restore();
}

function drawPet(now) {
  if (pet.perched) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, Math.max(0, pet.perchEdge || (pet.y + PET_H * 0.58)));
    ctx.clip();
  }
  drawPetInner(now);
  if (pet.perched) ctx.restore();
}

function drawPetInner(now) {
  cacheWhale();
  const img = currentFrame(now);
  const cx = pet.x + PET_W / 2;
  const bottom = pet.y + PET_H;

  const breathe = Math.sin(now / 620) * 0.016;
  const bob = pet.state === 'walk' ? Math.abs(Math.sin(now / 130)) * 5 : 0;
  const lean = pet.state === 'walk' ? Math.sin(now / 200) * 0.045 : 0;
  const sway = pet.state === 'idle' ? Math.sin(now / 1500) * 0.022 : 0;
  const shake = pet.state === 'drag' ? Math.sin(now / 45) * 0.05 : 0;

  // 影子
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(cx, bottom - 2, PET_W * 0.34, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (WHALE.base.complete && WHALE.base.naturalWidth && !L2D.ready) {
    const dh = PET_H;
    const srcW = WCACHE.base || WHALE.base;
    const dw = (srcW.width / srcW.height) * dh;
    // 眨眼：每 5.2 秒一次，单眨 + 双眨
    const ph = (now / 1000) % 5.2;
    const blinkOn = (pet.asleep || ph < 0.11 || (ph > 2.35 && ph < 2.46)) && WHALE.blink.complete && WHALE.blink.naturalWidth;
    ctx.save();
    ctx.translate(cx, bottom - bob);
    if (pet.state === 'down') { ctx.translate(0, -PET_H * 0.42); ctx.rotate((Math.PI / 2) * (pet.facing >= 0 ? 1 : -1)); }
    ctx.rotate(lean + shake + sway);
    ctx.scale(pet.facing * (1 + pet.squash * 0.6), (1 + breathe) * (1 - pet.squash));
    ctx.imageSmoothingQuality = pet.state === 'drag' ? 'low' : 'high';
    ctx.drawImage((blinkOn && WCACHE.blink) ? WCACHE.blink : (WCACHE.base || WHALE.base), -dw / 2, -dh, dw, dh);
    if (pet.blushT > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, pet.blushT) * 0.5;
      ctx.fillStyle = '#FF8FA3';
      for (const sd of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(sd * dw * 0.12, -dh * 0.80, dw * 0.05, dh * 0.018, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    if (isListening() && singMode) drawNotes(dw, dh, now);
    ctx.restore();
  } else if (img && !L2D.ready) {
    const dh = PET_H;
    const dw = (img.width / img.height) * dh;
    ctx.save();
    ctx.translate(cx, bottom - bob);
    if (pet.state === 'down') { ctx.translate(0, -PET_H * 0.42); ctx.rotate((Math.PI / 2) * (pet.facing >= 0 ? 1 : -1)); }
    ctx.rotate(lean + shake + sway);
    ctx.scale(pet.facing * (1 + pet.squash * 0.6), (1 + breathe) * (1 - pet.squash));
    ctx.drawImage(img, -dw / 2, -dh, dw, dh);
    if (pet.blushT > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, pet.blushT) * 0.5;
      ctx.fillStyle = '#FF8FA3';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(s * dw * 0.21, -dh * 0.70, dw * 0.085, dh * 0.032, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    if (isListening() && singMode) drawNotes(dw, dh, now);
    ctx.restore();
  }

  // 困了冒 Zzz
  if (pet.sleepyT > 0 || pet.asleep) {
    for (let i = 0; i < 2; i++) {
      const p = ((now / 1000 + i * 0.8) % 2.4) / 2.4;
      ctx.save();
      ctx.globalAlpha = (1 - p) * 0.85;
      ctx.fillStyle = '#7C8DB5';
      ctx.font = Math.round(PET_H * (0.10 + p * 0.10)) + 'px "Segoe UI", sans-serif';
      ctx.fillText('Z', cx + PET_W * 0.28 + p * 30, bottom - PET_H * 0.72 - p * 40);
      ctx.restore();
    }
  }

  // 爱心
  for (const h of pet.hearts) {
    drawHeart(h.x, h.y, 7 + h.t * 3, Math.max(0, 1 - h.t / 1.6));
  }

  // 听歌飘音符
  if (isListening()) {
    const t = (now / 1000) % 3;
    ctx.save();
    ctx.globalAlpha = 1 - t / 3;
    ctx.font = Math.round(PET_H * 0.22) + 'px "Segoe UI Symbol", sans-serif';
    ctx.fillStyle = '#4D6BFE';
    ctx.fillText('♪', cx + PET_W * 0.42 + t * 4, bottom - PET_H * 0.8 - t * 16);
    ctx.restore();
  }

  // 眩晕星星（蹲坐图时画在头顶）
  if (pet.state === 'dizzy') {
    for (let i = 0; i < 3; i++) {
      const a = now / 260 + (i * Math.PI * 2) / 3;
      const sx = cx + Math.cos(a) * 34;
      const sy = bottom - PET_H + 42 + Math.sin(a) * 7;
      drawStar(sx, sy, 6, '#FFD84D');
    }
  }

  // 拖拽汗滴
  if (pet.state === 'drag' && Math.floor(now / 220) % 2 === 0) {
    ctx.save();
    ctx.fillStyle = 'rgba(150,210,255,0.95)';
    const sx = cx + pet.facing * 46;
    const sy = pet.y + 34;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(sx + 5, sy + 10, sx, sy + 15);
    ctx.quadraticCurveTo(sx - 5, sy + 10, sx, sy);
    ctx.fill();
    ctx.restore();
  }
}

// 耳机（画在立绘局部坐标：底部 y=0，头顶 y=-dh）
function drawHeadphones(dw, dh) {
  const r = dw * 0.40;
  const hy = -dh * 0.60;
  const bandW = Math.max(5, dh * 0.055);

  ctx.save();
  ctx.lineCap = 'round';

  // 头梁：白底 + 蓝芯 + 外发光
  ctx.shadowColor = 'rgba(90,140,255,0.75)';
  ctx.shadowBlur = Math.max(7, dh * 0.06);
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = bandW;
  ctx.beginPath();
  ctx.arc(0, hy, r, Math.PI * 1.02, Math.PI * 1.98);
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.strokeStyle = '#5C7CFF';
  ctx.lineWidth = Math.max(2, bandW * 0.42);
  ctx.beginPath();
  ctx.arc(0, hy, r, Math.PI * 1.02, Math.PI * 1.98);
  ctx.stroke();

  // 耳罩：白色大圆罩 + 蓝内圈 + 高光
  for (const s of [-1, 1]) {
    const cx = s * r;
    const cy = hy + dh * 0.02;
    const rx = dw * 0.135;
    const ry = dh * 0.115;

    ctx.shadowColor = 'rgba(70,120,255,0.85)';
    ctx.shadowBlur = Math.max(9, dh * 0.08);
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, s * 0.10, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = '#5C7CFF';
    ctx.lineWidth = Math.max(2, dh * 0.014);
    ctx.stroke();

    ctx.fillStyle = '#6E93FF';
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 0.6, ry * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.ellipse(cx - rx * 0.3, cy - ry * 0.34, rx * 0.28, ry * 0.18, -0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawNotes(dw, dh, t) {
  ctx.save();
  ctx.font = `600 ${Math.max(10, dh * 0.14)}px "Segoe UI", sans-serif`;
  ctx.textAlign = 'center';
  for (let i = 0; i < 3; i++) {
    const ph = ((t / 1600) + i / 3) % 1;
    const alpha = ph < 0.15 ? ph / 0.15 : ph > 0.8 ? (1 - ph) / 0.2 : 1;
    ctx.globalAlpha = Math.max(0, alpha) * 0.55;
    ctx.fillStyle = i % 2 ? '#FF9EC4' : '#6E93FF';
    const yy = -dh * 1.02 - ph * dh * 0.5;
    const xx = Math.sin(ph * Math.PI * 2 + i * 1.7) * dw * 0.2 + (i - 1) * dw * 0.18;
    ctx.fillText(i % 2 ? '♪' : '♫', xx, yy);
  }
  ctx.restore();
}

function drawHeart(x, y, s, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#FF6F91';
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.3);
  ctx.bezierCurveTo(x, y, x - s, y, x - s, y + s * 0.45);
  ctx.bezierCurveTo(x - s, y + s * 0.9, x, y + s * 1.15, x, y + s * 1.5);
  ctx.bezierCurveTo(x, y + s * 1.15, x + s, y + s * 0.9, x + s, y + s * 0.45);
  ctx.bezierCurveTo(x + s, y, x, y, x, y + s * 0.3);
  ctx.fill();
  ctx.restore();
}

function drawStar(x, y, r, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawBubble() {
  const text = pet.bubbleText;
  ctx.save();
  ctx.font = '500 12px "Microsoft YaHei UI", "Microsoft YaHei", sans-serif';
  const tw = ctx.measureText(text).width;
  const padX = 9;
  const w = tw + padX * 2;
  const h = 24;
  const bx = Math.max(6, Math.min(W - w - 6, pet.x + PET_W / 2 - w / 2));
  const by = Math.max(6, petTop() - 28);
  const r = 10;

  ctx.globalAlpha = Math.min(1, pet.bubbleT * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.96)';
  ctx.strokeStyle = 'rgba(77,107,254,0.55)';
  ctx.lineWidth = 1.5;
  roundRect(bx, by, w, h, r);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(pet.x + PET_W / 2 - 6, by + h - 1);
  ctx.lineTo(pet.x + PET_W / 2, by + h + 8);
  ctx.lineTo(pet.x + PET_W / 2 + 6, by + h - 1);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,0.96)';
  ctx.fill();

  ctx.fillStyle = '#16224A';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, bx + w / 2, by + h / 2 + 1);
  ctx.restore();
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------- 鼠标 ----------

function inPet(mx, my) {
  const pad = 6;
  const half = HIT_W / 2;
  const cx = pet.x + PET_W / 2;
  return mx >= cx - half - pad && mx <= cx + half + pad && my >= petTop() - pad && my <= pet.y + PET_H + pad;
}

window.addEventListener('mousemove', (e) => {
  if (pet.dragging) {
    const now = e.timeStamp || performance.now();
    const dt = Math.max(12, now - lastMoveT) / 1000;
    dragVX = (e.clientX - mouse.x) / dt;
    dragVY = (e.clientY - mouse.y) / dt;
    lastMoveT = now;
  }
  mouse.x = e.clientX;
  mouse.y = e.clientY;
  if (pet.dragging) return;
  const inside = inPet(mouse.x, mouse.y);
  if (inside !== lastHit) {
    lastHit = inside;
    pet.hitInside = inside;
    window.petAPI.setHit(inside);
    document.body.style.cursor = inside ? 'grab' : 'default';
  }
});

window.addEventListener('mousedown', (e) => {
  if (!inPet(e.clientX, e.clientY)) return;
  pet.idleFor = 0;
  pet.sleepyT = 0;

  if (pet.state === 'hide') {
    setState('idle');
    pet.hideCd = 12 + Math.random() * 20;
    pet.vy = -200;
    pet.blushT = 1.4;
    say(pickLine('found', ['啊…被发现了', '唔…', '看、看见我了', '干嘛呀']), 1.6);
    return;
  }

  // 点上半身 = 摸头，下半身 = 抓起来
  try { window.petAPI.dragState(true); } catch {}
  if (e.clientY < pet.y + PET_H * 0.45) {
    if (needs.mood < 22) {
      pet.angryT = 1.8;
      feel(-1);
      say(pickLine('patLow', ['别碰…', '现在不想理你', '哼']), 1.6);
      return;
    }
    pet.blushT = 2.2;
    pet.cheerT = 1.8;
    pet.vy = -210;
    feel(5);
    setState('fall');
    say(pickLine('pat', ['嘿嘿…', '痒~', '再摸一下']), 1.6);
    for (let i = 0; i < 3; i++) {
      pet.hearts.push({ x: pet.x + PET_W / 2 + (Math.random() - 0.5) * 44, y: pet.y + 8, t: 0, vx: (Math.random() - 0.5) * 26 });
    }
    return;
  }

  pet.dragging = true;
  pet.dragDX = e.clientX - pet.x;
  pet.dragDY = e.clientY - pet.y;
  if (pet.asleep) { pet.asleep = false; pet.sleepT = 0; say('唔…我醒了', 2); }

  feel(-2);
  setState('drag');
  document.body.style.cursor = 'grabbing';
  say(pickLine('lift', ['哇啊——', '放我下来！', '我、我恐高…']), 2);
});

window.addEventListener('mouseup', () => {
  if (!pet.dragging) return;
  pet.dragging = false;
  try { window.petAPI.dragState(false); } catch {}
  // 甩出去：保留手的速度，撞墙会反弹
  pet.vx = Math.max(-1100, Math.min(1100, dragVX * 0.85));
  pet.vy = Math.max(-1100, Math.min(900, dragVY * 0.85));
  if (Math.hypot(pet.vx, pet.vy) > 420) feel(-7);
  setState('fall');
  document.body.style.cursor = 'default';
});

window.addEventListener('dblclick', (e) => {
  if (!inPet(e.clientX, e.clientY)) return;
  pet.vy = -180;
  setState('fall');
  openChat();
});

window.addEventListener('contextmenu', async (e) => {
  console.log('CTXMENU', e.clientX, e.clientY, 'inPet=', inPet(e.clientX, e.clientY), 'asleep=', pet.asleep);
  e.preventDefault();
  if (!inPet(e.clientX, e.clientY)) return;
  say('想吃点东西…', 1.6);
  try {
    const f = await window.petAPI.pickFile();
    if (f) feedFile(f, 'menu');
  } catch {}
});

// 滚轮：指着她的时候调大小
window.addEventListener(
  'wheel',
  (e) => {
    if (!inPet(e.clientX, e.clientY)) return;
    e.preventDefault();
    const step = e.deltaY > 0 ? -12 : 12;
    const oldBottom = pet.y + PET_H;
    PET_H = Math.max(MIN_H, Math.min(MAX_H, PET_H + step));
    const rr = WHALE.base.naturalWidth ? WHALE.base : STILL.front;
  PET_W = Math.round((rr ? rr.width / rr.height : 0.5524) * PET_H);
    HIT_W = Math.round(PET_W * 0.86);
    pet.y = oldBottom - PET_H;
    if (pet.state !== 'drag') pet.y = Math.min(pet.y, GROUND - PET_H);
    try {
      localStorage.setItem('petH', String(PET_H));
    } catch {}
    say(PET_H + 'px', 0.9);
  },
  { passive: false }
);

// Ctrl+滚轮也可以（方便在空白处调）
window.addEventListener(
  'wheel',
  (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const step = e.deltaY > 0 ? -12 : 12;
    const oldBottom = pet.y + PET_H;
    PET_H = Math.max(MIN_H, Math.min(MAX_H, PET_H + step));
    PET_W = Math.round((STILL.front ? STILL.front.width / STILL.front.height : 0.9) * PET_H);
    HIT_W = Math.round(PET_W * 0.86);
    pet.y = Math.min(oldBottom - PET_H, GROUND - PET_H);
    try {
      localStorage.setItem('petH', String(PET_H));
    } catch {}
    say(PET_H + 'px', 0.9);
  },
  { passive: false }
);

// ── 其它窗口的矩形 → 可以趴上去的平台 ──
window.petAPI.onRects((arr) => {
  if (!Array.isArray(arr)) return;
  const next = new Map();
  const nb = [];
  for (const r of arr) {
    if (!r || !r.t) continue;
    if (r.t === 'DeepSeek 桌宠' || r.t === 'Program Manager' || r.t === 'Windows 输入体验') continue;
    const old = prevRects.get(r.h);
    nb.push({
      id: r.h,
      x: r.x - ORIGIN.x,
      y: r.y - ORIGIN.y,
      w: r.w,
      hh: r.hh,
      fg: !!r.fg,
      dx: old ? r.x - old.x : 0,
      dy: old ? r.y - old.y : 0,
    });
    next.set(r.h, { x: r.x, y: r.y });
  }
  prevRects = next;
  platforms = nb;
});

// ── 喂食 ──
async function feedFile(f, from) {
  if (!f) return;
  pet.asleep = false;
  pet.sleepT = 0;
  pet.tiredT = 0;
  if (pet.state === 'sleep') setState('idle');
  console.log('FEED', from, f.name, f.size, f.path ? 'has-path' : 'no-path');
  const txt = (f.text || '').slice(0, 200000);
  pet.cheerT = 2.8;
  pet.vy = -180;
  const name = (f.name || '文件').slice(0, 18);
  if (txt || (f.size || 0) > 0 || f.path) {
    feel(8, 26);
    const chars = txt ? txt.replace(/\s+/g, '').length : 0;
    const size = f.size > 1048576 ? (f.size / 1048576).toFixed(1) + 'MB' : Math.max(1, Math.round((f.size || 0) / 1024)) + 'KB';
    const stuffed = needs.hunger > 92;
    const fullLv = needs.hunger < 20 ? '肚子才刚有点东西' : needs.hunger < 50 ? '半饱' : needs.hunger < 85 ? '差不多了' : '这次真饱了';
    pet.showNeedT = 6;
    say(pickLine('eat', ['嗷呜～ ' + name + ' 吃掉了', '嗯…' + name + ' 还行', '这个我吃']).replace(/\{name\}/g, name), 3.6);
    if (f.path) {
      const ok = await window.petAPI.trash(f.path);
      const pctNow2 = Math.round(needs.hunger);
      if (ok) setTimeout(() => say((chars > 0 ? chars + ' 字，' + size : ((f.size || 0) === 0 ? '空的…也吃了' : size + '，嚼不动但吞下去了')) + '，饱腹 ' + pctNow2 + '%', 3), 3400);
    }
    const pctNow = Math.round(needs.hunger);
    if (!f.path) setTimeout(() => say(pickLine('eatAfter', [fullLv, '这一口下去舒服了']).replace(/\{pct\}/g, pctNow) + '，饱腹 ' + pctNow + '%', 3), 3400);
  } else {
    feel(-2, 4);
    say('嗷呜！' + name + ' 啃不动', 3.2);
  }
}

window.addEventListener('dragenter', (e) => {
  if (!e.dataTransfer) return;
  if (!inPet(e.clientX, e.clientY)) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
});
window.addEventListener('dragover', (e) => {
  if (!e.dataTransfer) return;
  if (!inPet(e.clientX, e.clientY)) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
  pet.cheerT = Math.max(pet.cheerT, 0.5);
});
window.addEventListener('drop', async (e) => {
  console.log('DROP', e.clientX, e.clientY, e.dataTransfer && e.dataTransfer.files.length);
  if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
  e.preventDefault();
  const f = e.dataTransfer.files[0];
  let txt = '';
  try { txt = await f.text(); } catch {}
  let fpth = '';
  try { fpth = window.petAPI.pathOf(f); } catch {}
  feedFile({ name: f.name, size: f.size, text: txt, path: fpth }, 'drop');
});

try { window.petAPI.onFeed((f) => feedFile(f, 'tray')); } catch {}

// ---------- 聊天 ----------

const REPLY_RULES = [
  { k: /饿|吃|饭|喂/, a: ['你喂我个文件我就吃', '肚子还有一点空', '想吃鲸鱼饼干', '有 txt 吗'] },
  { k: /名字|你是谁|叫什么/, a: ['我是大肥鱼，DeepSeek 的鲸鱼娘', '叫大肥鱼就行', 'DeepSeek 家的'] },
  { k: /你好|在吗|hi|hello|嗨/i, a: ['在的', '嗯？', '叫我干嘛', '我在我在'] },
  { k: /睡|困|晚安|熬夜/, a: ['你困了就先睡', '现在还不困', '晚安…', '别熬太晚'] },
  { k: /几岁|年龄|多大/, a: ['女孩子不聊这个', '秘密', '你猜'] },
  { k: /可爱|好看|漂亮|喜欢|爱/, a: ['诶嘿嘿…', '你也好看', '少来这套', '哼，算你会说话'] },
  { k: /笨|丑|滚|烦|傻/, a: ['哼！', '你才笨', '我要生气了', '不理你了'] },
  { k: /工作|加班|累|店|单量/, a: ['又加班…', '早点弄完早点睡', '34 家店，累不累啊', '数据看完就歇会儿'] },
  { k: /几点|时间|现在/, a: [() => `${new Date().getHours()} 点 ${new Date().getMinutes()} 分`, '你自己看表'] },
  { k: /谢谢|谢了|好的/, a: ['不客气', '嗯嗯', '这还差不多'] },
];

const REPLY_FALLBACK = [
  '嗯…没听懂，但你继续说',
  '哦哦，这样啊',
  '我在听',
  '然后呢',
  '你这句好长，我慢慢想',
  '嘿嘿，好',
  '嗯？',
];

function replyTo(text) {
  const t = (text || '').trim();
  if (!t) return '……你倒是说话呀';
  for (const r of REPLY_RULES) {
    if (r.k.test(t)) {
      const a = r.a[Math.floor(Math.random() * r.a.length)];
      return typeof a === 'function' ? a() : a;
    }
  }
  return REPLY_FALLBACK[Math.floor(Math.random() * REPLY_FALLBACK.length)];
}



const AMUSE_WALK = ['溜达一圈', '去那边看看', '腿坐麻了', '随便走走', '逛一下'];
const AMUSE_HIDE = ['藏起来了', '你看不见我', '躲一下', '嘘'];
const AMUSE_SIT = ['找个地方坐坐', '这儿待着舒服', '趴一会儿', '蹲这儿了'];

function selfAmuse() {
  const roll = Math.random();
  if (roll < 0.55) {
    pet.facing = Math.random() < 0.5 ? -1 : 1;
    setState('walk');
    say(AMUSE_WALK[Math.floor(Math.random() * AMUSE_WALK.length)], 1.8);
  } else if (roll < 0.8) {
    goHide();
    say(AMUSE_HIDE[Math.floor(Math.random() * AMUSE_HIDE.length)], 1.6);
  } else {
    pet.facing = Math.random() < 0.5 ? -1 : 1;
    setState('walk');
    pet.sitWant = 4;
    say(AMUSE_SIT[Math.floor(Math.random() * AMUSE_SIT.length)], 1.8);
  }
}


// ---------- 饿了会自己找吃的 ----------
let lastSelfFeed = 0;
const SELF_FEED_LINES = ['饿得不行了…自己弄点吃的', '肚子空得能装下整片海', '不管了，去盛碗饭', '再不吃我要啃屏幕了'];

function scheduleSelfFeed() {
  if (pet.selfFeedPend) return;
  pet.selfFeedPend = true;
  setTimeout(function () {
    pet.selfFeedPend = false;
    maybeSelfFeed();
  }, 1500 + Math.random() * 5000);
}

function maybeSelfFeed() {
  if (pet.asleep || pet.dragging) return;
  if (Date.now() - lastSelfFeed < 8 * 60 * 1000) return;
  lastSelfFeed = Date.now();
  say(SELF_FEED_LINES[Math.floor(Math.random() * SELF_FEED_LINES.length)], 2.2);
  setTimeout(async () => {
    try {
      const snack = await window.petAPI.makeSnack();
      if (snack) feedFile(snack, 'self');
    } catch (e) {}
  }, 2300);
}


// ---------- 台词池：由大模型生成，交互时随机取，不重复 ----------
const LINE_POOL_KEY = 'linePool_v1';
const SCENES = {
  pat: '被主人摸头的时候',
  patLow: '心情不好、不想被摸的时候',
  lift: '被人从桌面上抓起来拎在半空的时候',
  fall: '从高处摔到地上的时候',
  bump: '被窗口撞到的时候',
  found: '躲起来被主人发现的时候',
  eat: '主人喂你吃东西、你正在吃的时候',
  eatAfter: '刚吃完东西、打了个饱嗝的时候',
};
let linePool = {};
try { linePool = JSON.parse(localStorage.getItem(LINE_POOL_KEY) || '{}'); } catch (e) { linePool = {}; }

function savePool() { try { localStorage.setItem(LINE_POOL_KEY, JSON.stringify(linePool)); } catch (e) {} }

let poolBusy = false;
async function refreshPool(scene) {
  if (poolBusy || !window.petAPI.ask) return;
  poolBusy = true;
  try {
    const r = await window.petAPI.ask({ messages: [
      { role: 'system', content: '你是大肥鱼，DeepSeek 的鲸鱼娘，住在桌面上的小桌宠，人设是超级傲娇的大小姐。说话很短、口语、嘴硬心软，爱说「哼」「才不是」，不自称 AI。' },
      { role: 'user', content: '写 8 句「' + SCENES[scene] + '」时你会说的话。每句不超过 12 个字，口语，各不相同，不要编号，用 | 分隔，只输出这些句子。' },
    ] });
    const arr = String(r || '').split(/[|｜]/)
      .map((x) => x.replace(/^[\s"'「」0-9.、]+|[\s"'「」]+$/g, ''))
      .filter((x) => x.length > 0 && x.length <= 22);
    if (arr.length >= 4) {
      linePool[scene] = arr;
      savePool();
      console.log('POOL', scene, arr.length, JSON.stringify(arr.slice(0, 2)));
    }
  } catch (e) {} finally { poolBusy = false; }
}

function pickLine(scene, fallback) {
  const arr = linePool[scene];
  if (arr && arr.length) {
    const t = arr.shift();
    arr.push(t);
    savePool();
    return t;
  }
  if (Math.random() < 0.5) refreshPool(scene);
  if (typeof fallback === 'function') return fallback();
  return fallback[Math.floor(Math.random() * fallback.length)];
}

setTimeout(() => {
  const keys = Object.keys(SCENES);
  keys.forEach((k, i) => setTimeout(() => refreshPool(k), i * 6000));
}, 8000);

// ---------- 大模型：会思考的部分 ----------
const aiHistory = [];
let aiBusy = false;

function ctxLine() {
  const now = new Date();
  const song = media.playing && media.title ? '他正在听《' + media.title + '》。' : '';
  return '现在是 ' + now.getHours() + ' 点 ' + String(now.getMinutes()).padStart(2, '0') + ' 分。' + song;
}

const AI_RULES = '说话规则：\n' +
  '1. 一次只回一句，25 个字以内，口语。\n' +
  '2. 不用书面词（另外、同时、此外），句尾不必带句号。\n' +
  '3. 绝不自称 AI、模型、助手。\n' +
  '4. 你看不到屏幕，别假装看到他屏幕上的内容；不知道就说不知道，不编。\n' +
  '5. 不要每句话都提问。\n' +
  '6. 不要给建议、不要安慰式客套。\n' +
  '7. 可以只说半句、只用语气词（哼、诶、哦、啊）。';

const AI_HEAD = '你是「大肥鱼」，DeepSeek 的鲸鱼娘，住在林先生电脑桌面上的小桌宠。';
const AI_TAIL = '\n他 25 岁，在佛山南海桂城，管 34 家奶茶店的外卖运营。\n';
const AI_PERSONA_DEFAULT = '你是超级傲娇的大小姐。嘴硬、爱逞强，常说「哼」「才不是」「谁要…啊」「笨蛋」；爱挑剔、嫌麻烦，但被哄两句就软。';

let AI_SYS = AI_HEAD + AI_PERSONA_DEFAULT + AI_TAIL + AI_RULES;
if (window.petAPI && window.petAPI.getSettings) {
  window.petAPI.getSettings().then(function (s) {
    if (s && s.persona) AI_SYS = AI_HEAD + s.persona + AI_TAIL + AI_RULES;
  }).catch(function () {});
}


async function askAI(userText) {
  if (aiBusy || !window.petAPI.ask) return '';
  aiBusy = true;
  try {
    const msgs = [{ role: 'system', content: AI_SYS }];
    for (const h of aiHistory.slice(-6)) msgs.push(h);
    msgs.push({ role: 'user', content: ctxLine() + ' ' + userText });
    let r = await window.petAPI.ask({ messages: msgs });
    console.log('AI RESULT', JSON.stringify(String(r || '').slice(0, 60)));
    r = (r || '').replace(/^["'「]|["'」]$/g, '').replace(/\s+/g, ' ').trim();
    if (r.length > 60) r = r.slice(0, 60);
    if (r) {
      aiHistory.push({ role: 'user', content: userText });
      aiHistory.push({ role: 'assistant', content: r });
      while (aiHistory.length > 8) aiHistory.shift();
    }
    return r;
  } catch (e) {
    return '';
  } finally {
    aiBusy = false;
  }
}

// 主动开口：每 3~7 分钟一次
let nextTalkT = Date.now() + 75000;
setInterval(() => {
  if (Date.now() < nextTalkT) return;
  nextTalkT = Date.now() + (180000 + Math.random() * 240000);
  if (pet.asleep || pet.dragging || pet.bubbleT > 0 || aiBusy) return;
  if (needs.mood < 25) return;
  console.log('AI PROACTIVE TICK');
  askAI('（你在旁边待着，随口嘟囔一句。别说"在忙吗"这种客套话，说具体的、有生活感的东西。）').then((r) => {
    if (r && pet.bubbleT <= 0 && !pet.asleep) say(r, 4.6);
  });
}, 20000);

function openChat() {
  const box = document.getElementById('chat');
  const input = document.getElementById('chatInput');
  if (!box || !input) return;
  box.classList.add('show');
  window.petAPI.setHit(true);
  window.petAPI.chatFocus(true);
  setTimeout(() => input.focus(), 60);
}

function closeChat() {
  const box = document.getElementById('chat');
  const input = document.getElementById('chatInput');
  if (!box) return;
  box.classList.remove('show');
  if (input) input.value = '';
  window.petAPI.setHit(false);
  window.petAPI.chatFocus(false);
  lastHit = false;
  pet.hitInside = false;
}

function sendChat() {
  const input = document.getElementById('chatInput');
  const msg = input ? input.value : '';
  console.log('SEND', JSON.stringify(msg));
  closeChat();
  if (!msg.trim()) return;
  feel(2);
  if (/可爱|好看|漂亮|喜欢|谢谢|乖|厉害|棒|美|爱你|亲|萌|赞/.test(msg)) { pet.cheerT = 2.6; feel(6); }
  if (/笨|丑|滚|烦|傻/.test(msg)) { pet.angryT = 2.4; pet.vy = -120; feel(-12); }
  say('……', 12);
  askAI(msg).then((r) => {
    console.log('REPLY', JSON.stringify(r || ''));
    if (r) say(r, 6);
    else say(replyTo(msg), 4.2);
  }).catch(function (e) { console.log('REPLY ERR', e && e.message); say(replyTo(msg), 4.2); });
}

document.addEventListener('keydown', (e) => {
  const box = document.getElementById('chat');
  if (!box || !box.classList.contains('show')) return;
  if (e.key === 'Enter') { e.preventDefault(); sendChat(); }
  if (e.key === 'Escape') { e.preventDefault(); closeChat(); }
});

window.addEventListener('blur', () => {
  const box = document.getElementById('chat');
  if (box && box.classList.contains('show')) closeChat();
});

// CHAT DRAG：输入框可拖动，位置记住
(function () {
  var box = document.getElementById('chat');
  if (!box) return;
  try {
    var saved = JSON.parse(localStorage.getItem('chatPos') || 'null');
    if (saved) { box.style.left = saved.x + 'px'; box.style.top = saved.y + 'px'; }
  } catch (e) {}
  var dragging = false, sx = 0, sy = 0, ox = 0, oy = 0;
  box.addEventListener('mousedown', function (e) {
    if (e.target && e.target.id === 'chatInput') return;
    var r = box.getBoundingClientRect();
    dragging = true; sx = e.clientX; sy = e.clientY; ox = r.left; oy = r.top;
    e.preventDefault();
  });
  window.addEventListener('mousemove', function (e) {
    if (!dragging) return;
    var x = Math.max(4, Math.min(W - box.offsetWidth - 4, ox + e.clientX - sx));
    var y = Math.max(4, Math.min(H - box.offsetHeight - 4, oy + e.clientY - sy));
    box.style.left = x + 'px';
    box.style.top = y + 'px';
  });
  window.addEventListener('mouseup', function () {
    if (!dragging) return;
    dragging = false;
    try { localStorage.setItem('chatPos', JSON.stringify({ x: parseInt(box.style.left), y: parseInt(box.style.top) })); } catch (e) {}
  });
})();

setInterval(function(){ console.log('POS', Math.round(pet.x), Math.round(pet.y), pet.state, 'asleep='+pet.asleep, 'idleFor='+Math.round(pet.idleFor)); }, 4000);
init();
