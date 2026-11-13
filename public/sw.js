const C='muzigim-v13',FILES=['./','index.html','manifest.webmanifest','icon.png','logos/logo-1.png','logos/logo-2.png','logos/logo-3.png','logos/logo-4.png','logos/logo-5.png','logos/logo-6.png','logos/logo-7.png','anma.js','kedi-art.js','kedi.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(FILES)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!=C).map(x=>caches.delete(x)))));self.clients.claim()});
self.addEventListener('fetch',e=>{
 const u=new URL(e.request.url);
 if(e.request.method!='GET'||u.origin!=location.origin||u.pathname.startsWith('/api')||u.pathname.endsWith('.mp4'))return; // müzik/API istekleri doğrudan ağa gider
 e.respondWith(fetch(e.request).then(r=>{const cp=r.clone();caches.open(C).then(c=>c.put(e.request,cp));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('index.html'))));
});
