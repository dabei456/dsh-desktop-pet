// DeepSeek 桌宠 · 3D 渲染（VRM + three.js），物理与交互复用 2D 层
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');

let W = 0, H = 0, GROUND = 0, DPR = 1;
const GRAVITY = 2600;
const MIN_H = 90, MAX_H = 420;
let PET_H = 150;
let HIT_W = 80;
let PET_W = 93;

try {
  const saved = parseInt(localStorage.getItem('petH'), 10);
  if (saved >= MIN_H && saved <= MAX_H) PET_H = saved;
} catch {}

// ---------- 3D ----------
const R = 640;
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setSize(R, R, false);
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 50);
camera.position.set(0, 0.95, 3.55);
camera.lookAt(0, 0.82, 0);

scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa8c8, 1.5));
const keyLight = new THREE.DirectionalLight(0xffffff, 1.9);
keyLight.position.set(1.1, 2.2, 2.4);
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0xb9d0ff, 1.1);
rimLight.position.set(-1.6, 1.4, -1.4);
scene.add(rimLight);

let vrm = null;
let loaded = false;
const lookTarget = new THREE.Object3D();
scene.add(lookTarget);

const loader = new GLTFLoader();
loader.register((parser) => new VRMLoaderPlugin(parser));
loader.load(
  '../assets/vrm/shizuku.vrm',
  (gltf) => {
    vrm = gltf.userData.vrm;
    try {
      VRMUtils.removeUnnecessaryVertices(gltf.scene);
      VRMUtils.combineSkeletons(gltf.scene);
    } catch {}
    gltf.scene.traverse((o) => {
      o.frustumCulled = false;
    });
    // 统一缩放到 1.5 高、脚底贴 y=0
    const box = new THREE.Box3().setFromObject(vrm.scene);
    const size = box.getSize(new THREE.Vector3());
    const s = 1.5 / Math.max(size.y, 0.001);
    vrm.scene.scale.setScalar(s);
    box.setFromObject(vrm.scene);
    vrm.scene.position.y -= box.min.y;
    scene.add(vrm.scene);
    if (vrm.lookAt) vrm.lookAt.target = lookTarget;
    loaded = true;
    console.log('vrm loaded', size.y.toFixed(3));
  },
  undefined,
  (e) => console.error('vrm load error', e && e.message)
);

// ---------- 状态 ----------
const pet = {
  x: 300, y: 100, vx: 0, vy: 0, facing: 1,
  state: 'fall', stateT: 0, dragDX: 0, dragDY: 0,
  dizzyT: 0, bubbleT: 0, bubbleText: '', dragging: false,
  humT: 8, blinkT: 3, blink: 0, expr: 'neutral', exprT: 0,
};

let media = { playing: false, title: '', artist: '', app: '' };
const HUM = ['♪ 嗯～', '♪ 啦～啦～', '这首好听', '♪ 呜～'];
let mouse = { x: -9999, y: -9999 };
let lastHit = false;

function isListening() { return media.playing && !!media.title; }

// ---------- 初始化 ----------
async function init() {
  const info = await window.petAPI.screenInfo();
  DPR = window.devicePixelRatio || 1;
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  GROUND = info.workArea.y + info.workArea.height - info.bounds.y;

  pet.x = W * 0.5 - PET_W / 2;
  pet.y = GROUND - PET_H;
  pet.state = 'idle';

  try { media = await window.petAPI.getMedia(); } catch {}
  window.petAPI.onMedia((m) => {
    const was = isListening();
    media = m;
    if (isListening() && !was) { setExpr('happy', 2.5); say('♪ ' + (m.artist || m.title).slice(0, 8), 2); }
    if (!isListening() && was) { setExpr('neutral'); say('不听了？', 1.6); }
  });

  requestAnimationFrame(loop);
}

function setState(s) {
  if (pet.state === s) return;
  pet.state = s;
  pet.stateT = 0;
  if (s === 'dizzy') setExpr('surprised', 1.0);
}

function setExpr(name, secs) {
  pet.expr = name;
  pet.exprT = secs || 0;
}

function say(text, secs = 2.4) {
  pet.bubbleText = text;
  pet.bubbleT = secs;
}

// ---------- 物理 ----------
let last = performance.now();
function loop(now) {
  let dt = (now - last) / 1000;
  last = now;
  dt = Math.min(dt, 0.05);
  update(dt, now);
  draw(now);
  requestAnimationFrame(loop);
}

function update(dt, now) {
  pet.stateT += dt;
  if (pet.bubbleT > 0) pet.bubbleT -= dt;
  if (pet.exprT > 0) { pet.exprT -= dt; if (pet.exprT <= 0) pet.expr = 'neutral'; }

  if (isListening() && !pet.dragging && pet.bubbleT <= 0) {
    pet.humT -= dt;
    if (pet.humT <= 0) { say(HUM[Math.floor(Math.random() * HUM.length)], 2.0); pet.humT = 10 + Math.random() * 12; }
  }

  if (pet.dragging) {
    pet.x = mouse.x - pet.dragDX;
    pet.y = mouse.y - pet.dragDY;
    pet.vx = 0; pet.vy = 0;
    return;
  }

  pet.vy += GRAVITY * dt;
  pet.x += pet.vx * dt;
  pet.y += pet.vy * dt;

  const floor = GROUND - PET_H;
  if (pet.y >= floor) {
    const fell = pet.vy > 500;
    pet.y = floor; pet.vy = 0;
    if (pet.state === 'fall') {
      if (fell) { setState('dizzy'); pet.dizzyT = 0.9; say(['哎哟…', '摔、摔到了'][Math.floor(Math.random() * 2)], 1.4); }
      else setState('idle');
    }
  } else if (pet.state !== 'fall') setState('fall');

  if (pet.x < 0) { pet.x = 0; pet.vx = Math.abs(pet.vx); pet.facing = 1; }
  if (pet.x > W - PET_W) { pet.x = W - PET_W; pet.vx = -Math.abs(pet.vx); pet.facing = -1; }

  switch (pet.state) {
    case 'idle':
      pet.vx *= 0.9;
      if (!isListening() && pet.stateT > 2.5 + Math.random() * 2) { setState('walk'); pet.facing = Math.random() < 0.5 ? -1 : 1; }
      break;
    case 'walk':
      pet.vx = pet.facing * 52;
      if (pet.x <= 0) pet.facing = 1;
      if (pet.x >= W - PET_W) pet.facing = -1;
      if (pet.stateT > 2 + Math.random() * 2) setState('idle');
      break;
    case 'dizzy':
      pet.vx *= 0.85; pet.dizzyT -= dt;
      if (pet.dizzyT <= 0) setState('idle');
      break;
    case 'fall':
      pet.vx *= 0.995;
      break;
  }
}

// ---------- 表情 / 动画驱动 ----------
const EXPR_MAP = {
  neutral: [['happy', 0.12], ['relaxed', 0.15]],
  happy: [['happy', 0.9]],
  surprised: [['surprised', 0.9]],
  sad: [['sad', 0.8]],
  shy: [['happy', 0.5], ['relaxed', 0.4]],
};

function driveVRM(now, dt) {
  if (!vrm) return;
  const em = vrm.expressionManager;

  // 眨眼
  pet.blinkT -= dt;
  if (pet.blinkT <= 0) { pet.blink = 0.12; pet.blinkT = 2.2 + Math.random() * 3.5; }
  let blinkVal = 0;
  if (pet.blink > 0) {
    pet.blink -= dt;
    const p = Math.max(0, pet.blink / 0.12);
    blinkVal = Math.sin(p * Math.PI);
  }

  if (em) {
    em.setValue('blink', blinkVal);
    const target = EXPR_MAP[pet.expr] || EXPR_MAP.neutral;
    for (const [k, v] of target) em.setValue(k, v);
    // 其余表情归零
    for (const k of ['happy', 'relaxed', 'surprised', 'sad', 'angry', 'aa']) {
      if (!target.find((t) => t[0] === k)) em.setValue(k, 0);
    }
  }

  // 看向鼠标
  if (vrm.lookAt) {
    const nx = (mouse.x / Math.max(W, 1)) * 2 - 1;
    const ny = -((mouse.y / Math.max(H, 1)) * 2 - 1);
    lookTarget.position.set(nx * 1.2, 0.9 + ny * 0.5, 2.0);
  }

  // 呼吸 + 走路起伏
  const t = now / 1000;
  const breathe = Math.sin(t * 1.6) * 0.012;
  const sway = pet.state === 'idle' ? Math.sin(t * 0.7) * 0.03 : Math.sin(t * 6) * 0.05;
  vrm.scene.scale.y = vrm.scene.scale.x * (1 + breathe);
  vrm.scene.rotation.z = sway * 0.35;
  vrm.scene.rotation.y = pet.facing === 1 ? 0 : 0;

  const hips = vrm.humanoid && vrm.humanoid.getNormalizedBoneNode('hips');
  if (hips) hips.rotation.y += Math.sin(t * 0.9) * 0.004;

  vrm.update(dt);
}

// ---------- 绘制 ----------
function draw(now) {
  ctx.clearRect(0, 0, W, H);
  driveVRM(now, 1 / 60);
  if (loaded) {
    renderer.render(scene, camera);
    const bottom = pet.y + PET_H;
    const cx = pet.x + PET_W / 2;
    ctx.drawImage(renderer.domElement, cx - PET_W / 2, bottom - PET_H, PET_W, PET_H);
  } else {
    ctx.save();
    ctx.fillStyle = 'rgba(77,107,254,0.35)';
    ctx.beginPath();
    ctx.ellipse(pet.x + PET_W / 2, pet.y + PET_H - 4, PET_W * 0.3, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (pet.state === 'dizzy') {
    const bottom = pet.y + PET_H;
    const cx = pet.x + PET_W / 2;
    for (let i = 0; i < 3; i++) {
      const a = now / 260 + (i * Math.PI * 2) / 3;
      drawStar(cx + Math.cos(a) * PET_W * 0.28, bottom - PET_H * 0.8 + Math.sin(a) * 6, 6, '#FFD84D');
    }
  }
  if (pet.bubbleT > 0) drawBubble();
}

function drawStar(x, y, r, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
    const px = Math.cos(a) * r, py = Math.sin(a) * r;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath(); ctx.fill(); ctx.restore();
}

function drawBubble() {
  const text = pet.bubbleText;
  ctx.save();
  ctx.font = '500 12px "Microsoft YaHei UI", "Microsoft YaHei", sans-serif';
  const tw = ctx.measureText(text).width;
  const padX = 9, w = tw + padX * 2, h = 24, r = 10;
  const bx = Math.max(6, Math.min(W - w - 6, pet.x + PET_W / 2 - w / 2));
  const by = Math.max(6, pet.y - 6);
  ctx.globalAlpha = Math.min(1, pet.bubbleT * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.96)';
  ctx.strokeStyle = 'rgba(77,107,254,0.5)';
  ctx.lineWidth = 1.4;
  roundRect(bx, by, w, h, r); ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(pet.x + PET_W / 2 - 5, by + h - 1);
  ctx.lineTo(pet.x + PET_W / 2, by + h + 7);
  ctx.lineTo(pet.x + PET_W / 2 + 5, by + h - 1);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#16224A';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
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
  const pad = 8;
  const half = HIT_W / 2;
  const cx = pet.x + PET_W / 2;
  return mx >= cx - half - pad && mx <= cx + half + pad && my >= pet.y - pad && my <= pet.y + PET_H + pad;
}

window.addEventListener('mousemove', (e) => {
  mouse.x = e.clientX; mouse.y = e.clientY;
  if (pet.dragging) return;
  const inside = inPet(mouse.x, mouse.y);
  if (inside !== lastHit) {
    lastHit = inside;
    window.petAPI.setHit(inside);
    document.body.style.cursor = inside ? 'grab' : 'default';
    if (inside) setExpr('happy', 0.6);
  }
});

window.addEventListener('mousedown', (e) => {
  if (!inPet(e.clientX, e.clientY)) return;
  pet.dragging = true;
  pet.dragDX = e.clientX - pet.x;
  pet.dragDY = e.clientY - pet.y;
  setState('drag');
  setExpr('surprised', 2);
  document.body.style.cursor = 'grabbing';
  say(['哇啊——', '放我下来！', '我、我恐高…'][Math.floor(Math.random() * 3)], 2);
});

window.addEventListener('mouseup', () => {
  if (!pet.dragging) return;
  pet.dragging = false;
  pet.vy = 60;
  setState('fall');
  document.body.style.cursor = 'default';
});

window.addEventListener('dblclick', (e) => {
  if (!inPet(e.clientX, e.clientY)) return;
  say('噗——', 1.1);
  pet.vy = -560;
  pet.vx = (Math.random() - 0.5) * 180;
  setState('fall');
  setExpr('happy', 1.2);
});

window.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (inPet(e.clientX, e.clientY)) { say('我去游一会儿…', 1.5); setExpr('shy', 1.2); }
});

function zoomBy(step) {
  const oldBottom = pet.y + PET_H;
  PET_H = Math.max(MIN_H, Math.min(MAX_H, PET_H + step));
  PET_W = Math.round(PET_H * 0.62);
  HIT_W = Math.round(PET_W * 0.86);
  pet.y = Math.min(oldBottom - PET_H, GROUND - PET_H);
  try { localStorage.setItem('petH', String(PET_H)); } catch {}
  say(PET_H + 'px', 0.9);
}

window.addEventListener('wheel', (e) => {
  if (!inPet(e.clientX, e.clientY) && !e.ctrlKey) return;
  e.preventDefault();
  zoomBy(e.deltaY > 0 ? -12 : 12);
}, { passive: false });

init();
