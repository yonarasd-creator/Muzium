// 10 Kasım anma ekranı: uygulama açılırken Atatürk'ü saygıyla anan kısa bir video gösterir.
// Yalnızca her yıl 10 Kasım'da çalışır (denemek için adrese ?anma=1 ekle). İlk 5 saniye geçilemez, sonra "Geç" açılır.
(() => {
  const q = new URLSearchParams(location.search), now = new Date(), force = q.has('anma');
  if (!force && !(now.getMonth() === 10 && now.getDate() === 10)) return;
  try { if (!force && sessionStorage.getItem('anma10')) return; sessionStorage.setItem('anma10', '1'); } catch {}
  const WAIT = 5;

  const st = document.createElement('style');
  st.textContent = `
#anma{position:fixed;inset:0;z-index:2147483000;background:#000;color:#f4f1ea;display:flex;flex-direction:column;align-items:center;
 font-family:Georgia,'Times New Roman',serif;opacity:0;animation:an-in 1.4s ease forwards;padding:env(safe-area-inset-top,0) 0 env(safe-area-inset-bottom,0)}
#anma.out{animation:an-out .9s ease forwards}
#anma .an-bg{position:absolute;inset:0;background:url(anma/poster.jpg) center/cover;filter:blur(46px) brightness(.32) saturate(1.1);transform:scale(1.15)}
#anma .an-bg:after{content:"";position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 35%,#000 100%)}
#anma .an-vid{position:relative;flex:1;min-height:0;width:100%;display:flex;justify-content:center;padding:4vh 4vw 0}
#anma video{max-width:100%;max-height:100%;object-fit:contain;border-radius:10px;box-shadow:0 18px 70px rgba(0,0,0,.75);
 opacity:0;transform:scale(.97);animation:an-vid 1.6s .5s ease forwards;background:#000}
#anma .an-txt{position:relative;text-align:center;padding:16px 20px 6px;opacity:0;transform:translateY(10px);animation:an-txt 1.4s 1.3s ease forwards}
#anma h1{margin:0;font-weight:400;font-size:clamp(22px,3.6vw,34px);letter-spacing:.05em}
#anma p{margin:10px auto 0;max-width:640px;font:clamp(13px,1.7vw,16px)/1.6 Georgia,'Times New Roman',serif;color:#d9d4c8}
#anma .an-sig{margin:12px 0 0;font:italic clamp(12px,1.5vw,14px)/1.4 Georgia,serif;letter-spacing:.06em;color:#a9a496}
#anma .an-line{width:56px;height:2px;background:#e30a17;margin:14px auto 0;border-radius:2px;transform:scaleX(0);animation:an-line 1s 1.9s ease forwards}
#anma .an-bar{position:relative;height:84px;display:flex;align-items:center;justify-content:center;gap:12px}
#anma button{font:14px system-ui,sans-serif;color:#f4f1ea;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.22);border-radius:999px;
 padding:9px 18px;cursor:pointer;display:inline-flex;align-items:center;gap:9px;transition:background .2s,opacity .3s,transform .2s}
#anma button:hover:not(:disabled){background:rgba(255,255,255,.18);transform:translateY(-1px)}
#anma button:disabled{opacity:.55;cursor:default}
#anma button:focus-visible{outline:2px solid #fff;outline-offset:3px}
#anma svg{width:24px;height:24px;transform:rotate(-90deg)}
#anma svg circle{fill:none;stroke-width:2.5}
#anma .trk{stroke:rgba(255,255,255,.2)}
#anma .prg{stroke:#e30a17;stroke-dasharray:69.1;stroke-dashoffset:69.1;animation:an-ring ${WAIT}s linear forwards}
#anma.ready svg{display:none}
@keyframes an-in{to{opacity:1}}@keyframes an-out{from{opacity:1}to{opacity:0}}
@keyframes an-vid{to{opacity:1;transform:none}}@keyframes an-txt{to{opacity:1;transform:none}}
@keyframes an-line{to{transform:scaleX(1)}}@keyframes an-ring{to{stroke-dashoffset:0}}
@media (prefers-reduced-motion:reduce){#anma,#anma video,#anma .an-txt,#anma .an-line{animation-duration:.01s;animation-delay:0s}}`;
  document.head.appendChild(st);

  const el = document.createElement('div');
  el.id = 'anma'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', '10 Kasım anma');
  el.innerHTML = `<div class="an-bg"></div>
<div class="an-vid"><video playsinline preload="auto" poster="anma/poster.jpg" src="anma/ataturk.mp4"></video></div>
<div class="an-txt"><h1>Minnetle Anıyoruz</h1>
<p>10 Kasım, yalnızca bir yas günü değil; Atatürk’ün fikirlerini, ilke ve inkılaplarını yaşatma sorumluluğumuzu hatırladığımız gündür. Saygı, özlem ve minnetle anıyoruz. Daima izindeyiz, Atam...</p>
<div class="an-line"></div><div class="an-sig">1881 – Sonsuzluğa uzanan bir miras.</div></div>
<div class="an-bar"><button class="an-snd" hidden>🔊 Sesi aç</button>
<button class="an-skip" disabled><svg viewBox="0 0 24 24"><circle class="trk" cx="12" cy="12" r="11"/><circle class="prg" cx="12" cy="12" r="11"/></svg><span>Geç (${WAIT})</span></button></div>`;
  document.body.appendChild(el);

  const v = el.querySelector('video'), skip = el.querySelector('.an-skip'), snd = el.querySelector('.an-snd'), lbl = skip.querySelector('span');
  let ready = false, closed = false, left = WAIT;
  const close = () => {
    if (closed || !ready) return; closed = true;
    document.removeEventListener('keydown', onKey, true);
    el.classList.add('out'); try { v.pause(); } catch {}
    setTimeout(() => { el.remove(); st.remove(); }, 950);
  };
  const onKey = e => { // süre dolmadan hiçbir tuş altındaki uygulamaya ulaşmasın
    if (!ready) { e.preventDefault(); e.stopPropagation(); return; }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
  };
  document.addEventListener('keydown', onKey, true);
  skip.addEventListener('click', close);

  const tick = setInterval(() => {
    left--;
    if (left > 0) { lbl.textContent = `Geç (${left})`; return; }
    clearInterval(tick); ready = true; el.classList.add('ready'); skip.disabled = false; lbl.textContent = 'Uygulamaya geç  ›'; skip.focus();
  }, 1000);

  v.addEventListener('ended', () => { ready = true; clearInterval(tick); close(); });
  v.play().catch(() => { // tarayıcı sesli otomatik oynatmayı engellerse sessiz başlat, sesi açma düğmesi göster
    v.muted = true; v.play().catch(() => {}); snd.hidden = false;
  });
  snd.addEventListener('click', () => { v.muted = false; v.play().catch(() => {}); snd.hidden = true; });
})();
