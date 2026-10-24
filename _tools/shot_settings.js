const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const w = new BrowserWindow({
    width: 560, height: 660, show: true, backgroundColor: '#0f1526',
    webPreferences: { preload: path.join(__dirname, '..', 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  const errs = [];
  w.webContents.on('console-message', (_e, level, msg) => { if (level >= 2) errs.push(msg); });
  await w.loadFile(path.join(__dirname, '..', 'src', 'settings.html'));
  await new Promise((r) => setTimeout(r, 2500));
  const info = await w.webContents.executeJavaScript('({ hasApi: !!window.petAPI, opts: Array.from(document.querySelectorAll("#preset option")).map(o=>o.textContent) })');
  const img = await w.webContents.capturePage();
  fs.writeFileSync(path.join(__dirname, 'settings.png'), img.toPNG());
  console.log('INFO', JSON.stringify(info));
  console.log('ERRS', JSON.stringify(errs.slice(0, 5)));
  app.quit();
});
