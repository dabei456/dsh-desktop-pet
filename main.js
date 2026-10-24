// DeepSeek 桌宠 · 主进程
// 一块铺满整屏的透明窗口，宠物画在里面；鼠标默认穿透，指到宠物身上才接管。
function toolFile(name) {
  const p = require('path').join(__dirname, '_tools', name);
  return app.isPackaged ? p.replace(/app\.asar([\\/])/, 'app.asar.unpacked$1') : p;
}

const { app, BrowserWindow, screen, ipcMain, Tray, Menu, nativeImage, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const https = require('https');

// 歌词：网易云搜索 + 歌词接口
function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://music.163.com/',
      },
      timeout: 8000,
    }, (res) => {
      let b = '';
      res.setEncoding('utf8');
      res.on('data', (d) => { b += d; });
      res.on('end', () => {
        try { resolve(JSON.parse(b)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
  });
}

// 系统正在播的歌（Windows SMTC）：常驻一个 PowerShell 读，变了推给渲染层
let mediaProc = null;
let mediaState = { playing: false, title: '', artist: '', app: '' };
let lastTitle = '';
let lastTitleAt = 0;

function startMediaWatch() {
  const ps1 = toolFile('smtc.ps1');
  if (!fs.existsSync(ps1)) return;
  mediaProc = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1], {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'ignore'],
    env: cleanEnv(),
  });
  let buf = '';
  mediaProc.stdout.setEncoding('utf8');
  mediaProc.stdout.on('data', (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line.startsWith('{')) continue;
      try {
        const m = JSON.parse(line);
        if (m.title && m.title !== lastTitle) { lastTitle = m.title; lastTitleAt = Date.now(); }
  // 同一首歌挂着超过 8 分钟基本就是暂停/关了但 SMTC 没更新
  if (m.playing && m.title && Date.now() - lastTitleAt > 8 * 60 * 1000) m.playing = false;
  mediaState = { ...m, ts: Date.now() };
        if (win && !win.isDestroyed()) win.webContents.send('media-state', mediaState);
      } catch {}
    }
  });
  mediaProc.on('exit', () => setTimeout(startMediaWatch, 4000));
}

// 其它窗口的矩形：常驻 PowerShell 枚举，变了推给渲染层（用来「趴窗口边」）
let rectsProc = null;
function cleanEnv() {
  const e = {};
  const seen = new Set();
  for (const k of Object.keys(process.env)) {
    const lk = k.toLowerCase();
    if (seen.has(lk)) continue;
    seen.add(lk);
    e[k] = process.env[k];
  }
  return e;
}
let lastRects = [];

function startRectsWatch() {
  const ps1 = toolFile('win_rects.ps1');
  if (!fs.existsSync(ps1)) return;
  rectsProc = spawn(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1, '-IntervalMs', '250'],
    { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] , env: cleanEnv() }
  );
  let buf = '';
  rectsProc.stdout.setEncoding('utf8');
  rectsProc.stdout.on('data', (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line.startsWith('[') && !line.startsWith('{')) continue;
      try {
        const arr = JSON.parse(line);
        lastRects = Array.isArray(arr) ? arr : [arr];
        if (win && !win.isDestroyed()) win.webContents.send('rects', lastRects);
      } catch {}
    }
  });
  rectsProc.on('exit', () => setTimeout(startRectsWatch, 4000));
}

// 这台机器 GPU 偶发崩（旧项目也这么干），透明窗用软件渲染没问题
app.disableHardwareAcceleration();

let win = null;
let tray = null;
let trayTemplate = null;

// 单实例：重复启动就把已有的叫出来
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

function log(...a) {
  try {
    fs.appendFileSync(path.join(__dirname, 'pet.log'), new Date().toISOString() + ' ' + a.join(' ') + '\n');
  } catch {}
}

function createWindow() {
  const { bounds } = screen.getPrimaryDisplay();
  win = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    focusable: false,
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setIgnoreMouseEvents(true, { forward: true });
  win.loadFile(path.join(__dirname, 'src', 'index.html'));

  // 拖文件进来时不要让页面跳走
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // 渲染层的报错要能看见，不然白屏只能瞎猜
  win.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    log('renderer[' + level + ']', message, '@' + String(sourceId).split('/').pop() + ':' + line);
  });
  win.webContents.on('did-fail-load', (_e, code, desc) => log('did-fail-load', code, desc));
  win.webContents.on('render-process-gone', (_e, detail) => log('render-process-gone', JSON.stringify(detail)));
  win.webContents.on('preload-error', (_e, p, err) => log('preload-error', p, err && err.message));

  win.once('ready-to-show', () => {
    win.showInactive();
    win.moveTop();
    log('window shown', JSON.stringify(bounds));
    // 自查：把窗口内容截一张，确认真的画出来了
    setTimeout(async () => {
      try {
        const img = await win.webContents.capturePage();
        const dir = path.join(__dirname, '_tmp');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'capture.png'), img.toPNG());
        log('capture saved');
      } catch (e) {
        log('capture failed', e.message);
      }
    }, 3500);
  });

  // 置顶靠 alwaysOnTop level 就够；定时 moveTop 会让 DWM 反复重合成，容易掉帧，去掉
}

// 渲染层说「鼠标进/出宠物了」→ 切穿透
ipcMain.on('pet-hit', (_e, inside) => {
  if (!win) return;
  if (inside) win.setIgnoreMouseEvents(false);
  else win.setIgnoreMouseEvents(true, { forward: true });
});

// 聊天输入时临时允许窗口获得键盘焦点
let chatPinned = false;
ipcMain.on('pet-chat-focus', (_e, on) => {
  if (!win || win.isDestroyed()) return;
  chatPinned = !!on;
  if (on) {
    win.setFocusable(true);
    win.setIgnoreMouseEvents(false);
    win.focus();
  } else {
    win.setFocusable(false);
    win.setIgnoreMouseEvents(true, { forward: true });
  }
});

// 宠物屏幕矩形（渲染层上报）——用于拖文件时判断光标是否在它身上
let petRect = null;
ipcMain.on('pet-rect', (_e, r) => { petRect = r; });
let dragging = false;
let lastInside = null;
ipcMain.on('pet-drag', (_e, on) => { dragging = !!on; if (!on) lastInside = null; });

setInterval(() => {
  if (!win || win.isDestroyed() || !petRect || chatPinned || dragging) return;
  const p = screen.getCursorScreenPoint();
  const inside = p.x >= petRect.x - 6 && p.x <= petRect.x + petRect.w + 6 &&
                 p.y >= petRect.y - 6 && p.y <= petRect.y + petRect.h + 6;
  if (inside === lastInside) return;
  lastInside = inside;
  win.setIgnoreMouseEvents(!inside, { forward: true });
}, 120);

// 渲染层要屏幕信息
ipcMain.handle('screen-info', () => {
  const d = screen.getPrimaryDisplay();
  return { bounds: d.bounds, workArea: d.workArea, scale: d.scaleFactor };
});

ipcMain.handle('media-state', () => mediaState);

// 找歌词（网易云）：先搜歌，再取 LRC；有歌手就挑对得上的那条
ipcMain.handle('fetch-lyric', async (_e, title, artist) => {
  try {
    const q = ((title || '') + ' ' + (artist || '')).trim();
    const s = await httpGetJson('https://music.163.com/api/search/get?s=' + encodeURIComponent(q) + '&type=1&limit=8');
    const songs = (s && s.result && s.result.songs) || [];
    if (!songs.length) return null;

    const wantArtist = String(artist || '').toLowerCase();
    const wantTitle = String(title || '').toLowerCase();
    let pick = songs[0];
    let best = -1;
    for (const it of songs) {
      let sc = 0;
      const nm = String(it.name || '');
      const an = (it.artists || []).map((a) => String(a.name).toLowerCase()).join(' ');
      if (wantTitle && nm.trim().toLowerCase() === wantTitle) sc += 8;
      else if (wantTitle && nm.toLowerCase().includes(wantTitle)) sc += 4;
      if (wantArtist && an.includes(wantArtist)) sc += 3;
      if (/live|伴奏|cover|翻自|remix|dj|片段/i.test(nm)) sc -= 3;
      if (sc > best) { best = sc; pick = it; }
    }

    const l = await httpGetJson('https://music.163.com/api/song/lyric?id=' + pick.id + '&lv=1&kv=1&tv=-1');
    const lrc = l && l.lrc && l.lrc.lyric;
    return lrc || null;
  } catch {
    return null;
  }
});

// 渲染层要退出
ipcMain.handle('pick-file', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: '喂她一个文件',
    properties: ['openFile'],
  });
  if (r.canceled || !r.filePaths.length) return null;
  const fp = r.filePaths[0];
  try {
    const st = fs.statSync(fp);
    let text = '';
    if (st.size <= 20 * 1024 * 1024) {
      try {
        const buf = fs.readFileSync(fp);
        const str = buf.toString('utf8');
        const bad = (str.match(/\uFFFD/g) || []).length;
        if (str.length && bad / str.length < 0.05) text = str;
      } catch {}
    }
    return { name: path.basename(fp), size: st.size, text, path: fp };
  } catch (e) {
    return { name: path.basename(fp), size: 0, text: '', path: fp, error: String(e) };
  }
});

ipcMain.handle('trash-file', async (_e, p) => {
  try {
    if (!p || typeof p !== 'string') return false;
    await shell.trashItem(p);
    return true;
  } catch (e) {
    console.error('trash failed', e);
    return false;
  }
});

ipcMain.on('pet-quit', () => app.quit());


// ---------- 大模型对话（硅基流动） ----------
function readKey() {
  try { return fs.readFileSync(path.join(__dirname, '_key.txt'), 'utf8').trim(); } catch (e) { return ''; }
}

// CONFIG_JSON：apiKey / model / persona 都存在这里，设置窗口可改
const CONFIG_JSON = path.join(__dirname, 'config.json');
function loadCfg() { try { return JSON.parse(fs.readFileSync(CONFIG_JSON, 'utf8')); } catch (e) { return {}; } }
function saveCfg(c) { try { fs.writeFileSync(CONFIG_JSON, JSON.stringify(c, null, 2), 'utf8'); return true; } catch (e) { return false; } }

let settingsWin = null;
function openSettingsWindow() {
  if (settingsWin && !settingsWin.isDestroyed()) { settingsWin.show(); settingsWin.focus(); return true; }
  settingsWin = new BrowserWindow({
    width: 560, height: 640, resizable: true, title: '桌宠设置',
    backgroundColor: '#0f1526',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  settingsWin.loadFile(path.join(__dirname, 'src', 'settings.html'));
  settingsWin.on('closed', () => { settingsWin = null; });
  return true;
}
ipcMain.handle('get-settings', () => {
  const c = loadCfg();
  return {
    apiKey: c.apiKey || readKey(),
    model: c.model || 'deepseek-ai/DeepSeek-V4.1-Flash',
    persona: c.persona || '',
    personaName: c.personaName || '傲娇大小姐',
  };
});
ipcMain.handle('save-settings', (_e, cfg) => {
  const c = loadCfg();
  if (cfg && typeof cfg === 'object') {
    if (typeof cfg.apiKey === 'string') c.apiKey = cfg.apiKey.trim();
    if (typeof cfg.model === 'string') c.model = cfg.model.trim();
    if (typeof cfg.persona === 'string') c.persona = cfg.persona.trim();
    if (typeof cfg.personaName === 'string') c.personaName = cfg.personaName.trim();
  }
  return saveCfg(c);
});
ipcMain.handle('open-settings-page', () => openSettingsWindow());

ipcMain.handle('ask', async (_e, payload) => {
  const cfg0 = loadCfg();
  const key = cfg0.apiKey || readKey();
  if (!key || !payload || !Array.isArray(payload.messages)) return '';
  const body = JSON.stringify({
    model: payload.model || cfg0.model || 'deepseek-ai/DeepSeek-V4.1-Flash',
    messages: payload.messages,
    max_tokens: 48,
    temperature: 0.95,
    top_p: 0.9,
  });
  return await new Promise((res) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; res(v); } };
    const req = https.request({
      hostname: 'api.siliconflow.cn',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + key,
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 25000,
    }, (r) => {
      let d = '';
      r.on('data', (c) => { d += c; });
      r.on('end', () => {
        try {
          const j = JSON.parse(d);
          const t = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
          if (!t && typeof appLog === 'function') appLog('AI empty: ' + d.slice(0, 200));
          if (t && typeof appLog === 'function') appLog('AI say: ' + String(t).slice(0, 80));
          finish((t || '').trim());
        } catch (err) { finish(''); }
      });
    });
    req.on('error', () => finish(''));
    req.on('timeout', () => { req.destroy(); finish(''); });
    req.write(body);
    req.end();
  });
});


// 饿了就自己盛一碗"大白饭"（在桌面建个文件，然后被吃掉进回收站）
ipcMain.handle('make-snack', async () => {
  try {
    const dir = app.getPath('desktop');
    const name = '大白饭.txt';
    const fp = path.join(dir, name);
    const body = '（大肥鱼自己给自己盛的一碗）\n今天是 ' + new Date().toLocaleString('zh-CN') + '\n好好吃饭。\n';
    fs.writeFileSync(fp, body, 'utf8');
    return { name: name, path: fp, text: body, size: Buffer.byteLength(body) };
  } catch (e) {
    return null;
  }
});

let liveNeeds = { h: 0, m: 0 };
let lastTraySync = 0;
ipcMain.on('needs-report', (_e, d) => {
  liveNeeds = d || liveNeeds;
  if (!tray) return;
  try { tray.setToolTip('饱腹 ' + liveNeeds.h + '% · 心情 ' + liveNeeds.m + '%'); } catch (e) {}
  const now = Date.now();
  if (now - lastTraySync > 15000 && trayTemplate) {
    lastTraySync = now;
    try { tray.setContextMenu(trayTemplate()); } catch (e) {}
  }
});

app.whenReady().then(() => {
  createWindow();
  startMediaWatch();
  startRectsWatch();
  setTimeout(() => setupUpdater(), 12000);

  // 托盘：右键能退出（不然一个看不见的窗口很难关掉）
  try {
    const iconPath = path.join(__dirname, 'assets', 'icon.png');
    tray = new Tray(fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty());
    tray.setToolTip('DeepSeek 桌宠');
    trayTemplate = function () {
      return Menu.buildFromTemplate([
        {
          label: `饱腹 ${liveNeeds.h}% · 心情 ${liveNeeds.m}%`,
          enabled: false,
        },
        {
          label: '喂她一个文件（托盘）',
          click: async () => {
            const r = await dialog.showOpenDialog({
              title: '喂她一个文件',
              properties: ['openFile'],
            });
            if (r.canceled || !r.filePaths.length) return;
            const fp = r.filePaths[0];
            let text = '';
            let size = 0;
            try {
              const st = fs.statSync(fp);
              size = st.size;
              if (st.size <= 20 * 1024 * 1024) {
                const buf = fs.readFileSync(fp);
                const str = buf.toString('utf8');
                const bad = (str.match(/\uFFFD/g) || []).length;
                if (str.length && bad / str.length < 0.05) text = str;
              }
            } catch {}
            if (win && !win.isDestroyed()) {
              win.webContents.send('feed-from-main', { name: path.basename(fp), size, text, path: fp });
            }
          },
        },
        { label: '检查更新', click: () => checkUpdate(true) },
        { label: '设置（API / 人设）…', click: () => openSettingsWindow() },
        { label: '让她藏起来 / 出来', click: () => { if (!win) return; if (win.isVisible()) { win.hide(); } else { win.show(); win.setAlwaysOnTop(true, 'screen-saver'); } } },
        { label: '重画', click: () => win && win.reload() },
        { type: 'separator' },
        { label: '退出', click: () => app.quit() },
]);
    };
    tray.setContextMenu(trayTemplate());
    tray.on('right-click', () => { try { tray.popUpContextMenu(trayTemplate()); } catch (e) {} });
  } catch (e) {
    log('tray failed', e.message);
  }

  log('app ready');
});

app.on('window-all-closed', () => app.quit());


// ---------- 自动更新（electron-updater + GitHub Releases） ----------
let updater = null;
let checking = false;
function setupUpdater() {
  if (!app.isPackaged) return;
  try {
    const { autoUpdater } = require('electron-updater');
    updater = autoUpdater;
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on('error', (e) => { log('updater error ' + e.message); });
    autoUpdater.on('update-available', (i) => {
      log('update available ' + i.version);
      if (win && !win.isDestroyed()) win.webContents.send('feed-from-main', { name: '', size: 0, text: '', note: 'update-available', version: i.version });
    });
    autoUpdater.on('update-downloaded', (i) => {
      log('update downloaded ' + i.version);
      dialog.showMessageBox({
        type: 'info',
        title: '新版本下好了',
        message: '新版本 ' + i.version + ' 已经下载完，现在重启就换上？',
        buttons: ['现在重启', '下次再说'],
        defaultId: 0,
        cancelId: 1,
      }).then((r) => { if (r.response === 0) autoUpdater.quitAndInstall(); });
    });
    autoUpdater.checkForUpdates().catch((e) => log('check failed ' + e.message));
  } catch (e) {
    log('updater init failed ' + e.message);
  }
}
function checkUpdate(manual) {
  if (!app.isPackaged) {
    if (manual) dialog.showMessageBox({ type: 'info', title: '开发模式', message: '开发模式不检查更新，打包安装之后才有。' });
    return;
  }
  if (!updater) setupUpdater();
  if (!updater) return;
  if (checking) return;
  checking = true;
  updater.checkForUpdates().then((r) => {
    checking = false;
    if (manual && (!r || !r.updateInfo || r.updateInfo.version === app.getVersion())) {
      dialog.showMessageBox({ type: 'info', title: '已是最新', message: '当前版本 ' + app.getVersion() + '，已经是最新的了。' });
    }
  }).catch((e) => { checking = false; if (manual) dialog.showMessageBox({ type: 'error', title: '检查失败', message: String(e.message || e) }); });
}


// ---------- 读 DSH 会话记录（只看最后一条你说的话） ----------
function zstdAll(buf) {
  const zlib = require('zlib');
  const M = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);
  const parts = [];
  let i = 0;
  while (true) {
    const idx = buf.indexOf(M, i + 1);
    if (idx < 0) { parts.push(buf.subarray(i)); break; }
    parts.push(buf.subarray(i, idx));
    i = idx;
  }
  let out = '';
  for (const p of parts) { try { out += zlib.zstdDecompressSync(p).toString('utf8'); } catch (e) {} }
  return out;
}
function dshPickText(d) {
  if (!d) return '';
  let c = d.content ?? d.text ?? (d.message && d.message.content) ?? d.body;
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) return c.filter((x) => x && (x.type === 'text' || typeof x.text === 'string')).map((x) => x.text || '').join(' ').trim();
  if (c && typeof c === 'object' && typeof c.text === 'string') return c.text;
  return '';
}
function dshPeekRead() {
  try {
    const root = path.join(process.env.USERPROFILE || 'C:/Users/lin', '.dsh', 'sessions');
    let best = null;
    for (const d of fs.readdirSync(root)) {
      const dir = path.join(root, d);
      let st; try { st = fs.statSync(dir); } catch (e) { continue; }
      if (!st.isDirectory()) continue;
      for (const sd of fs.readdirSync(dir)) {
        const f = path.join(dir, sd, 'session.v4.jsonl.zstd');
        try { const t = fs.statSync(f).mtimeMs; if (!best || t > best.t) best = { t, f }; } catch (e) {}
      }
    }
    if (!best || Date.now() - best.t > 15 * 60 * 1000) return null;
    const raw = zstdAll(fs.readFileSync(best.f));
    const lines = raw.split('\n');
    for (let i = lines.length - 1; i >= 0 && i > lines.length - 3000; i--) {
      if (!lines[i]) continue;
      let o; try { o = JSON.parse(lines[i]); } catch (e) { continue; }
      if (o.type !== 'user/message') continue;
      const t = dshPickText(o.data);
      if (t && t.trim().length > 1) return { text: t.trim().slice(0, 400), t: o.time || best.t };
    }
  } catch (e) { log('dsh peek failed ' + e.message); }
  return null;
}
ipcMain.handle('dsh-peek', () => dshPeekRead());
