// Yoni masaüstü uygulaması: sunucuyu içinde başlatır, sistem tepsisinde yaşar, genel kısayollar sunar.
const { app, BrowserWindow, Tray, Menu, globalShortcut, nativeImage, shell, dialog, net } = require('electron');
const path = require('path'), http = require('http');
const PORT = +process.env.MUZIGIM_PORT || 38123, REMOTE = process.env.MUZIGIM_URL; // MUZIGIM_URL: başka bir sunucuya bağlan
const BASE = REMOTE || `http://localhost:${PORT}`, ICON = path.join(__dirname, 'icon.png');
let win, tray, quitting = false, manualCheck = false;
let autoUpdater = null; // yalnızca kurulu (paketlenmiş) uygulamada çalışır; geliştirmede (npm run app) devre dışı
if (app.isPackaged) { try { ({ autoUpdater } = require('electron-updater')); } catch (e) { console.error('Güncelleyici yüklenemedi:', e.message); } }
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

// Uygulamada seçilen logo (sayfanın favicon'u) pencere/görev çubuğu ve tepsi simgesine de uygulanır
function applyAppIcon(url) {
  net.fetch(url).then(r => r.ok ? r.arrayBuffer() : null).then(b => {
    if (!b) return;
    const img = nativeImage.createFromBuffer(Buffer.from(b));
    if (img.isEmpty()) return;
    if (win && !win.isDestroyed()) win.setIcon(img);
    if (tray && !tray.isDestroyed()) tray.setImage(img.resize({ width: 18, height: 18 }));
  }).catch(() => {});
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 820, minWidth: 900, minHeight: 600, backgroundColor: '#111', autoHideMenuBar: true, icon: ICON,
    webPreferences: { backgroundThrottling: false, autoplayPolicy: 'no-user-gesture-required', contextIsolation: true }
  });
  win.webContents.on('page-favicon-updated', (_e, favs) => { if (favs && favs[0]) applyAppIcon(favs[0]); });
  win.loadURL(BASE);
  win.on('close', e => { if (!quitting) { e.preventDefault(); win.hide(); } }); // kapatınca tepsiye iner, müzik sürer
  win.webContents.setWindowOpenHandler(({ url, frameName }) => {
    if (frameName === 'muzigim-mini') return { action: 'allow', overrideBrowserWindowOptions: {
      width: 360, height: 160, frame: false, alwaysOnTop: true, skipTaskbar: true, autoHideMenuBar: true, backgroundColor: '#1c1c1e', title: 'Yoni' } };
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('did-create-window', w => { // mini pencere oyunların/uygulamaların üstünde kalsın
    w.setAlwaysOnTop(true, 'screen-saver'); w.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  });
}

function createTray() {
  tray = new Tray(nativeImage.createFromPath(ICON).resize({ width: 18, height: 18 }));
  tray.setToolTip('Yoni');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Yoni’yi göster', click: showMain },
    { label: 'Mini oynatıcı (Ctrl+Alt+M)', click: () => run('openMini()') },
    { label: 'Güncellemeleri denetle', click: () => checkUpdates(true) },
    { type: 'separator' }, { label: 'Çık', click: () => app.quit() }]));
  tray.on('click', showMain);
}

// --- Otomatik güncelleme: GitHub Releases'e bakar, yeni sürümü indirir, kullanıcıya sorar ---
function checkUpdates(manual) {
  if (!autoUpdater) { if (manual) dialog.showMessageBox({ message: 'Güncelleme yalnızca kurulu uygulamada çalışır.' }); return; }
  manualCheck = !!manual;
  autoUpdater.checkForUpdates().catch(e => { if (manual) dialog.showErrorBox('Güncelleme denetlenemedi', String(e.message || e)); });
}
function setupUpdater() {
  if (!autoUpdater) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true; // sorulmasa bile çıkarken kurulur
  autoUpdater.on('update-available', i => { if (manualCheck) dialog.showMessageBox({ message: `Yeni sürüm bulundu (${i.version}), indiriliyor…` }); });
  autoUpdater.on('update-not-available', () => { if (manualCheck) dialog.showMessageBox({ message: 'Yoni güncel (' + app.getVersion() + ').' }); manualCheck = false; });
  autoUpdater.on('error', e => { console.error('Güncelleme hatası:', e && e.message); });
  autoUpdater.on('update-downloaded', i => {
    dialog.showMessageBox({ type: 'info', buttons: ['Şimdi yeniden başlat', 'Sonra'], defaultId: 0, cancelId: 1,
      title: 'Güncelleme hazır', message: `Yoni ${i.version} indirildi.`, detail: 'Yeniden başlatınca kurulur.' })
      .then(r => { if (r.response === 0) { quitting = true; autoUpdater.quitAndInstall(); } });
  });
  setTimeout(() => checkUpdates(false), 5000);            // açılıştan kısa süre sonra
  setInterval(() => checkUpdates(false), 6 * 3600 * 1000); // ve her 6 saatte bir
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
  await startServer(); createWindow(); createTray(); setupUpdater();
  for (const [k, js] of Object.entries(SHORTCUTS)) globalShortcut.register(k, () => run(js));
}).catch(e => { dialog.showErrorBox('Yoni başlatılamadı', String(e.message || e)); app.quit(); });
