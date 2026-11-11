// Yoni kedileri (v2): arayüzün tamamında gezen pixel art kediler.
// Sayfadaki kutu/çizgi kenarlarını "zemin" olarak tarar; kediler üstünde yürür, bir kenardan diğerine zıplar, duvara tırmanır,
// kenarda kuyruğu sarkıtarak uyur, tımar eder, esner, gerinir, fare kovalar, sevilince mırlar. Çizimler kedi-art.js'te (iskelet mantığıyla).
// Ayarlardan açılıp kapanır (tema: kd = göster, kl = seçili kediler, en fazla 3). Kediler tıklamayı engellemez.
(() => {
  const KA = window.KediArt;
  if (!KA) { window.Kedi = { sync() {}, types: [], max: 3, mouse() {} }; return; }
  const TYPES = KA.types, IDS = TYPES.map(t => t[0]), MAX = 3, PX = 2, G = 1500;
  const SW = KA.N * PX, SH = KA.H * PX, FEET = 39 * PX;
  const rnd = (a, b) => a + Math.random() * (b - a), clamp = (v, a, b) => Math.max(a, Math.min(b, v)), pick = a => a[Math.random() * a.length | 0];
  const calm = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
  const ptr = { x: -999, y: -999, t: 0 };
  const ground = { ground: true, el: null, x1: 0, x2: innerWidth, y: innerHeight, b: innerHeight + 60 };
  let layer = null, styleEl = null, cats = [], plats = [], mouse = null, raf = 0, last = 0, scanT = 0, mouseT = rnd(25, 45), music = false, musT = 0, scanDirty = true;
  const cache = new Map(), imgs = {};

  // ---- küçük pixel art parçalar (kalp, Z, nota, fare) kodla çizilir ----
  function mk(w, h, fn) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); fn(g, w, h);
    const d = g.getImageData(0, 0, w, h), a = d.data, src = Uint8ClampedArray.from(a), on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && src[(y * w + x) * 4 + 3] > 200;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!on(x, y) && (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1))) { const i = (y * w + x) * 4; a[i] = 70; a[i + 1] = 30; a[i + 2] = 50; a[i + 3] = 255; }
    g.putImageData(d, 0, 0); return c;
  }
  const px = (g, x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };
  function art() {
    if (imgs.heart) return;
    imgs.heart = mk(11, 10, (g, w, h) => { for (let y = 1; y < 9; y++) for (let x = 1; x < 10; x++) { const nx = (x - 5) / 4.4, ny = -(y - 4.6) / 4; if ((nx * nx + ny * ny - 1) ** 3 - nx * nx * ny ** 3 <= 0) px(g, x, y, y < 4 && x < 5 ? '#ff9db5' : '#ee4d78'); } }).toDataURL();
    imgs.z = mk(7, 7, g => { for (let x = 1; x < 6; x++) { px(g, x, 1, '#eaf1ff'); px(g, x, 5, '#eaf1ff'); } px(g, 4, 2, '#eaf1ff'); px(g, 3, 3, '#eaf1ff'); px(g, 2, 4, '#eaf1ff'); }).toDataURL();
    imgs.note = mk(8, 10, g => { for (let y = 1; y < 7; y++) px(g, 5, y, '#ffe27a'); for (const [x, y] of [[2, 6], [3, 6], [4, 6], [2, 7], [3, 7], [4, 7]]) px(g, x, y, '#ffe27a'); px(g, 6, 2, '#ffe27a'); px(g, 6, 3, '#ffe27a'); }).toDataURL();
    const m = f => mk(18, 10, g => {
      const E = (cx, cy, rx, ry, col) => { for (let y = 0; y < 10; y++) for (let x = 0; x < 18; x++) { const u = (x + .5 - cx) / rx, v = (y + .5 - cy) / ry; if (u * u + v * v <= 1) px(g, x, y, col); } };
      for (let x = 0; x < 6; x++) px(g, x, 7 - (x >> 1) + (f ? 0 : 0), '#e8a3a8'); // kuyruk
      E(9, 6, 5.5, 3.4, '#a8a39b'); E(14, 5.6, 3, 2.4, '#bdb8af'); E(13.4, 2.6, 1.7, 1.7, '#e3a0a6'); E(11.2, 3.2, 1.5, 1.5, '#cfa0a4');
      px(g, 16, 5, '#2a2430'); px(g, 17, 6, '#e87a90'); px(g, 8 + f * 2, 9, '#8a857d'); px(g, 12 - f * 2, 9, '#8a857d');
    }).toDataURL();
    imgs.m0 = m(0); imgs.m1 = m(1);
  }

  const CSS = `#kedi{position:fixed;inset:0;z-index:900;pointer-events:none;overflow:hidden}
#kedi canvas,#kedi img{position:absolute;left:0;top:0;image-rendering:pixelated;will-change:transform;user-select:none;-webkit-user-select:none}
#kedi .kc{width:${SW}px;height:${SH}px;transform-origin:${SW / 2}px 0}
#kedi .kb{position:absolute;left:0;top:0;pointer-events:auto;background:var(--card,#26262e);color:var(--tx,#fff);border:1px solid var(--a,#1fb89a);border-radius:12px;padding:8px 10px;font:13px/1.35 system-ui,sans-serif;max-width:230px;box-shadow:0 6px 22px rgba(0,0,0,.4);animation:kb-in .25s ease}
#kedi .kb small{display:block;opacity:.7;margin-top:2px}#kedi .kb div{display:flex;gap:6px;margin-top:7px}
#kedi .kb button{font:12px system-ui;border:0;border-radius:999px;padding:5px 11px;cursor:pointer;background:var(--a,#1fb89a);color:#06201a}#kedi .kb button+button{background:rgba(128,128,128,.25);color:inherit}
@keyframes kb-in{from{opacity:0;transform:translateY(6px)}}
#kedi .kp{pointer-events:none;animation:kp-up 1.3s ease-out forwards}
#kedi .kz{animation-duration:2.4s;animation-name:kz-up}
@keyframes kp-up{from{opacity:1;transform:translateY(0) scale(.7)}to{opacity:0;transform:translateY(-44px) scale(1.15)}}
@keyframes kz-up{from{opacity:.95;transform:translate(0,0) scale(.8)}to{opacity:0;transform:translate(16px,-40px) scale(1.2)}}`;

  function ensureLayer() {
    if (layer) return; art();
    styleEl = document.createElement('style'); styleEl.textContent = CSS; document.head.appendChild(styleEl);
    layer = document.createElement('div'); layer.id = 'kedi'; layer.setAttribute('aria-hidden', 'true'); document.body.appendChild(layer);
  }

  function puff(kind, x, y) {
    if (!layer) return;
    const e = document.createElement('img'); e.src = imgs[kind]; e.className = 'kp' + (kind == 'z' ? ' kz' : '');
    e.style.cssText = `left:${x}px;top:${y}px;width:${kind == 'heart' ? 22 : kind == 'z' ? 18 : 16}px;height:auto;position:absolute`; layer.appendChild(e);
    setTimeout(() => e.remove(), kind == 'z' ? 2500 : 1400);
  }

  // ---- sayfadaki zeminleri (kutu üst kenarları, çizgiler) tara ----
  const TAGS = 'div,section,aside,header,footer,nav,main,ul,li,button,input,img,canvas,table,hr,h1,h2,h3,p,form,select,textarea,label';
  function visible(el) { try { return el.checkVisibility ? el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) : true; } catch { return true; } }
  function scan() {
    scanDirty = false;
    const vw = innerWidth, vh = innerHeight, cand = [], list = document.body.querySelectorAll(TAGS), n = Math.min(list.length, 2600);
    for (let i = 0; i < n; i++) {
      const el = list[i]; if (layer && layer.contains(el)) continue;
      const r = el.getBoundingClientRect(), w = r.width, h = r.height;
      if (w < 110 || (h < 18 && !(h <= 4 && w >= 150))) continue;
      if (r.top < 56 || r.top > vh - 44 || r.right < 60 || r.left > vw - 60) continue;
      if (w >= vw * .9 && h >= vh * .7) continue;
      cand.push({ el, x1: Math.max(0, r.left), x2: Math.min(vw, r.right), y: Math.round(r.top), b: r.bottom });
    }
    cand.sort((a, b) => a.y - b.y || (b.x2 - b.x1) - (a.x2 - a.x1));
    const out = [];
    for (const p of cand) {
      if (out.length >= 44) break;
      if (out.some(a => Math.abs(a.y - p.y) <= 3 && a.x1 <= p.x1 + 8 && a.x2 >= p.x2 - 8)) continue;
      if (!visible(p.el)) continue;
      const t = document.elementFromPoint(clamp((p.x1 + p.x2) / 2, 1, vw - 1), clamp(p.y + 3, 1, vh - 1));
      if (t && !(p.el.contains(t) || t.contains(p.el))) continue;
      out.push(p);
    }
    plats = out; ground.x2 = vw; ground.y = vh;
  }
  const allP = () => plats.concat(ground);

  // kedinin durduğu platformu canlı güncelle (kaydırma/yeniden boyutlanma); kaybolduysa false
  function refresh(c) {
    const p = c.plat; if (!p) return false;
    if (p.ground) { p.x2 = innerWidth; p.y = innerHeight; return true; }
    if (!p.el.isConnected) return false;
    const r = p.el.getBoundingClientRect();
    if (r.width < 60 || r.top < 30 || r.top > innerHeight - 20) return false;
    p.x1 = Math.max(0, r.left); p.x2 = Math.min(innerWidth, r.right); p.y = Math.round(r.top); p.b = r.bottom; return true;
  }

  // ---- kediler ----
  function addCat(id, first) {
    const cv = document.createElement('canvas'); cv.width = KA.N; cv.height = KA.H; cv.className = 'kc'; layer.appendChild(cv);
    const c = { id, cv, g: cv.getContext('2d'), key: '', x: rnd(80, Math.max(120, innerWidth - 80)), y: -80, vx: 0, vy: 0, dir: Math.random() < .5 ? 1 : -1, plat: null, st: 'air', t: 0, ph: 0, blink: 0, blinkT: rnd(2, 5), ear: 0, earT: rnd(3, 7),
      hover: 0, hT: 0, zT: 0, mT: 0, sp: 55, tx: 0, plan: null, then: null, free: false, edge: 0, cl: null, look: 0, faceT: 0 };
    if (calm()) { c.plat = ground; c.y = innerHeight + 1; c.st = 'sit'; c.t = 2; }
    cats.push(c); return c;
  }
  const setSt = (c, st, t) => { c.st = st; c.t = t; c.ft = 0; };
  const pet = (c, t) => { setSt(c, 'pet', t || 1.8); c.hT = 0; };
  const busy = c => c.st == 'air' || c.st == 'climb' || c.st == 'cling' || c.st == 'crouch' || c.st == 'land' || c.st == 'chase';
  function fall(c, vx, vy) { c.plat = null; c.vx = vx || 0; c.vy = vy || 0; setSt(c, 'air', 99); }
  function walkTo(c, tx, sp, then, free) { c.tx = tx; c.sp = sp; c.then = then || null; c.free = !!free; setSt(c, 'walk', 99); }
  function sameLevel(c) { const p = c.plat; return allP().find(q => q !== p && Math.abs(q.y - p.y) <= 4 && c.x >= q.x1 && c.x <= q.x2); }

  // ---- gezinme planı: zıpla / aşağı atla / tırman ----
  function planTravel(c) {
    const P = c.plat; if (!P) return false;
    const opts = [];
    for (const Q of allP()) {
      if (Q === P || (Q.el && Q.el === P.el)) continue;
      const up = P.y - Q.y, gap = Math.max(0, Q.x1 - P.x2, P.x1 - Q.x2);
      if (up <= -14) {
        const o1 = Math.max(P.x1, Q.x1) + 24, o2 = Math.min(P.x2, Q.x2) - 24; // altında kalıyorsa doğrudan atla
        if (o2 > o1) opts.push({ k: 'drop', Q, dx: rnd(o1, o2) }); else if (gap <= 300) opts.push({ k: 'drop', Q });
      }
      else if (up < 14) { if (gap >= 8 && gap <= 170) opts.push({ k: 'jump', Q }); }
      else if (up <= 135 && gap <= 150) opts.push({ k: 'jump', Q });
      if (up > 110 && up <= 560 && Q.b >= P.y - 10 && !Q.ground) {
        const ls = Q.x1 - 26, rs = Q.x2 + 26;
        if (ls >= P.x1 + 10 && ls <= P.x2 - 10) opts.push({ k: 'climb', Q, side: -1, wx: Q.x1 });
        if (rs >= P.x1 + 10 && rs <= P.x2 - 10) opts.push({ k: 'climb', Q, side: 1, wx: Q.x2 });
      }
    }
    const vw = innerWidth; // pencere kenarına tırman (kenara değen her platformdan)
    if (P.y > 260) {
      if (P.x1 <= 20) { const L = plats.filter(q => q.x1 <= 150 && P.y - q.y > 110); opts.push({ k: 'climb', Q: L.length ? pick(L) : null, side: 1, wx: 0, win: 1 }); }
      if (P.x2 >= vw - 20) { const R = plats.filter(q => q.x2 >= vw - 150 && P.y - q.y > 110); opts.push({ k: 'climb', Q: R.length ? pick(R) : null, side: -1, wx: vw, win: 1 }); }
    }
    if (!opts.length) return false;
    const o = pick(opts); c.plan = o;
    if (o.k == 'drop' && o.dx != null) walkTo(c, o.dx, 52, 'drop');
    else if (o.k == 'drop') {
      const left = (o.Q.x1 + o.Q.x2) / 2 < c.x;
      walkTo(c, left ? P.x1 - 60 : P.x2 + 60, 52, null, true);
    } else if (o.k == 'jump') {
      const Q = o.Q, up = P.y - Q.y; let px;
      if (up > 14 && Q.x1 < P.x2 && Q.x2 > P.x1) { // Q üstte ve yatayda örtüşüyor: yan taraftan çık
        const l = Q.x1 - 36, r = Q.x2 + 36, okL = l >= P.x1 + 14, okR = r <= P.x2 - 14;
        px = okL && (!okR || Math.abs(c.x - l) < Math.abs(c.x - r)) ? l : okR ? r : clamp((Q.x1 + Q.x2) / 2, P.x1 + 14, P.x2 - 14);
      } else px = clamp((Q.x1 + Q.x2) / 2, P.x1 + 14, P.x2 - 14);
      o.px = px; o.lx = clamp(px, Q.x1 + 20, Q.x2 - 20);
      if (Math.abs(o.lx - px) > 260) return false;
      walkTo(c, px, 62, 'jump');
    } else {
      o.stand = o.wx + o.side * 26; walkTo(c, o.stand, 62, 'climb');
    }
    return true;
  }

  function launch(c) {
    const o = c.plan, P = c.plat; if (!o || !P) return setSt(c, 'sit', 1);
    const Q = o.Q, up = P.y - Q.y, apex = Math.max(0, up) + 48, vy = -Math.sqrt(2 * G * apex), t = (-vy + Math.sqrt(vy * vy - 2 * G * up)) / G;
    c.vx = (o.lx - c.x) / t; c.vy = vy; if (Math.abs(c.vx) > 3) c.dir = c.vx > 0 ? 1 : -1; c.plat = null; setSt(c, 'air', 99);
  }

  function startClimb(c) {
    const o = c.plan; c.cl = { side: o.side, wx: o.wx, Q: o.Q, top: 0, ph: 0, y0: c.y, win: !!o.win };
    c.dir = -o.side; c.plat = null; setSt(c, 'climb', 99);
    if (!o.Q) c.cl.free = rnd(150, Math.min(420, c.y - 90));
  }

  function startSleep(c) {
    const P = c.plat; c.edge = 0;
    const sides = P && !P.ground && P.x2 - P.x1 >= 170 ? [P.x1 > 40 && -1, P.x2 < innerWidth - 40 && 1].filter(Boolean) : [];
    if (sides.length && Math.random() < .9) {
      c.edge = pick(sides); c.plan = { edge: c.edge };
      walkTo(c, c.edge < 0 ? P.x1 + 33 : P.x2 - 33, 50, 'sleep');
    } else setSt(c, 'sleep', rnd(14, 28));
  }

  function next(c) {
    const r = Math.random(), P = c.plat; if (!P) return setSt(c, 'sit', 1);
    const wander = () => walkTo(c, clamp(c.x + rnd(-260, 260), P.x1 + 30, P.x2 - 30), 52);
    if (calm()) return r < .35 ? setSt(c, 'sleep', rnd(10, 20)) : setSt(c, 'sit', rnd(4, 8));
    if (r < .17) wander();
    else if (r < .45) { if (!planTravel(c)) wander(); }
    else if (r < .57) startSleep(c);
    else if (r < .65) setSt(c, 'loaf', rnd(6, 12));
    else if (r < .75) setSt(c, 'groom', rnd(3, 4.5));
    else if (r < .81) setSt(c, 'yawn', 1.7);
    else if (r < .87) setSt(c, 'stretch', 2);
    else if (r < .93 && performance.now() - ptr.t < 6000 && ptr.x > 0 && ptr.y > P.y - 400 && ptr.y < P.y + 40) walkTo(c, clamp(ptr.x + (c.x < ptr.x ? -50 : 50), P.x1 + 20, P.x2 - 20), 95);
    else setSt(c, 'sit', rnd(2, 5));
  }

  function arrive(c) {
    const P = c.plat, then = c.then; c.then = null;
    if (then == 'jump') { if (c.plan) c.dir = c.plan.lx >= c.x ? 1 : -1; setSt(c, 'crouch', .34); }
    else if (then == 'climb') startClimb(c);
    else if (then == 'drop') { const Q = c.plan && c.plan.Q; fall(c, Q ? clamp(((Q.x1 + Q.x2) / 2 - c.x) * .2, -30, 30) : 0, -70); }
    else if (then == 'sleep') { c.dir = c.edge < 0 ? 1 : -1; setSt(c, 'sleep', rnd(16, 32)); }
    else setSt(c, 'sit', rnd(1.5, 4.5));
  }

  // ---- fare ----
  function spawnMouse() {
    if (mouse || !cats.length || calm() || !layer) return;
    const cs = cats.filter(c => c.plat && !busy(c) && c.st != 'pet' && c.plat.x2 - c.plat.x1 >= 240); if (!cs.length) { mouseT = 12; return; }
    const c = pick(cs), P = c.plat, fromRight = c.x < (P.x1 + P.x2) / 2, el = document.createElement('img'); el.src = imgs.m0; el.style.cssText = `width:36px;height:20px;position:absolute;left:0;top:0;image-rendering:pixelated`; layer.appendChild(el);
    mouse = { el, P, x: fromRight ? P.x2 - 14 : P.x1 + 14, dir: fromRight ? -1 : 1, ph: 0 };
    setSt(c, 'chase', 99);
  }
  function endMouse(caught) {
    if (!mouse) return;
    if (caught) puff('heart', mouse.x, mouse.P.y - 60);
    mouse.el.remove(); mouse = null;
    cats.forEach(c => { if (c.st == 'chase') caught ? pet(c, 2) : setSt(c, 'sit', rnd(1, 3)); });
  }

  // ---- şarkı önerisi: en çok dinlenenlerden birini konuşma balonuyla önerir ----
  let sug = null, sugT = rnd(90, 150);
  const esc = x => String(x).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
  function closeSug() { if (sug) { sug.el.remove(); if (sug.c.st == 'sit') sug.c.t = 1; sug = null; } }
  async function suggest() {
    if (sug || !window.kediPick || calm() || music) return;
    const cs = cats.filter(c => c.plat && c.st == 'sit'); if (!cs.length) return;
    const r = await window.kediPick(); if (!r || sug) return;
    const c = pick(cs); if (c.st != 'sit') return;
    const el = document.createElement('div'); el.className = 'kb';
    el.innerHTML = `🎵 Bunu dinleyelim mi?<small>${esc(r.t.title)} · ${esc(r.t.artist || '')}</small><div><button>▶ Çal</button><button>Şimdi değil</button></div>`;
    const [b1, b2] = el.querySelectorAll('button'); b1.onclick = () => { try { window.kediPlay(r.t); } catch {} puff('heart', c.x - 10, c.y - 74); closeSug(); }; b2.onclick = closeSug;
    layer.appendChild(el); setSt(c, 'sit', 14); sug = { el, c, life: 14 };
  }

  // ---- poz (kedi-art parametreleri) ----
  const tph = (T, rate) => +((Math.floor(T * rate) % 16) * Math.PI / 8).toFixed(3);
  function pose(c, T) {
    const gr = !!(c.plat && c.plat.ground), base = { shadow: gr };
    const look = { x: c.look, y: ptr.y < c.y - 120 && c.look ? -1 : 0 };
    const ear = c.earT < 0 ? 2 : 0, eyes = c.blink > 0 ? 'closed' : 'open';
    const bounce = music ? (Math.floor(T * 5) % 2 ? 1 : 0) : 0;
    switch (c.st) {
      case 'sit': return { ...base, pose: 'sit', eyes, look, ear, breath: Math.round(Math.sin(T * 2)), head: { dy: bounce }, tail: { ph: tph(T, music ? 6 : 2.2), sway: music ? 22 : 14 } };
      case 'groom': return { ...base, pose: 'sit', eyes: 'closed', mouth: Math.floor(T * 4) % 2 ? 'lick' : 'closed', head: { dx: -3, dy: 5 }, paw: Math.floor(T * 5) % 2 ? 1 : -1, tail: { ph: tph(T, 1.6), sway: 8 } };
      case 'yawn': { const o = c.t < 1.3 && c.t > .4; return { ...base, pose: 'sit', eyes: 'closed', mouth: o ? 'open' : 'closed', head: { dy: o ? -1 : 0 }, tail: { ph: tph(T, 1.5), sway: 8 } }; }
      case 'stretch': return { ...base, pose: 'stand', pitch: 4, feet: [[16, 38], [13, 38], [40, 38], [37, 38]], eyes: 'half', tail: { a: 255, curl: 3, sway: 6, ph: tph(T, 2) } };
      case 'loaf': return { ...base, pose: 'loaf', eyes: c.blink > 0 || Math.floor(T / 3) % 3 == 2 ? 'closed' : 'half', breath: Math.round(Math.sin(T * 1.6)), head: { base: 1 }, tail: { sway: 5, ph: tph(T, 1.2) } };
      case 'sleep': {
        const br = Math.round(Math.sin(T * 1.4)), ledge = c.edge && c.plat && !c.plat.ground;
        if (ledge) return { ...base, pose: 'loaf', eyes: 'closed', breath: br, head: { base: 3 }, tail: { a: 97, curl: 2, sway: 9, n: 8, ph: tph(T, 1.3) } };
        return { ...base, pose: 'curl', eyes: 'closed', breath: br, head: { dy: 1 } };
      }
      case 'pet': return { ...base, pose: 'sit', eyes: 'happy', mouth: 'closed', ear: 0, breath: 1, tail: { ph: tph(T, 7), sway: 26 } };
      case 'walk': { const run = c.sp > 100; return { ...base, pose: 'stand', ph: Math.round((c.ph % 1) * 8) / 8, amp: run ? 6 : 5, lift: run ? 4 : 3.2, eyes: 'open', look: { x: 1, y: 0 }, pitch: run ? -1 : 0, tail: { ph: tph(T, 3), sway: run ? 8 : 12 } }; }
      case 'chase': return { ...base, pose: 'stand', ph: Math.round((c.ph % 1) * 8) / 8, amp: 7, lift: 4.8, pitch: 1, eyes: 'open', look: { x: 1, y: 0 }, tail: { a: 190, curl: 6, sway: 6, ph: tph(T, 5) } };
      case 'crouch': return { ...base, pose: 'stand', bob: 4, pitch: 2, eyes: 'open', look: { x: 1, y: 0 }, tail: { a: 175, curl: 4, sway: 30, ph: tph(T, 9) } };
      case 'land': return { ...base, pose: 'stand', bob: 3, pitch: 1, eyes: 'open', tail: { a: 200, curl: 8, sway: 12, ph: tph(T, 3) } };
      case 'air': {
        const s = { shadow: false, pose: 'stand', eyes: 'open', look: { x: 1, y: 0 } };
        if (c.vy < -150) return { ...s, pitch: -3, feet: [[7, 35], [4, 34], [39, 29], [35, 31]], tail: { a: 200, curl: 15, sway: 6, ph: tph(T, 3) } };
        if (c.vy > 150) return { ...s, pitch: 2, feet: [[13, 34], [10, 35], [36, 35], [32, 36]], tail: { a: 240, curl: -6, sway: 10, ph: tph(T, 4) } };
        return { ...s, pitch: 0, feet: [[10, 36], [6, 35], [38, 34], [34, 35]], tail: { a: 210, curl: 10, sway: 8, ph: tph(T, 3) } };
      }
      case 'climb': return { shadow: false, pose: 'climb', ph: Math.round(((c.cl ? c.cl.ph : 0) % 1) * 8) / 8, eyes: 'open', tail: { ph: tph(T, 2), sway: 12 } };
      case 'cling': return { shadow: false, pose: 'climb', ph: .25, eyes: 'open', tail: { ph: tph(T, 2.4), sway: 14 } };
    }
    return { ...base, pose: 'sit' };
  }

  function update(c, dt, now, T) {
    // imleç üstünde mi (kediler tıklamayı engellemediği için konuma bakılır)
    const inside = ptr.t && now - ptr.t < 8000 && Math.abs(ptr.x - c.x) < 34 && ptr.y > c.y - 62 && ptr.y < c.y + 4;
    c.hover = inside ? c.hover + dt : 0;
    if (!busy(c) && c.st != 'pet' && c.hover > .35) { c.edge = 0; pet(c, 1.5); }
    c.blinkT -= dt; if (c.blinkT <= 0) { c.blink = .15; c.blinkT = rnd(2.5, 6); } if (c.blink > 0) c.blink -= dt;
    c.earT -= dt; if (c.earT < -.18) c.earT = rnd(3, 8);

    // durulduğu platformu canlı izle
    if (c.plat) { if (!refresh(c)) { fall(c, 0, 0); } else if (c.st != 'air') c.y = c.plat.y + 1; }

    const P = c.plat;
    switch (c.st) {
      case 'sit': {
        c.t -= dt;
        // imlece dön / bak
        const near = now - ptr.t < 3500 && Math.hypot(ptr.x - c.x, ptr.y - c.y) < 420;
        c.faceT -= dt;
        if (near) { const d = ptr.x > c.x ? 1 : -1; if (d != c.dir && c.faceT <= 0) { c.dir = d; c.faceT = 1.2; } c.look = 1; } else c.look = 0;
        if (music && Math.random() < dt * .08) puff('note', c.x + c.dir * 16, c.y - 66);
        if (c.t <= 0) next(c);
        break;
      }
      case 'groom': case 'yawn': case 'stretch': case 'land': c.t -= dt; if (c.t <= 0) setSt(c, 'sit', rnd(1, 3)); break;
      case 'loaf': c.t -= dt; if (c.t <= 0) Math.random() < .5 ? startSleep(c) : setSt(c, 'stretch', 2); break;
      case 'crouch': c.t -= dt; if (c.t <= 0) launch(c); break;
      case 'sleep': {
        c.t -= dt;
        if (c.edge && P && !P.ground) c.x = c.edge < 0 ? P.x1 + 33 : P.x2 - 33;
        c.zT -= dt; if (c.zT <= 0) { puff('z', c.x + c.dir * 24, c.y - 40); c.zT = 2.3; }
        if (c.t <= 0) { c.edge = 0; setSt(c, 'yawn', 1.7); }
        break;
      }
      case 'pet':
        c.t = c.hover > 0 ? 1.2 : c.t - dt; c.hT -= dt;
        if (c.hT <= 0) { puff('heart', c.x + c.dir * (6 + Math.random() * 22) - 11, c.y - 70); c.hT = .55; }
        if (c.t <= 0) setSt(c, 'sit', rnd(1.5, 3));
        break;
      case 'walk': {
        const dx = c.tx - c.x, ad = Math.abs(dx), step = Math.min(ad, c.sp * dt);
        if (ad > 1) { c.dir = dx > 0 ? 1 : -1; c.x += c.dir * step; c.ph += step / (c.sp > 100 ? 46 : 32); }
        if (c.free) { if (c.x < P.x1 - 10 || c.x > P.x2 + 10) { fall(c, c.dir * 55, 0); break; } }
        else if (c.x < P.x1 + 4 || c.x > P.x2 - 4) { const q = sameLevel(c); if (q) c.plat = q; else { c.x = clamp(c.x, P.x1 + 4, P.x2 - 4); c.tx = c.x; } }
        if (Math.abs(c.tx - c.x) <= 1.5) arrive(c);
        break;
      }
      case 'chase': {
        if (!mouse) { setSt(c, 'sit', 1); break; }
        c.dir = mouse.x > c.x ? 1 : -1; c.x += c.dir * Math.min(Math.abs(mouse.x - c.x), 175 * dt); c.ph += 175 * dt / 46;
        c.x = clamp(c.x, P.x1, P.x2);
        if (Math.abs(c.x - mouse.x) < 30) endMouse(true);
        break;
      }
      case 'air': {
        const py = c.y; c.vy += G * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.x = clamp(c.x, 8, innerWidth - 8);
        if (c.vx > 4) c.dir = 1; else if (c.vx < -4) c.dir = -1;
        if (c.vy > 0) {
          let best = null;
          for (const q of allP()) if (py <= q.y + 3 && c.y >= q.y && c.x >= q.x1 - 6 && c.x <= q.x2 + 6 && (!best || q.y < best.y)) best = q;
          if (best) { c.plat = best; c.y = best.y + 1; c.vx = c.vy = 0; setSt(c, 'land', .22); }
        }
        break;
      }
      case 'climb': {
        const cl = c.cl; if (!cl) { fall(c, 0, 0); break; }
        const Q = cl.Q;
        if (Q) { // duvarı canlı izle
          if (!Q.el || !Q.el.isConnected) { fall(c, -cl.side * 40, 0); break; }
          const r = Q.el.getBoundingClientRect(); if (r.width < 60 || r.top < 30) { fall(c, -cl.side * 40, 0); break; }
          if (!cl.win) cl.wx = cl.side < 0 ? r.left : r.right; Q.y = Math.round(r.top); Q.x1 = r.left; Q.x2 = r.right; cl.top = Q.y + 40;
        } else cl.top = cl.y0 - cl.free;
        const tx = cl.wx + cl.side * 36;
        c.x += clamp(tx - c.x, -140 * dt, 140 * dt);
        if (Math.abs(tx - c.x) < 2) { c.y -= 44 * dt; cl.ph += dt * 1.5; }
        if (c.y <= cl.top) {
          if (Q) { c.vx = -cl.side * 115; c.vy = -430; c.plat = null; setSt(c, 'air', 99); }
          else { setSt(c, 'cling', rnd(1.2, 2.2)); }
        }
        break;
      }
      case 'cling': c.t -= dt; if (c.t <= 0) fall(c, -c.cl.side * 80, -160); break;
    }
    c.x = clamp(c.x, 0, innerWidth);

    // çiz
    const Pz = pose(c, T), key = c.id + JSON.stringify(Pz);
    if (key !== c.key) {
      c.key = key; let s = cache.get(key);
      if (!s) { s = KA.draw(c.id, Pz); if (cache.size > 600) cache.clear(); cache.set(key, s); }
      c.g.clearRect(0, 0, KA.N, KA.H); c.g.drawImage(s, 0, 0);
    }
    c.cv.style.zIndex = Math.round(c.y);
    c.cv.style.transform = `translate3d(${Math.round(c.x - SW / 2)}px,${Math.round(c.y - FEET)}px,0)${c.dir < 0 ? ' scaleX(-1)' : ''}`;
  }

  function musicOn() {
    try { if (typeof yt !== 'undefined' && yt) return !!(yp && yp.getPlayerState && yp.getPlayerState() == 1); return typeof au !== 'undefined' && !au.paused && !!au.src; } catch { return false; }
  }

  function loop(ts) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min((ts - last) / 1000, .1); last = ts;
    const now = performance.now(), T = now / 1000;
    musT -= dt; if (musT <= 0) { music = musicOn(); musT = 1; }
    scanT -= dt; if (scanT <= 0 || scanDirty && scanT < .85) { scan(); scanT = 1; }
    if (mouse) {
      const P = mouse.P; mouse.ph += dt;
      if (!P.ground && (!P.el || !P.el.isConnected)) endMouse(false);
      else {
        mouse.x += mouse.dir * 125 * dt;
        const bob = Math.abs(Math.sin(mouse.ph * 18)) * 2;
        mouse.el.src = Math.floor(mouse.ph * 14) % 2 ? imgs.m1 : imgs.m0;
        mouse.el.style.transform = `translate3d(${Math.round(mouse.x - 18)}px,${Math.round(P.y - 20 - bob)}px,0)${mouse.dir < 0 ? ' scaleX(-1)' : ''}`;
        if (mouse.x < P.x1 + 4 || mouse.x > P.x2 - 4) endMouse(false);
      }
    } else if (cats.length && !calm()) { mouseT -= dt; if (mouseT <= 0) { spawnMouse(); mouseT = rnd(60, 110); } }
    for (const c of cats) update(c, dt, now, T);
    if (sug) {
      sug.life -= dt; const c = sug.c;
      if (sug.life <= 0 || !cats.includes(c) || busy(c) || c.st == 'walk') closeSug();
      else { c.t = Math.max(c.t, 1); const w = sug.el.offsetWidth, h = sug.el.offsetHeight; sug.el.style.transform = `translate3d(${Math.round(clamp(c.x - w / 2, 6, innerWidth - w - 6))}px,${Math.round(Math.max(6, c.y - 82 - h))}px,0)`; sug.el.style.zIndex = 2000; }
    } else if (cats.length) { sugT -= dt; if (sugT <= 0) { suggest(); sugT = rnd(240, 420); } }
  }

  function start() { ensureLayer(); if (!raf) { last = performance.now(); scan(); raf = requestAnimationFrame(loop); } }
  function stop() {
    cancelAnimationFrame(raf); raf = 0; mouse = null; cats = []; plats = []; sug = null;
    if (layer) { layer.remove(); layer = null; } if (styleEl) { styleEl.remove(); styleEl = null; }
  }

  function sync(th) {
    const on = !th || th.kd !== false;
    let want = on ? (th && Array.isArray(th.kl) ? th.kl.filter(i => IDS.includes(i)) : []) : [];
    if (on && !want.length) want = ['zencefil'];
    want = [...new Set(want)].slice(0, MAX);
    if (!want.length) return stop();
    start();
    cats = cats.filter(c => want.includes(c.id) || (c.cv.remove(), false));
    want.forEach(id => { if (!cats.some(c => c.id === id)) addCat(id); });
  }

  document.addEventListener('pointermove', e => { ptr.x = e.clientX; ptr.y = e.clientY; ptr.t = performance.now(); }, { passive: true });
  document.addEventListener('pointerdown', e => { // dokunmatik ekranda kediye dokununca sevilir
    ptr.x = e.clientX; ptr.y = e.clientY; ptr.t = performance.now();
    for (const c of cats) if (!busy(c) && Math.abs(ptr.x - c.x) < 34 && ptr.y > c.y - 62 && ptr.y < c.y + 4) { c.edge = 0; pet(c, 1.8); }
  }, { passive: true });
  addEventListener('resize', () => { scanDirty = true; scanT = Math.min(scanT, .3); });
  document.addEventListener('scroll', () => { scanDirty = true; }, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else if (layer) { last = performance.now(); raf = requestAnimationFrame(loop); }
  });

  window.Kedi = { sync, types: TYPES, max: MAX, mouse: spawnMouse, _dbg: () => ({ suggest, cats, plats, mouse, travel: planTravel, climb: c => { c.plan = null; } }) };
})();
