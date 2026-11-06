// Müziğim masaüstü uygulaması: sunucuyu içinde başlatır, sistem tepsisinde yaşar, genel kısayollar sunar.
const { app, BrowserWindow, Tray, Menu, globalShortcut, nativeImage, shell, dialog } = require('electron');
const path = require('path'), http = require('http');
const PORT = +process.env.MUZIGIM_PORT || 38123, REMOTE = process.env.MUZIGIM_URL; // MUZIGIM_URL: başka bir sunucuya bağlan
const BASE = REMOTE || `http://localhost:${PORT}`, ICON = path.join(__dirname, 'icon.png');
let win, tray, quitting = false;
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.exit(0); // zaten açıksa ikinci kopya hemen kapanır (sunucuyu tekrar başlatmaz)

const run = js => win && !win.isDestroyed() && win.webContents.executeJavaScript(js, true).catch(() => {});
const showMain = () => { if (!win) return; win.show(); win.focus(); };

function startServer() {
  if (REMOTE) return Promise.resolve();
  process.env.PORT = String(PORT);
  process.env.DATA_DIR = path.join(app.getPath('userData'), 'data'); // veriler kullanıcı klasöründe kalır
  require('../server/index.js');
  return new Promise((ok, no) => {
    const t0 = Date.now(), ping = () => http.get(BASE + '/api/me', r => { r.resume(); ok(); })
      .on('error', () => Date.now() - t0 > 10000 ? no(new Error('Sunucu başlatılamadı (port ' + PORT + ' dolu olabilir)')) : setTimeout(ping, 200));
    ping();
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 820, minWidth: 900, minHeight: 600, backgroundColor: '#111', autoHideMenuBar: true, icon: ICON,
    webPreferences: { backgroundThrottling: false, autoplayPolicy: 'no-user-gesture-required', contextIsolation: true }
  });
  win.loadURL(BASE);
  win.on('close', e => { if (!quitting) { e.preventDefault(); win.hide(); } }); // kapatınca tepsiye iner, müzik sürer
  win.webContents.setWindowOpenHandler(({ url, frameName }) => {
    if (frameName === 'muzigim-mini') return { action: 'allow', overrideBrowserWindowOptions: {
      width: 360, height: 160, frame: false, alwaysOnTop: true, skipTaskbar: true, autoHideMenuBar: true, backgroundColor: '#1c1c1e', title: 'Müziğim' } };
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('did-create-window', w => { // mini pencere oyunların/uygulamaların üstünde kalsın
    w.setAlwaysOnTop(true, 'screen-saver'); w.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  });
}

function createTray() {
  tray = new Tray(nativeImage.createFromPath(ICON).resize({ width: 18, height: 18 }));
  tray.setToolTip('Müziğim');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Müziğim’i göster', click: showMain },
    { label: 'Mini oynatıcı (Ctrl+Alt+M)', click: () => run('openMini()') },
    { type: 'separator' }, { label: 'Çık', click: () => app.quit() }]));
  tray.on('click', showMain);
}

const SHORTCUTS = {
  'CommandOrControl+Alt+M': 'openMini()',                                // mini oynatıcıyı aç/kapat
  'CommandOrControl+Alt+Space': "document.querySelector('#pp').click()", // oynat/duraklat
  'CommandOrControl+Alt+Right': "document.querySelector('#nx').click()", // sonraki
  'CommandOrControl+Alt+Left': "document.querySelector('#pv').click()"   // önceki
};

app.on('second-instance', showMain);
app.on('before-quit', () => { quitting = true; });
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => {}); // tepsi sayesinde uygulama açık kalır
app.on('activate', showMain);
if (gotLock) app.whenReady().then(async () => {
  await startServer(); createWindow(); createTray();
  for (const [k, js] of Object.entries(SHORTCUTS)) globalShortcut.register(k, () => run(js));
}).catch(e => { dialog.showErrorBox('Müziğim başlatılamadı', String(e.message || e)); app.quit(); });
