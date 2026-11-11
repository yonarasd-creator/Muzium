// Yoni kedileri: pixel art çizim motoru. Kediyi kare kare PNG'den değil, her karede iskeletten (gövde, kafa, bacaklar, kuyruk) çizer.
// KediArt.draw(tür, poz) → 48x48 canvas. Zemin çizgisi (ayak hizası) y=38'dedir; altındaki 10 satır sarkan kuyruk içindir.
(() => {
  const N = 48, H = 60, B = 38; // N genişlik, H yükseklik (altta sarkan kuyruk için fazladan satırlar)
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const pack = (r, g, b, a = 255) => ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
  const C = h => pack(...hex(h));
  const unpack = c => [c & 255, (c >> 8) & 255, (c >> 16) & 255];
  const dark = (c, f) => { const [r, g, b] = unpack(c); return pack(r * f | 0, g * f | 0, b * f | 0); };
  const lite = (c, t) => { const [r, g, b] = unpack(c); return pack(r + (255 - r) * t | 0, g + (255 - g) * t | 0, b + (255 - b) * t | 0); };
  const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >> 13)) * 1274126177 | 0; return ((h ^ (h >> 16)) >>> 0) / 4294967295; };

  // tür: base gövde, stripe desen rengi, light açık bölge (karın/ağız/pati), eye göz, inner kulak içi, pat desen
  const T = {
    zencefil: { name: 'Zencefil', base: '#e99a45', light: '#f8dcae', out: '#4e2a12', eye: '#6bbf4b', inner: '#f0a0a8', pat: 'tabby', stripe: '#b0601c', belly: 1 },
    kahve: { name: 'Kahve', base: '#a67c52', light: '#d8bf96', out: '#35221a', eye: '#d9a82a', inner: '#e0a0a0', pat: 'tabby', stripe: '#5d3f26', belly: 1 },
    gece: { name: 'Gece', base: '#3d3d4b', light: '#3d3d4b', out: '#0b0b11', eye: '#e8d13a', inner: '#8a5a78', pat: 'solid' },
    pamuk: { name: 'Pamuk', base: '#f7f3ea', light: '#ffffff', out: '#5e5348', eye: '#59a6e0', inner: '#f4a6b4', pat: 'solid' },
    kalico: { name: 'Alaca', base: '#f6f1e8', light: '#ffffff', out: '#4a3b30', eye: '#d9a82a', inner: '#f0a8b0', pat: 'calico', o: '#e6902f', k: '#34343c' },
    smokin: { name: 'Smokin', base: '#35353f', light: '#fafafa', out: '#0b0b10', eye: '#e6cf3a', inner: '#f0a0a8', pat: 'tux' },
    tuylu: { name: 'Tüylü', base: '#8d857a', light: '#bdb4a5', out: '#2f2a24', eye: '#e0b82a', inner: '#d9a0a8', pat: 'solid', fluff: 1, belly: 1 },
    sutlu: { name: 'Sütlü', base: '#f1e3cc', light: '#f9f1e2', out: '#3d2a20', eye: '#4a9be8', inner: '#6b4a3c', pat: 'siamese', pts: '#5b4032' },
    tekir: { name: 'Tekir', base: '#9c9791', light: '#d2cbbe', out: '#2c2a27', eye: '#7fbf5a', inner: '#dba3a8', pat: 'tabby', stripe: '#5e5a55', belly: 1 },
  };
  for (const k in T) { const t = T[k]; t.b = C(t.base); t.l = C(t.light); t.o_ = C(t.out); t.e = C(t.eye); t.i = C(t.inner); t.s = t.stripe ? C(t.stripe) : 0; t.p = t.pts ? C(t.pts) : 0; if (t.o) { t.oc = C(t.o); t.kc = C(t.k); } }

  function ctx() {
    const b = new Uint32Array(N * H);
    const px = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < N && y < H) b[y * N + x] = c; };
    const ell = (cx, cy, rx, ry, c, rot = 0) => {
      const cs = Math.cos(rot), sn = Math.sin(rot), m = Math.ceil(Math.max(rx, ry)) + 1;
      for (let y = Math.floor(cy - m); y <= cy + m; y++) for (let x = Math.floor(cx - m); x <= cx + m; x++) {
        const dx = x + .5 - cx, dy = y + .5 - cy, u = (dx * cs + dy * sn) / rx, v = (-dx * sn + dy * cs) / ry;
        if (u * u + v * v <= 1) { const k = typeof c == 'function' ? c(x, y, u, v) : c; if (k) px(x, y, k); }
      }
    };
    const poly = (pts, c) => {
      let x0 = 99, x1 = -99, y0 = 99, y1 = -99; for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      for (let y = Math.floor(y0); y <= y1; y++) for (let x = Math.floor(x0); x <= x1; x++) {
        const X = x + .5, Y = y + .5; let ins = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, yi] = pts[i], [xj, yj] = pts[j];
          if ((yi > Y) != (yj > Y) && X < (xj - xi) * (Y - yi) / (yj - yi) + xi) ins = !ins;
        }
        if (ins) { const k = typeof c == 'function' ? c(x, y) : c; if (k) px(x, y, k); }
      }
    };
    const line = (x0, y0, x1, y1, w, c) => {
      const d = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(d * 2));
      for (let i = 0; i <= n; i++) { const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t; if (w <= 1) px(x, y, typeof c == 'function' ? c(x, y) : c); else ell(x, y, w / 2, w / 2, c); }
    };
    return { b, px, ell, poly, line };
  }

  // gövde renklendirme: desen + gölge (alt kısım koyu, geçiş taramalı)
  function bodyCol(t, shadeFrom = .42) {
    return (x, y, u, v) => {
      let c = t.b;
      if (t.pat == 'tabby') { const s = ((u + 1) * 2.6) % 1; if (v < .55 && v > -.85 && s < .36) c = t.s; else if (t.belly && v > .5) c = t.l; }
      else if (t.pat == 'tux') { if (v > .3 && u > -.2) c = t.l; }
      else if (t.pat == 'calico') {
        if ((u + .4) ** 2 + (v + .25) ** 2 * 1.5 < .33) c = t.oc; else if ((u - .55) ** 2 + (v - .1) ** 2 * 1.3 < .2) c = t.kc;
      } else if (t.pat == 'siamese') { if (v < -.35) c = lite(t.b, -0); c = v < -.2 ? dark(t.b, .94) : c; }
      else if (t.belly && v > .5) c = t.l;
      if (v > shadeFrom + .25) return dark(c, .78);
      if (v > shadeFrom && (x + y & 1) == 0) return dark(c, .78);
      return c;
    };
  }

  function tail(r, t, P, bx, by) {
    const o = P.tail || {}, a0 = (o.a ?? 200) * Math.PI / 180, curl = (o.curl ?? 10) * Math.PI / 180, sw = (o.sway ?? 14) * Math.PI / 180, ph = o.ph || 0;
    const n = o.n || 9, seg = o.seg || 2.9, wide = t.fluff ? 1 : 0;
    let x = bx, y = by, a = a0;
    const pts = [];
    for (let i = 0; i < n; i++) {
      a = a0 + curl * i + sw * Math.sin(ph - i * .55) * (.25 + i / n);
      const w = (i < 2 ? 3.4 : i < n - 2 ? 3 : 2.4) + wide;
      let c = t.b;
      if (t.pat == 'tabby' && i % 3 == 2) c = t.s;
      if (t.pat == 'tux' && i >= n - 2) c = t.l;
      if (t.pat == 'siamese') c = t.p;
      if (t.pat == 'calico') c = i >= n - 2 ? t.kc : t.oc;
      if (i > 3 && t.pat == 'solid' && t.fluff) c = dark(t.b, .9);
      const nx = x + Math.cos(a) * seg, ny = y + Math.sin(a) * seg;
      r.line(x, y, nx, ny, w, c); x = nx; y = ny; pts.push([x, y]);
    }
    return pts;
  }

  function leg(r, t, hx, hy, fx, fy, far) {
    fy = Math.min(fy, B);
    let c = t.b; if (t.pat == 'siamese') c = t.p; else if (t.pat == 'calico') c = t.l; else if (t.pat == 'tabby' && t.belly) c = t.b;
    if (far) c = dark(c, .8);
    r.line(hx, hy, fx, fy - 1, 3, c);
    let pc = c; if (t.pat == 'tux') pc = far ? dark(t.l, .85) : t.l; else if (t.pat == 'tabby' && t.belly) pc = far ? dark(t.l, .85) : t.l; else if (t.pat == 'solid' && t.fluff) pc = far ? dark(t.l, .85) : t.l;
    r.ell(fx + 1, fy - .6, 2.7, 1.5, pc);
  }

  function foot(hipX, hipY, ph, amp, lift) { // yürüyüş: dayanma evresinde geri kayar, savurma evresinde ileri yay çizer
    ph = ((ph % 1) + 1) % 1; let x, l;
    if (ph < .6) { x = hipX + amp * (1 - 2 * ph / .6); l = 0; } else { const u = (ph - .6) / .4; x = hipX + amp * (-1 + 2 * u); l = lift * Math.sin(Math.PI * u); }
    return [x, B - l];
  }

  function head(r, t, P, cx, cy) {
    const H = P.head || {}, look = P.look || { x: 0, y: 0 }, ear = P.ear || 0, ang = H.tilt || 0;
    cx += H.dx || 0; cy += H.dy || 0;
    const ec = (t.pat == 'siamese') ? t.p : (t.pat == 'solid' || t.pat == 'tabby' || t.pat == 'tux' || t.pat == 'calico') ? (t.pat == 'calico' ? t.kc : t.b) : t.b;
    const back = P.flat ? 3 : 0;
    // kulaklar
    r.poly([[cx - 6.6, cy - 2 + back], [cx - 5.4 - back * .4, cy - 10.5 + back * 1.3], [cx - 1.2, cy - 5 + back]], ec);
    r.poly([[cx + .6, cy - 5.2 + back], [cx + 4.6 + ear - back * .3, cy - 10.7 + back * 1.3], [cx + 6.8, cy - 2.4 + back]], t.pat == 'calico' ? t.oc : ec);
    if (!P.flat) {
      r.poly([[cx - 5.4, cy - 3.2], [cx - 4.8, cy - 8], [cx - 2.4, cy - 5.2]], t.i);
      r.poly([[cx + 1.6, cy - 5.4], [cx + 4.2 + ear, cy - 8.2], [cx + 5.8, cy - 3.4]], t.i);
    }
    // yüz
    r.ell(cx, cy, 7.4, 6.3, (x, y, u, v) => {
      let c = t.b;
      if (t.pat == 'calico') c = (u < -.1) ? t.kc : (v < -.3 && u > .2) ? t.oc : t.b;
      if (t.pat == 'siamese' && u > .15 && v > -.5) c = t.p;
      if (t.pat == 'tux' && u > .25 && u < .85 && v < -.1) c = t.l;
      return c;
    });
    if (t.pat == 'tux' || t.pat == 'tabby' && t.belly || t.pat == 'solid' && t.fluff || t.pat == 'calico') r.ell(cx + 4.2, cy + 2.7, 3.7, 2.8, t.l);
    if (t.pat == 'siamese') r.ell(cx + 4.4, cy + 2.8, 3.4, 2.6, dark(t.p, 1.12));
    if (t.pat == 'tabby') { for (const [dx, dy] of [[1, -5], [1, -4], [3, -5.6], [3, -4.4], [-1.5, -5.3], [-1.5, -4.4]]) r.px(cx + dx, cy + dy, t.s); for (const dx of [-1.5, -.5]) r.px(cx + dx, cy + 2.2, t.s); }
    if (t.fluff) for (let i = 0; i < 9; i++) { const a = i * .7 + 1.2; r.px(cx + Math.cos(a) * 7.8, cy + 1.5 + Math.sin(a) * 6.8, t.b); }
    // gözler
    const E = P.eyes || 'open';
    const eye = (x, y) => {
      if (E == 'closed') { r.px(x, y + 1, t.o_); r.px(x + 1, y + 1, t.o_); }
      else if (E == 'happy') { r.px(x - 1, y + 2, t.o_); r.px(x, y + 1, t.o_); r.px(x + 1, y + 1, t.o_); r.px(x + 2, y + 2, t.o_); }
      else {
        const half = E == 'half';
        for (let j = half ? 0 : -1; j <= 1; j++) for (let i = 0; i < 2; i++) r.px(x + i, y + j, t.e);
        if (!half) { const lx = look.x > .35 ? 1 : 0, ly = look.y < -.35 ? -1 : 0; r.px(x + lx, y + ly + 0, C('#101018')); r.px(x + lx, y + ly + 1, C('#101018')); r.px(x, y - 1, C('#ffffff')); }
        else { r.px(x, y, C('#101018')); r.px(x + 1, y - 1, t.o_); r.px(x, y - 1, t.o_); }
        r.px(x, y - 2 + (half ? 1 : 0), t.o_); r.px(x + 1, y - 2 + (half ? 1 : 0), t.o_);
      }
    };
    eye(cx + .5, cy - .3); eye(cx + 4.9, cy - .3);
    r.px(cx + 7, cy + 1.8, C('#f08aa0')); // burun
    if (P.mouth == 'open') { r.ell(cx + 5.8, cy + 4.2, 1.8, 1.5, C('#5a1f2a')); r.px(cx + 5.8, cy + 4.6, C('#f08aa0')); }
    else if (P.mouth == 'lick') { r.px(cx + 6, cy + 3.6, C('#f08aa0')); r.px(cx + 6, cy + 4.6, C('#f08aa0')); }
    else { r.px(cx + 5.5, cy + 3.5, t.o_); r.px(cx + 6.5, cy + 3.5, t.o_); }
    if (E == 'happy') for (const dx of [1.5, 2.5, 7, 8]) r.px(cx + dx - (dx > 6 ? 2 : 0), cy + 3, C('#f08aa0'));
    return { whisk: [cx + 7, cy + 2.6] };
  }

  function whiskers(r, w) {
    const c = C('#f4efe6');
    if (!w) return;
    for (const [dx, dy] of [[1, -1], [2, 0], [1, 1]]) { r.px(w[0] + dx, w[1] + dy, c); r.px(w[0] + dx + 1, w[1] + dy * 1.6, c); r.px(w[0] + dx + 2, w[1] + dy * 2.2, c); }
  }

  function finish(r, t, withShadow) {
    const b = r.b, src = Uint32Array.from(b);
    const solid = i => (src[i] >>> 24) == 255;
    for (let y = 0; y < H; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x; if (src[i] >>> 24) continue;
      if ((x > 0 && solid(i - 1)) || (x < N - 1 && solid(i + 1)) || (y > 0 && solid(i - N)) || (y < H - 1 && solid(i + N))) b[i] = t.o_;
    }
  }

  const POSES = {};

  // ---- pozlar ----
  POSES.stand = (r, t, P) => {
    const bob = Math.round(P.bob || 0), ph = P.ph || 0, amp = P.amp ?? 5, lift = P.lift ?? 3.2, pitch = P.pitch || 0;
    const hips = [[17.5, 28 + bob], [32, 28 + bob], [13, 28 + bob], [27.5, 28 + bob]];
    const phs = [0, .5, .5, 0]; // çapraz yürüyüş: far arka+near ön / near arka+far ön
    const F = P.feet || hips.map((h, i) => foot(h[0], h[1], ph + phs[i], amp, lift));
    const fh = (i) => P.feet ? P.feet[i] : F[i];
    leg(r, t, hips[0][0], hips[0][1], ...fh(0), true); leg(r, t, hips[1][0], hips[1][1], ...fh(1), true);
    tail(r, t, { ...P, tail: { a: 226, curl: 7, sway: 14, ...(P.tail || {}) } }, 11.5, 24.5 + bob);
    r.ell(14, 26 + bob, 6.4, 6.6, bodyCol(t));
    r.ell(22.5, 26 + bob + pitch, 10, 6, bodyCol(t), pitch * .05);
    r.ell(28.5, 26.5 + bob + pitch * 1.4, 5.6, 6.3, bodyCol(t));
    r.ell(31.5, 22.5 + bob + pitch, 4.6, 5.5, bodyCol(t, .9));
    leg(r, t, hips[2][0], hips[2][1], ...fh(2), false); leg(r, t, hips[3][0], hips[3][1], ...fh(3), false);
    if (t.pat == 'tux') r.ell(30.5, 27 + bob + pitch, 3.4, 4.6, t.l);
    return head(r, t, P, 35.5, 17.5 + bob + pitch * 1.6);
  };

  POSES.sit = (r, t, P) => {
    const br = P.breath || 0;
    r.ell(15.5, 31, 8, 7, bodyCol(t, .5));
    const tp = tail(r, t, { ...P, tail: { a: 175, curl: -9, sway: 16, n: 9, ...(P.tail || {}) } }, 9.5, 34.5);
    r.ell(15.5, 31, 8, 7, bodyCol(t, .5));
    r.ell(22, 24, 9.8 + br * .3, 6.2, bodyCol(t, .6), -.95);
    r.ell(22.5, 37, 5, 1.8, t.pat == 'siamese' ? t.p : (t.pat == 'tux' || t.belly || t.fluff) ? t.l : t.b); // arka pati
    if (t.pat == 'tux' || t.belly) r.ell(27.5, 20.5, 3.6, 6, t.l, -.25);
    const legc = t.pat == 'siamese' ? t.p : t.b, pc = (t.pat == 'tux' || t.belly || t.fluff) ? t.l : legc;
    r.line(32.5, 22, 33.5, 36, 3, dark(legc, .85)); r.ell(34.5, 37, 2.8, 1.5, dark(pc, .9));
    const hd = P.head || {}, hx = 31.5 + (hd.dx || 0), hy = 11.5 + (hd.dy || 0);
    if (P.paw != null) { r.line(29.5, 21, hx + 3.5, hy + 5 + P.paw, 3, legc); r.ell(hx + 4.5, hy + 5 + P.paw, 2.3, 1.7, pc); }
    else { r.line(29.5, 21, 30.5, 36, 3, legc); r.ell(31.5, 37, 2.8, 1.6, pc); }
    return head(r, t, P, 31.5, 11.5);
  };

  POSES.loaf = (r, t, P) => {
    const br = P.breath || 0;
    tail(r, t, { ...P, tail: { a: 160, curl: -6, sway: 6, n: 9, ...(P.tail || {}) } }, 8.5, 33.5);
    r.ell(21, 33, 12.5, 5.5 + br * .3, bodyCol(t, .5));
    r.ell(12.5, 33.5, 6.5, 5, bodyCol(t, .5));
    r.ell(30, 34, 5, 4.4, bodyCol(t, .5));
    r.ell(35.5, 37, 3.6, 1.7, (t.pat == 'siamese') ? t.p : (t.pat == 'tux' || t.belly || t.fluff) ? t.l : t.b);
    r.ell(31, 37, 3.2, 1.6, (t.pat == 'siamese') ? t.p : (t.pat == 'tux' || t.belly || t.fluff) ? dark(t.l, .9) : dark(t.b, .9));
    return head(r, t, P, 34.5, 28.5 + (P.head && P.head.base || 0));
  };

  POSES.curl = (r, t, P) => {
    const br = P.breath || 0;
    r.ell(22, 32.5, 13.5, 6.4 + br * .35, bodyCol(t, .45));
    r.ell(31, 32.5, 6, 5.5, bodyCol(t, .5));
    // kuyruk gövdeyi önden sarar
    const cp = [[9, 35], [13, 37.5], [19, 38], [25, 38], [31, 37.8], [35, 36.5]];
    let tc = t.b; if (t.pat == 'siamese') tc = t.p;
    for (let i = 0; i < cp.length - 1; i++) { let c = tc; if (t.pat == 'tabby' && i % 2) c = t.s; if (t.pat == 'calico') c = t.oc; if (t.pat == 'tux' && i == cp.length - 2) c = t.l; r.line(cp[i][0], cp[i][1], cp[i + 1][0], cp[i + 1][1], 3 - (t.fluff ? -1 : 0), c); }
    return head(r, t, { ...P, flat: 1, eyes: P.eyes || 'closed' }, 33.5, 30.5 + (P.head && P.head.dy || 0));
  };

  // duvara tırmanma: kafa yukarıda, ön patiler duvara (x≈41) uzanır, kuyruk aşağı sarkar
  POSES.climb = (r, t, P) => {
    const ph = P.ph || 0, s1 = Math.sin(ph * Math.PI * 2), s2 = Math.sin(ph * Math.PI * 2 + Math.PI), bob = (P.bob || 0) + 5;
    const legc = t.pat == 'siamese' ? t.p : t.b, pc = (t.pat == 'tux' || t.belly || t.fluff) ? t.l : legc;
    r.line(20, 32 + bob, 28, 36 + bob, 3, dark(legc, .8)); r.line(28, 36 + bob, 37, 33 + bob + s2 * 2.2, 3, dark(legc, .8)); r.ell(38.5, 33 + bob + s2 * 2.2, 2.2, 1.7, dark(pc, .85));
    tail(r, t, { ...P, tail: { a: 98, curl: 3, sway: 9, n: 8, ...(P.tail || {}) } }, 15.5, 33 + bob);
    r.line(30, 17 + bob, 40, 11 + bob + s2 * 2.5, 3, dark(legc, .8)); r.ell(41, 11 + bob + s2 * 2.5, 2.2, 1.8, dark(pc, .85));
    r.ell(24, 26 + bob, 11, 6.2, bodyCol(t, .75), -.98);
    if (t.pat == 'tux' || t.belly) r.ell(28.5, 20 + bob, 3, 5.5, t.l, -.5);
    r.line(21, 31 + bob, 29, 37 + bob, 3, legc); r.line(29, 37 + bob, 38, 36 + bob + s1 * 2.2, 3, legc); r.ell(39.5, 36 + bob + s1 * 2.2, 2.3, 1.7, pc);
    r.line(31, 19 + bob, 40, 14 + bob + s1 * 2.5, 3, legc); r.ell(41, 14 + bob + s1 * 2.5, 2.3, 1.8, pc);
    return head(r, t, { ...P, ear: 0 }, 34, 9 + bob + (P.head && P.head.dy || 0));
  };

  // ---- ana çizim ----
  const cache = new Map();
  function draw(id, P) {
    const t = T[id] || T.zencefil, r = ctx();
    if (P.shadow !== false) { const k = pack(0, 0, 0, 60); for (let x = 9; x <= 38; x++) { const d = Math.abs(x - 23.5) / 15; if (d < 1) { r.px(x, B + 1, k); if (d < .7) r.px(x, B + 2, k); } } }
    const f = POSES[P.pose || 'stand']; const w = f(r, t, P);
    finish(r, t);
    if (w && !P.noWhisk) whiskers(r, w.whisk);
    const cv = document.createElement('canvas'); cv.width = N; cv.height = H;
    const c2 = cv.getContext('2d'), im = c2.createImageData(N, H); new Uint32Array(im.data.buffer).set(r.b); c2.putImageData(im, 0, 0);
    return cv;
  }

  window.KediArt = { draw, N, H, B, types: Object.keys(T).map(k => [k, T[k].name]), thumb(id) { try { const c = draw(id, { pose: 'sit', tail: { sway: 0 }, shadow: false }), o = document.createElement('canvas'); o.width = N; o.height = 42; o.getContext('2d').drawImage(c, 0, 0); return o.toDataURL(); } catch { return ''; } } };
})();
