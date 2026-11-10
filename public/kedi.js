// Yoni kedileri: sayfada serbest gezen, uyuyan, sevilince mırlayan, fare kovalayan pixel art kediler.
// Ayarlardan açılıp kapanır (tema: kd = göster, kl = seçili kediler, en fazla 3). Kediler tıklamayı engellemez.
(() => {
  const TYPES = [['zencefil', 'Zencefil'], ['gece', 'Gece'], ['pamuk', 'Pamuk'], ['duman', 'Duman'], ['smokin', 'Smokin'], ['sutlu', 'Sütlü']];
  const IDS = TYPES.map(t => t[0]), MAX = 3, PX = 3, SZ = 32 * PX, NF = 9;
  const WALK = [3, 4, 5, 6], SIT = 0, BLINK = 1, HAPPY = 2, SLEEP = [7, 8];
  const rnd = (a, b) => a + Math.random() * (b - a), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const calm = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
  const bx = () => Math.max(0, innerWidth - SZ), by = () => Math.max(0, innerHeight - SZ);
  const ptr = { x: -999, y: -999, t: 0 };
  let layer = null, styleEl = null, cats = [], mouse = null, raf = 0, last = 0, mouseT = rnd(25, 45), music = false, musT = 0;

  const CSS = `#kedi{position:fixed;inset:0;z-index:900;pointer-events:none;overflow:hidden}
#kedi .kc,#kedi .kf{position:absolute;left:0;top:0;width:${SZ}px;height:${SZ}px;image-rendering:pixelated;will-change:transform;user-select:none;-webkit-user-select:none}
#kedi .kc{background-size:${NF * SZ}px ${SZ}px;background-repeat:no-repeat}
#kedi .kf{background:url(kedi/fare.png) 0 0/${SZ}px ${SZ}px no-repeat}
#kedi .kh,#kedi .kz{position:absolute;image-rendering:pixelated;background-size:100% 100%;pointer-events:none}
#kedi .kh{width:20px;height:20px;background-image:url(kedi/kalp.png);animation:kh-up 1.2s ease-out forwards}
#kedi .kz{width:16px;height:16px;background-image:url(kedi/z.png);animation:kz-up 2.2s ease-out forwards}
@keyframes kh-up{from{opacity:1;transform:translateY(0) scale(.7)}to{opacity:0;transform:translateY(-46px) scale(1.15)}}
@keyframes kz-up{from{opacity:.9;transform:translate(0,0)}to{opacity:0;transform:translate(14px,-40px)}}`;

  function ensureLayer() {
    if (layer) return;
    styleEl = document.createElement('style'); styleEl.textContent = CSS; document.head.appendChild(styleEl);
    layer = document.createElement('div'); layer.id = 'kedi'; layer.setAttribute('aria-hidden', 'true'); document.body.appendChild(layer);
  }

  function puff(cls, x, y) {
    if (!layer) return;
    const e = document.createElement('div'); e.className = cls; e.style.left = x + 'px'; e.style.top = y + 'px'; layer.appendChild(e);
    setTimeout(() => e.remove(), cls == 'kz' ? 2300 : 1300);
  }

  function addCat(id) {
    const el = document.createElement('div'); el.className = 'kc'; el.style.backgroundImage = `url(kedi/${id}.png)`; layer.appendChild(el);
    const c = { id, el, x: rnd(0, bx()), y: rnd(by() * .45, by()), dir: Math.random() < .5 ? 1 : -1, state: 'sit', t: rnd(1, 3), ft: 0, fr: -1,
      blinkT: rnd(2, 5), blink: 0, hover: 0, over: false, hT: 0, zT: 0, bob: 0, tx: 0, ty: 0 };
    cats.push(c); return c;
  }

  const set = (c, s, t) => { c.state = s; c.t = t; c.ft = 0; };
  const pet = (c, t) => { set(c, 'pet', t || 1.8); c.hT = 0; };

  function go(c, state, x, y) { c.tx = clamp(x, 0, bx()); c.ty = clamp(y, 0, by()); set(c, state, 99); }

  function next(c) {
    const r = Math.random();
    if (calm()) return r < .3 ? set(c, 'sleep', rnd(10, 20)) : set(c, 'sit', rnd(4, 8));
    if (r < .5) go(c, 'walk', rnd(0, bx()), c.y + rnd(-170, 170));
    else if (r < .62 && !music) set(c, 'sleep', rnd(10, 22));
    else if (r < .76 && performance.now() - ptr.t < 6000 && ptr.x > -500) go(c, 'follow', ptr.x + (c.x < ptr.x ? -SZ * 1.05 : SZ * .05), ptr.y - SZ * .55);
    else set(c, 'sit', rnd(2, 6));
  }

  function step(c, dt, sp) { // hedefe doğru yürür; vardıysa true
    const dx = c.tx - c.x, dy = c.ty - c.y, d = Math.hypot(dx, dy);
    if (d < 4) return true;
    const s = Math.min(sp * dt, d); c.x += dx / d * s; c.y += dy / d * s;
    if (Math.abs(dx) > 2) c.dir = dx > 0 ? 1 : -1;
    return false;
  }

  function spawnMouse() {
    if (mouse || !cats.length || calm()) return;
    const fromL = Math.random() < .5, y = rnd(innerHeight * .3, Math.max(innerHeight * .31, innerHeight - SZ * .8));
    const el = document.createElement('div'); el.className = 'kf'; layer.appendChild(el);
    mouse = { el, x: fromL ? -SZ : innerWidth, y, dir: fromL ? 1 : -1, ph: 0 };
    const c = cats.filter(k => k.state != 'pet').sort((a, b) => Math.hypot(a.x - mouse.x, a.y - y) - Math.hypot(b.x - mouse.x, b.y - y))[0];
    if (c) set(c, 'chase', 99);
  }

  function endMouse(caught) {
    if (!mouse) return;
    if (caught) puff('kh', mouse.x + SZ * .4, mouse.y);
    mouse.el.remove(); mouse = null;
    cats.forEach(c => { if (c.state == 'chase') { if (caught) pet(c, 1.6); else set(c, 'sit', rnd(1, 3)); } });
  }

  function update(c, dt, now) {
    // imleç kedinin üstünde mi? (kediler tıklamayı engellemediği için konuma bakılır)
    const inside = ptr.t && now - ptr.t < 8000 && ptr.x > c.x + SZ * .15 && ptr.x < c.x + SZ * .85 && ptr.y > c.y + SZ * .1 && ptr.y < c.y + SZ * .95;
    c.over = inside; c.hover = inside ? c.hover + dt : 0;
    if (c.state != 'pet' && c.state != 'chase' && c.hover > .35) pet(c, 1.4);
    let fr = SIT;
    switch (c.state) {
      case 'pet':
        fr = HAPPY; c.t = c.over ? 1.2 : c.t - dt; c.hT -= dt;
        if (c.hT <= 0) { puff('kh', c.x + SZ * (.25 + Math.random() * .35), c.y + SZ * .05); c.hT = .55; }
        if (c.t <= 0) set(c, 'sit', rnd(1.5, 3));
        break;
      case 'sit':
        c.t -= dt; c.blinkT -= dt; if (c.blinkT <= 0) { c.blink = .16; c.blinkT = rnd(2.5, 6); }
        if (c.blink > 0) { c.blink -= dt; fr = BLINK; }
        if (c.t <= 0) next(c);
        break;
      case 'walk': case 'follow':
        c.ft += dt; fr = WALK[Math.floor(c.ft / .14) % 4];
        if (step(c, dt, c.state == 'follow' ? 95 : 55)) set(c, 'sit', rnd(2, 6));
        break;
      case 'chase':
        if (!mouse) { set(c, 'sit', 1); break; }
        c.tx = mouse.x; c.ty = mouse.y - SZ * .1; c.ft += dt; fr = WALK[Math.floor(c.ft / .07) % 4];
        step(c, dt, 175);
        if (Math.hypot(c.x - mouse.x, c.y - (mouse.y - SZ * .1)) < SZ * .55) endMouse(true);
        break;
      case 'sleep':
        c.t -= dt; c.ft += dt; fr = SLEEP[Math.floor(c.ft / .9) % 2];
        c.zT -= dt; if (c.zT <= 0) { puff('kz', c.x + SZ * (c.dir > 0 ? .62 : .12), c.y + SZ * .25); c.zT = 2.2; }
        if (c.t <= 0) set(c, 'sit', rnd(1, 3));
        break;
    }
    c.x = clamp(c.x, 0, bx()); c.y = clamp(c.y, 0, by());
    c.bob = (music && c.state == 'sit') ? Math.abs(Math.sin(now / 160)) * 5 : 0; // müzik çalarken oturan kediler sallanır
    if (fr !== c.fr) { c.fr = fr; c.el.style.backgroundPosition = `-${fr * SZ}px 0`; }
    c.el.style.zIndex = Math.round(c.y);
    c.el.style.transform = `translate3d(${Math.round(c.x)}px,${Math.round(c.y - c.bob)}px,0)${c.dir < 0 ? ' scaleX(-1)' : ''}`;
  }

  function musicOn() {
    try { if (typeof yt !== 'undefined' && yt) return !!(yp && yp.getPlayerState && yp.getPlayerState() == 1); return typeof au !== 'undefined' && !au.paused && !!au.src; } catch { return false; }
  }

  function loop(ts) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min((ts - last) / 1000, .1); last = ts;
    const now = performance.now();
    musT -= dt; if (musT <= 0) { music = musicOn(); musT = 1; }
    if (mouse) {
      mouse.ph += dt; mouse.x += mouse.dir * 150 * dt;
      mouse.el.style.transform = `translate3d(${Math.round(mouse.x)}px,${Math.round(mouse.y + Math.sin(mouse.ph * 22) * 3)}px,0)${mouse.dir < 0 ? ' scaleX(-1)' : ''}`;
      if (mouse.x < -SZ * 1.2 || mouse.x > innerWidth + SZ * .2) endMouse(false);
    } else if (cats.length && !calm()) { mouseT -= dt; if (mouseT <= 0) { spawnMouse(); mouseT = rnd(60, 110); } }
    for (const c of cats) update(c, dt, now);
  }

  function start() { ensureLayer(); if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); } }
  function stop() {
    cancelAnimationFrame(raf); raf = 0; mouse = null; cats = [];
    if (layer) { layer.remove(); layer = null; } if (styleEl) { styleEl.remove(); styleEl = null; }
  }

  function sync(th) {
    const on = !th || th.kd !== false;
    let want = on ? (th && Array.isArray(th.kl) && th.kl.length ? th.kl.filter(i => IDS.includes(i)) : ['zencefil']) : [];
    want = [...new Set(want)].slice(0, MAX);
    if (!want.length) return stop();
    start();
    cats = cats.filter(c => want.includes(c.id) || (c.el.remove(), false));
    want.forEach(id => { if (!cats.some(c => c.id === id)) addCat(id); });
  }

  document.addEventListener('pointermove', e => { ptr.x = e.clientX; ptr.y = e.clientY; ptr.t = performance.now(); }, { passive: true });
  document.addEventListener('pointerdown', e => { // dokunmatik ekranda kediye dokununca sevilir (tıklama yine de altındaki öğeye gider)
    ptr.x = e.clientX; ptr.y = e.clientY; ptr.t = performance.now();
    for (const c of cats) if (ptr.x > c.x + SZ * .15 && ptr.x < c.x + SZ * .85 && ptr.y > c.y + SZ * .1 && ptr.y < c.y + SZ * .95) pet(c, 1.8);
  }, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else if (layer) { last = performance.now(); raf = requestAnimationFrame(loop); }
  });

  window.Kedi = { sync, types: TYPES, max: MAX, mouse: spawnMouse };
})();
