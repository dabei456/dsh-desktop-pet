const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petAPI', {
  setHit: (inside) => ipcRenderer.send('pet-hit', inside),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (c) => ipcRenderer.invoke('save-settings', c),
  openSettings: () => ipcRenderer.invoke('open-settings-page'),
  chatFocus: (on) => ipcRenderer.send('pet-chat-focus', on),
  petRect: (r) => ipcRenderer.send('pet-rect', r),
  dragState: (on) => ipcRenderer.send('pet-drag', !!on),
  makeSnack: () => ipcRenderer.invoke('make-snack'),
  pickFile: () => ipcRenderer.invoke('pick-file'),
  trash: (p) => ipcRenderer.invoke('trash-file', p),
  pathOf: (f) => { try { return require('electron').webUtils.getPathForFile(f); } catch { return ''; } },
  screenInfo: () => ipcRenderer.invoke('screen-info'),
  getMedia: () => ipcRenderer.invoke('media-state'),
  ask: (p) => ipcRenderer.invoke('ask', p),
  fetchLyric: (title, artist) => ipcRenderer.invoke('fetch-lyric', title, artist),
  onMedia: (cb) => ipcRenderer.on('media-state', (_e, m) => cb(m)),
  onRects: (cb) => ipcRenderer.on('rects', (_e, r) => cb(r)),
  onFeed: (cb) => ipcRenderer.on('feed-from-main', (_e, f) => cb(f)),
  quit: () => ipcRenderer.send('pet-quit'),
});
