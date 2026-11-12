// Yoni sunucusu: hesaplar, profiller, arkadaşlar, mesajlar (WebSocket ile anlık). Bağımlılık: express + ws
const express = require('express'), http = require('http'), path = require('path'), fs = require('fs'), os = require('os'), crypto = require('crypto');
const { WebSocketServer } = require('ws');
const PORT = +process.env.PORT || 3000;
const DATA = process.env.DATA_DIR || path.join(__dirname, '..', 'data'), UP = path.join(DATA, 'uploads');
fs.mkdirSync(UP, { recursive: true });

// ---- Küçük JSON veritabanı (bellekte, gecikmeli + atomik yazım)
const DBF = path.join(DATA, 'db.json');
let db = { users: {}, sessions: {}, friends: {}, msgs: {}, reads: {}, seq: 1 };
try { db = { ...db, ...JSON.parse(fs.readFileSync(DBF, 'utf8')) }; } catch {}
for (const [t, s] of Object.entries(db.sessions)) if (s.exp < Date.now()) delete db.sessions[t];
let tm = null;
const flush = () => { clearTimeout(tm); tm = null; const f = DBF + '.tmp'; fs.writeFileSync(f, JSON.stringify(db)); fs.renameSync(f, DBF); };
const save = () => { if (!tm) tm = setTimeout(flush, 400); };
['SIGINT', 'SIGTERM'].forEach(s => process.on(s, () => { flush(); process.exit(0); }));

// ---- Yardımcılar
const HEX = /^#[0-9a-fA-F]{6}$/, pk = (a, b) => [a, b].sort().join('|');
const S = (v, n) => typeof v == 'string' ? v.slice(0, n) : '';
const num = (v, a, b, d) => Number.isFinite(+v) ? Math.min(b, Math.max(a, +v)) : d;
const hash = (pw, salt) => new Promise((ok, no) => crypto.scrypt(pw, salt, 64, (e, k) => e ? no(e) : ok(k.toString('hex'))));
const conns = new Map();
const push = (u, o) => conns.get(u)?.forEach(w => w.readyState == 1 && w.send(JSON.stringify(o)));
const pub = u => ({ username: u.username, display: u.display, bio: u.bio, status: u.status, color: u.color,
  avatar: u.avatar ? `/uploads/${u.avatar}?v=${u.av}` : '', banner: u.banner ? `/uploads/${u.banner}?v=${u.bv}` : '',
  created: u.created, online: conns.has(u.username), np: conns.has(u.username) ? u.np || null : null });
const me = u => ({ ...pub(u), theme: u.theme || null });
const isFriend = (a, b) => db.friends[pk(a, b)]?.status == 'friends';
const notify = un => { for (const r of Object.values(db.friends)) if (r.status == 'friends' && r.u.includes(un)) push(r.u.find(x => x != un), { type: 'presence', u: pub(db.users[un]) }); };
const hits = new Map();
const limit = (k, max, ms) => { const n = Date.now(), h = (hits.get(k) || []).filter(t => n - t < ms); h.push(n); hits.set(k, h); return h.length > max; };
setInterval(() => hits.clear(), 600000).unref();
const cookie = r => Object.fromEntries((r.headers.cookie || '').split(';').map(c => c.trim().split('=')).filter(x => x[0]).map(([k, ...v]) => [k, v.join('=')]));
const userOf = r => { const s = db.sessions[cookie(r).sid]; return s && s.exp > Date.now() ? db.users[s.u] : null; };
const auth = (q, s, n) => { q.me = userOf(q); q.me ? n() : s.status(401).json({ error: 'Giriş gerekli' }); };
const startSession = (q, s, u) => {
  const t = crypto.randomBytes(32).toString('hex');
  db.sessions[t] = { u: u.username, exp: Date.now() + 30 * 864e5 }; save();
  const sec = q.secure || q.headers['x-forwarded-proto'] == 'https' ? '; Secure' : '';
  s.setHeader('Set-Cookie', `sid=${t}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${30 * 86400}${sec}`);
};
const theme = t => {
  if (t === null) return null; if (typeof t != 'object') throw new Error('Geçersiz tema');
  const o = {}; for (const k of ['a', 'c', 's', 'x']) if (HEX.test(t[k])) o[k] = t[k];
  o.r = num(t.r, 0, 28, 12); o.fs = num(t.fs, 13, 19, 15); o.dim = num(t.dim, 0, 80, 30); o.op = num(t.op, 30, 100, 80); o.bl = num(t.bl, 0, 20, 0);
  o.m = ['image', 'video'].includes(t.m) ? t.m : ''; o.p = !!t.p; o.lg = typeof t.lg == 'string' && /^[a-z0-9-]{1,30}$/.test(t.lg) ? t.lg : 'varsayilan';
  o.kd = t.kd !== false; o.kl = Array.isArray(t.kl) ? [...new Set(t.kl.filter(x => typeof x == 'string' && /^[a-z]{2,12}$/.test(x)))].slice(0, 3) : ['zencefil']; return o;
};
const img = (u, k, d) => {
  const v = k == 'avatar' ? 'av' : 'bv';
  if (d === '') { if (u[k]) fs.rmSync(path.join(UP, u[k]), { force: true }); u[k] = ''; return; }
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(typeof d == 'string' ? d : '');
  if (!m) throw new Error('Geçersiz görsel');
  const b = Buffer.from(m[2], 'base64'); if (b.length > 300e3) throw new Error('Görsel çok büyük (en fazla 300 KB)');
  const f = `${k}-${u.username}.${m[1] == 'jpeg' ? 'jpg' : m[1]}`;
  if (u[k] && u[k] != f) fs.rmSync(path.join(UP, u[k]), { force: true });
  fs.writeFileSync(path.join(UP, f), b); u[k] = f; u[v] = Date.now();
};
const att = a => { // yalnızca doğrulanmış şarkı eki
  const t = a && a.type == 'track' && a.track; if (!t) return null;
  const ok = v => !v || /^https:\/\//.test(v), aid = String(t.aid || '');
  if (!ok(t.art) || !ok(t.url) || !/^[A-Za-z0-9]{0,40}$/.test(aid) || (!t.url && !aid)) return null;
  return { type: 'track', track: { id: S(t.id, 200), title: S(t.title, 150), artist: S(t.artist, 100), art: S(t.art, 400), url: S(t.url, 600), aid, src: S(t.src, 20) } };
};

// ---- Uygulama
const app = express(); app.disable('x-powered-by'); if (process.env.TRUST_PROXY) app.set('trust proxy', 1);
app.use(express.json({ limit: '450kb' }));
app.use((q, s, n) => { s.setHeader('X-Content-Type-Options', 'nosniff'); n(); });

app.post('/api/register', async (q, s) => {
  if (limit('r' + q.ip, 10, 6e4)) return s.status(429).json({ error: 'Çok fazla deneme, biraz bekle' });
  const un = S(q.body.username, 20).toLowerCase(), pw = S(q.body.password, 100);
  if (!/^[a-z0-9_]{3,20}$/.test(un)) return s.status(400).json({ error: 'Kullanıcı adı: 3-20 karakter; harf, rakam veya _' });
  if (pw.length < 6) return s.status(400).json({ error: 'Şifre en az 6 karakter olmalı' });
  if (db.users[un]) return s.status(409).json({ error: 'Bu kullanıcı adı alınmış' });
  const salt = crypto.randomBytes(16).toString('hex'), h = await hash(pw, salt);
  if (db.users[un]) return s.status(409).json({ error: 'Bu kullanıcı adı alınmış' });
  const u = db.users[un] = { username: un, display: un, hash: h, salt, bio: '', status: '', color: '#1db6a0', avatar: '', banner: '', av: 0, bv: 0, theme: null, created: Date.now() };
  startSession(q, s, u); s.json({ user: me(u) });
});
app.post('/api/login', async (q, s) => {
  if (limit('l' + q.ip, 10, 6e4)) return s.status(429).json({ error: 'Çok fazla deneme, biraz bekle' });
  const u = db.users[S(q.body.username, 20).toLowerCase()], h = await hash(S(q.body.password, 100), u ? u.salt : '0'.repeat(32));
  if (!u || !crypto.timingSafeEqual(Buffer.from(h), Buffer.from(u.hash))) return s.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı' });
  startSession(q, s, u); s.json({ user: me(u) });
});
app.post('/api/logout', (q, s) => { delete db.sessions[cookie(q).sid]; save(); s.setHeader('Set-Cookie', 'sid=; Path=/; Max-Age=0'); s.json({ ok: 1 }); });
app.get('/api/me', auth, (q, s) => s.json({ user: me(q.me) }));
app.patch('/api/me', auth, (q, s) => {
  try {
    const u = q.me, b = q.body;
    if ('display' in b) { const d = S(b.display, 30).trim(); if (!d) throw new Error('Görünen ad boş olamaz'); u.display = d; }
    if ('bio' in b) u.bio = S(b.bio, 300);
    if ('status' in b) u.status = S(b.status, 60);
    if ('color' in b) { if (!HEX.test(b.color)) throw new Error('Geçersiz renk'); u.color = b.color; }
    if ('theme' in b) u.theme = theme(b.theme);
    if ('avatar' in b) img(u, 'avatar', b.avatar);
    if ('banner' in b) img(u, 'banner', b.banner);
    save(); notify(u.username); s.json({ user: me(u) });
  } catch (e) { s.status(400).json({ error: e.message }); }
});
// Hareketli profil fotoğrafı (GIF / hareketli WebP) ve videolu kapak (MP4 / WebM): ham dosya yüklenir, tür sihirli baytlardan doğrulanır
const kind = b => {
  if (b.length < 12) return null;
  if (b.toString('latin1', 0, 4) == 'GIF8') return ['gif', 'image'];
  if (b[0] == 0x89 && b.toString('latin1', 1, 4) == 'PNG') return ['png', 'image'];
  if (b[0] == 0xff && b[1] == 0xd8 && b[2] == 0xff) return ['jpg', 'image'];
  if (b.toString('latin1', 0, 4) == 'RIFF' && b.toString('latin1', 8, 12) == 'WEBP') return ['webp', 'image'];
  if (b.toString('latin1', 4, 8) == 'ftyp') return ['mp4', 'video'];
  if (b[0] == 0x1a && b[1] == 0x45 && b[2] == 0xdf && b[3] == 0xa3) return ['webm', 'video'];
  return null;
};
const MAXB = { avatar: { image: 1.5e6, video: 0 }, banner: { image: 3e6, video: 6e6 } };
app.put('/api/me/media/:kind', auth, (q, s, n) => {
  if (!MAXB[q.params.kind]) return s.status(404).json({ error: 'Bulunamadı' });
  if (limit('u' + q.ip, 12, 6e4)) return s.status(429).json({ error: 'Çok fazla yükleme, biraz bekle' });
  n();
}, express.raw({ type: () => true, limit: '6mb' }), (q, s) => {
  try {
    const k = q.params.kind, u = q.me, b = Buffer.isBuffer(q.body) ? q.body : Buffer.alloc(0), t = kind(b);
    if (!t) throw new Error('Desteklenmeyen dosya (JPG, PNG, GIF, WebP' + (k == 'banner' ? ', MP4, WebM' : '') + ')');
    const max = MAXB[k][t[1]]; if (!max) throw new Error('Profil fotoğrafı için video yerine GIF veya hareketli WebP kullan');
    if (b.length > max) throw new Error(`Dosya çok büyük (en fazla ${(max / 1e6).toFixed(1).replace('.', ',')} MB)`);
    const f = `${k}-${u.username}.${t[0]}`, v = k == 'avatar' ? 'av' : 'bv';
    if (u[k] && u[k] != f) fs.rmSync(path.join(UP, u[k]), { force: true });
    fs.writeFileSync(path.join(UP, f), b); u[k] = f; u[v] = Date.now();
    save(); notify(u.username); s.json({ user: me(u) });
  } catch (e) { s.status(400).json({ error: e.message }); }
});
// ---- YouTube hesabını bağlama (Google OAuth, PKCE). Jetonlar sunucuda saklanmaz; yalnızca isteyen cihaza bir kez teslim edilir.
const GCFG = (() => { let f = {}; try { f = require('./google.json'); } catch {} return { cid: process.env.GOOGLE_CLIENT_ID || f.cid || '', sec: process.env.GOOGLE_CLIENT_SECRET || f.sec || '' }; })();
const ytp = new Map();
app.get('/api/yt/config', (q, s) => s.json({ ready: !!GCFG.cid }));
setInterval(() => { const n = Date.now(); for (const [k, v] of ytp) if (v.exp < n) ytp.delete(k); }, 6e4).unref();
const ytPage = (s, ok, msg) => s.type('html').send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Yoni</title><body style="font:16px system-ui;background:#111;color:#f2f2f2;display:grid;place-items:center;height:100vh;margin:0;text-align:center"><div><div style="font-size:48px">${ok ? '✅' : '⚠️'}</div><p>${msg}</p></div>`);
const gtoken = async o => { const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(o) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error_description || j.error || 'Google hatası'); return j; };
app.post('/api/yt/start', (q, s) => {
  if (limit('ys' + q.ip, 10, 6e4)) return s.status(429).json({ error: 'Çok fazla deneme, biraz bekle' });
  const own = S(q.body.cid, 200).trim(), cid = own || GCFG.cid, sec = own ? S(q.body.sec, 200).trim() : GCFG.sec, ru = S(q.body.ru, 300);
  if (!/^[\w.-]+\.apps\.googleusercontent\.com$/.test(cid)) return s.status(400).json({ error: 'Geçersiz Client ID' });
  if (!/^https?:\/\/[\w.-]+(:\d+)?\/api\/yt\/callback$/.test(ru)) return s.status(400).json({ error: 'Geçersiz yönlendirme adresi' });
  const state = crypto.randomBytes(24).toString('hex'), ver = crypto.randomBytes(32).toString('base64url');
  ytp.set(state, { cid, sec, ver, ru, exp: Date.now() + 6e5 });
  const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({ client_id: cid, redirect_uri: ru, response_type: 'code', scope: 'https://www.googleapis.com/auth/youtube.readonly', access_type: 'offline', prompt: 'consent', state, code_challenge: crypto.createHash('sha256').update(ver).digest('base64url'), code_challenge_method: 'S256' });
  s.json({ url, state });
});
app.get('/api/yt/callback', async (q, s) => {
  const p = ytp.get(String(q.query.state || ''));
  if (!p) return ytPage(s, false, 'Bu bağlantının süresi dolmuş. Uygulamadan tekrar dene.');
  if (q.query.error || !q.query.code) { p.err = 'Google izni verilmedi'; return ytPage(s, false, 'İzin verilmedi. Uygulamaya dönüp tekrar deneyebilirsin.'); }
  try {
    const j = await gtoken({ code: String(q.query.code), client_id: p.cid, ...(p.sec ? { client_secret: p.sec } : {}), redirect_uri: p.ru, grant_type: 'authorization_code', code_verifier: p.ver });
    p.tokens = { access_token: j.access_token, refresh_token: j.refresh_token || '', expires_in: j.expires_in || 3600 };
    ytPage(s, true, 'YouTube hesabın bağlandı. Bu sekmeyi kapatıp Yoni\'ye dönebilirsin.');
  } catch (e) { p.err = e.message; ytPage(s, false, 'Bağlanamadı. Uygulamaya dönüp hata mesajına bak.'); }
});
app.post('/api/yt/poll', (q, s) => {
  const st = String(q.body.state || ''), p = ytp.get(st);
  if (!p) return s.status(404).json({ error: 'Süre doldu, tekrar dene' });
  if (p.err) { ytp.delete(st); return s.status(400).json({ error: p.err }); }
  if (!p.tokens) return s.json({ wait: true });
  ytp.delete(st); s.json(p.tokens);
});
app.post('/api/yt/refresh', async (q, s) => {
  if (limit('yr' + q.ip, 30, 6e4)) return s.status(429).json({ error: 'Çok fazla deneme' });
  try {
    const own = S(q.body.cid, 200), j = await gtoken({ client_id: own || GCFG.cid, ...((own ? q.body.sec : GCFG.sec) ? { client_secret: own ? S(q.body.sec, 200) : GCFG.sec } : {}), refresh_token: S(q.body.rt, 500), grant_type: 'refresh_token' });
    s.json({ access_token: j.access_token, expires_in: j.expires_in || 3600 });
  } catch (e) { s.status(400).json({ error: e.message }); }
});
app.get('/api/users', auth, (q, s) => {
  const t = S(q.query.q, 20).toLowerCase(); if (!t) return s.json({ users: [] });
  s.json({ users: Object.values(db.users).filter(u => u.username.startsWith(t) && u != q.me).slice(0, 8).map(pub) });
});
app.get('/api/users/:u', auth, (q, s) => { const u = db.users[q.params.u.toLowerCase()]; u ? s.json({ user: pub(u) }) : s.status(404).json({ error: 'Kullanıcı bulunamadı' }); });

app.get('/api/friends', auth, (q, s) => {
  const m = q.me.username, f = [], inc = [], out = [];
  for (const r of Object.values(db.friends)) {
    if (!r.u.includes(m)) continue; const o = db.users[r.u.find(x => x != m)]; if (!o) continue;
    r.status == 'friends' ? f.push(pub(o)) : (r.from == m ? out : inc).push(pub(o));
  }
  s.json({ friends: f, incoming: inc, outgoing: out });
});
app.post('/api/friends', auth, (q, s) => { // istek gönder; karşı taraf zaten istemişse kabul et
  const m = q.me.username, o = S(q.body.username, 20).toLowerCase();
  if (!db.users[o] || o == m) return s.status(404).json({ error: 'Kullanıcı bulunamadı' });
  const k = pk(m, o), r = db.friends[k];
  if (!r) db.friends[k] = { u: [m, o], from: m, status: 'pending' }; else if (r.status == 'pending' && r.from == o) r.status = 'friends';
  save(); push(o, { type: 'friend' }); push(m, { type: 'friend' }); s.json({ ok: 1 });
});
app.delete('/api/friends/:u', auth, (q, s) => { const o = q.params.u.toLowerCase(); delete db.friends[pk(q.me.username, o)]; save(); push(o, { type: 'friend' }); push(q.me.username, { type: 'friend' }); s.json({ ok: 1 }); });

app.get('/api/messages/:u', auth, (q, s) => {
  const m = q.me.username, o = q.params.u.toLowerCase();
  if (!isFriend(m, o)) return s.status(403).json({ error: 'Yalnızca arkadaşlarınla yazışabilirsin' });
  const l = db.msgs[pk(m, o)] || [], b = +q.query.before || Infinity;
  if (l.length) { db.reads[m + '|' + o] = l[l.length - 1].id; save(); }
  s.json({ messages: l.filter(x => x.id < b).slice(-50) });
});
app.post('/api/messages/:u', auth, (q, s) => {
  const m = q.me.username, o = q.params.u.toLowerCase();
  if (!isFriend(m, o)) return s.status(403).json({ error: 'Yalnızca arkadaşlarınla yazışabilirsin' });
  if (limit('m' + m, 60, 6e4)) return s.status(429).json({ error: 'Çok hızlı yazıyorsun' });
  const text = S(q.body.text, 2000).trim(), a = att(q.body.att);
  if (!text && !a) return s.status(400).json({ error: 'Boş mesaj veya geçersiz ek' });
  const msg = { id: db.seq++, from: m, to: o, text, att: a, ts: Date.now() }, k = pk(m, o);
  const l = db.msgs[k] || (db.msgs[k] = []); l.push(msg); if (l.length > 2000) l.splice(0, 200);
  save(); push(o, { type: 'msg', m: msg }); push(m, { type: 'msg', m: msg }); s.json({ m: msg });
});
app.get('/api/unread', auth, (q, s) => {
  const m = q.me.username, r = {};
  for (const [k, l] of Object.entries(db.msgs)) {
    const [a, b] = k.split('|'); if (a != m && b != m) continue;
    const o = a == m ? b : a, rd = db.reads[m + '|' + o] || 0, n = l.filter(x => x.from == o && x.id > rd).length; if (n) r[o] = n;
  }
  s.json(r);
});

app.use('/uploads', express.static(UP, { maxAge: '7d' }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use((e, q, s, n) => s.status(e.status || 500).json({ error: e.status == 413 ? 'İçerik çok büyük' : 'Sunucu hatası' }));

// ---- WebSocket (anlık mesaj, çevrimiçi durumu, "şu an dinliyor")
const server = http.createServer(app), wss = new WebSocketServer({ noServer: true });
server.on('upgrade', (q, sock, head) => {
  const u = q.url == '/ws' && userOf(q), o = q.headers.origin;
  if (!u || (o && new URL(o).host != q.headers.host)) return sock.destroy();
  wss.handleUpgrade(q, sock, head, w => {
    const un = u.username, first = !conns.has(un); if (first) conns.set(un, new Set());
    conns.get(un).add(w); w.alive = true; if (first) notify(un);
    w.on('pong', () => w.alive = true);
    w.on('message', d => { try { const m = JSON.parse(d); if (m.type == 'np') { u.np = m.np && m.np.title ? { title: S(m.np.title, 100), artist: S(m.np.artist, 80) } : null; notify(un); } } catch {} });
    w.on('close', () => { const set = conns.get(un); set.delete(w); if (!set.size) { conns.delete(un); u.np = null; notify(un); } });
  });
});
setInterval(() => wss.clients.forEach(w => { if (!w.alive) return w.terminate(); w.alive = false; w.ping(); }), 30000).unref();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Yoni çalışıyor → http://localhost:${PORT}`);
  for (const l of Object.values(os.networkInterfaces()).flat()) if (l.family == 'IPv4' && !l.internal) console.log(`Aynı ağdaki telefon/bilgisayar için → http://${l.address}:${PORT}`);
});
