const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 420,
    height: 620,
    show: false,
    transparent: true,
    frame: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true, offscreen: false },
  });
  win.webContents.on('console-message', (_e, _l, message) => {
    console.log('[page]', message);
    if (String(message).startsWith('FATAL')) {
      setTimeout(() => app.quit(), 300);
    }
  });
  try {
    await win.loadFile(path.join(__dirname, '..', 'src', 'test_live2d.html'));
    await new Promise((r) => setTimeout(r, 8000));
    const img = await win.webContents.capturePage();
    const out = path.join(__dirname, '..', '_tmp', 'live2d_test.png');
    fs.writeFileSync(out, img.toPNG());
    console.log('captured ' + out);
  } catch (e) {
    console.log('MAIN ERR ' + e.message);
  }
  app.quit();
});
