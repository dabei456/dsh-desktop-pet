const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 2560,
    height: 1100,
    useContentSize: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.webContents.on('console-message', (_e, level, msg) => console.log('[renderer]', msg));
  await win.loadFile(path.join(__dirname, '..', 'src', 'preview_models.html'));

  for (let i = 0; i < 90; i++) {
    const done = await win.webContents.executeJavaScript('!!window.__done');
    if (done) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  await new Promise((r) => setTimeout(r, 3500));
  const img = await win.capturePage();
  const out = path.join(__dirname, '..', '_tmp', 'models_preview.png');
  fs.writeFileSync(out, img.toPNG());
  console.log('saved', out, img.getSize().width, img.getSize().height);
  app.quit();
});

setTimeout(() => { console.log('timeout'); app.quit(); }, 120000);
