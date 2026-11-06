// Arayüz duman testi (jsdom, gerçek sunucuya karşı): npm run test:ui
require('fake-indexeddb/auto');
const {JSDOM}=require('jsdom'),fs=require('fs'),os=require('os'),path=require('path'),WS=require('ws'),{spawn}=require('child_process');
const PORT=4222,B='http://127.0.0.1:'+PORT,DATA=fs.mkdtempSync(path.join(os.tmpdir(),'ui-'));
const srv=spawn(process.execPath,[path.join(__dirname,'../server/index.js')],{env:{...process.env,PORT,DATA_DIR:DATA}});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let cookie='',errs=[],ok=0,bad=0;
const t=(n,c)=>{c?ok++:bad++;console.log((c?'✓ ':'✗ ')+n)};
srv.stdout.once('data',async()=>{
 const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
 const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:B+'/',beforeParse(w){
  w.indexedDB=indexedDB;w.IDBKeyRange=IDBKeyRange;w.HTMLMediaElement.prototype.play=()=>Promise.resolve();w.HTMLMediaElement.prototype.pause=()=>{};
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
  w.matchMedia=()=>({matches:false});w.createImageBitmap=async()=>({width:100,height:100});
  w.fetch=async(u,o={})=>{u=String(u);if(!u.startsWith('http'))u=B+u;
   if(u.includes('audius')||u.includes('jamendo')||u.includes('archive.org'))return{ok:true,json:async()=>({data:[{id:'D7KyD',title:'Şarkı',user:{name:'Biri'},artwork:{}}]})};
   const r=await fetch(u,{...o,headers:{...(o.headers||{}),cookie}});const sc=r.headers.get('set-cookie');if(sc)cookie=sc.split(';')[0];return r};
  w.WebSocket=class extends WS{constructor(u){super(u,{headers:{cookie}})}};w.Element.prototype.scrollIntoView=()=>{};w.URL.createObjectURL=()=>'blob:x';w.URL.revokeObjectURL=()=>{};
  w.addEventListener('error',e=>errs.push(e.message))}});
 const w=dom.window,d=w.document;await sleep(400);
 t('giriş ekranı görünür',!d.querySelector('#auth').hidden);
 d.querySelector('#sw').click();d.querySelector('#lu').value='deniz';d.querySelector('#lp').value='sifre123';d.querySelector('#go').click();await sleep(700);
 t('kayıt sonrası uygulama açılır',d.querySelector('#auth').hidden&&d.querySelectorAll('.row').length>0);
 for(const v of['soc','thm','me','ara','list','imp']){d.querySelector(`[data-v=${v}]`).click();await sleep(250);t('sekme: '+v,d.querySelector('main').innerHTML.length>50)}
 d.querySelector('[data-v=thm]').click();await sleep(200);d.querySelector('[data-p="4"]').click();await sleep(100);
 t('tema ön ayarı uygulanır',w.document.documentElement.style.getPropertyValue('--a')=='#0d9488');
 const rg=d.querySelector('[data-k=r]');rg.value=20;rg.dispatchEvent(new w.Event('input',{bubbles:true}));await sleep(100);
 t('köşe ayarı canlı değişir',w.document.documentElement.style.getPropertyValue('--r')=='20px');
 const bl=d.querySelector('[data-k=bl]');bl.value=8;bl.dispatchEvent(new w.Event('input',{bubbles:true}));await sleep(100);
 t('bulanıklık yalnızca >0 iken açılır',w.document.documentElement.classList.contains('bl'));
 await sleep(1300);const me=await (await fetch(B+'/api/me',{headers:{cookie}})).json();
 t('tema hesaba senkronlanır',me.user.theme?.a=='#0d9488'&&me.user.theme.r==20);
 // arka plan görseli
 const f=new (require('buffer').Blob)([new Uint8Array(10)],{type:'video/webm'});const inp=d.querySelector('#bf');Object.defineProperty(inp,'files',{value:[f]});inp.dispatchEvent(new w.Event('change'));await sleep(400);
 t('video arka plan eklenir',!!d.querySelector('#bg video')&&w.document.documentElement.style.getPropertyValue('--s').includes('80%'));
 // profil
 d.querySelector('[data-v=me]').click();await sleep(200);d.querySelector('#pd').value='Deniz D.';d.querySelector('#pbio').value='Merhaba';d.querySelector('#sv').click();await sleep(400);
 t('profil kaydedilir',(await (await fetch(B+'/api/me',{headers:{cookie}})).json()).user.display=='Deniz D.');
 // ikinci kullanıcı + arkadaşlık + anlık mesaj
 const j={'Content-Type':'application/json'};let r=await fetch(B+'/api/register',{method:'POST',headers:j,body:JSON.stringify({username:'ece',password:'sifre123'})});const ck2=r.headers.get('set-cookie').split(';')[0];
 await fetch(B+'/api/friends',{method:'POST',headers:{...j,cookie:ck2},body:JSON.stringify({username:'deniz'})});
 await fetch(B+'/api/friends',{method:'POST',headers:{...j,cookie},body:JSON.stringify({username:'ece'})});await sleep(400);
 d.querySelector('[data-v=soc]').click();await sleep(300);
 t('arkadaş listede görünür',d.querySelector('#sc').textContent.includes('ece'));
 await fetch(B+'/api/messages/deniz',{method:'POST',headers:{...j,cookie:ck2},body:JSON.stringify({text:'Selam!',att:{type:'track',track:{id:'aD7KyD',title:'Şarkı',artist:'Biri',aid:'D7KyD',art:'https://a.b/c.jpg'}}})});await sleep(400);
 t('okunmamış rozeti çıkar',d.querySelector('[data-v=soc] .bd')?.textContent=='1');
 d.querySelector('.row .i').click();await sleep(500);
 t('sohbet açılır, mesaj + şarkı görünür',d.querySelector('.msg')?.textContent.includes('Selam')&&!!d.querySelector('[data-ct]'));
 d.querySelector('[data-ct] .i').click();await sleep(300);
 t('paylaşılan şarkı çalar',d.querySelector('#au').src.includes('/tracks/D7KyD/stream'));
 d.querySelector('#mi').value='Teşekkürler';d.querySelector('#sd').click();await sleep(400);
 t('mesaj gönderilir',[...d.querySelectorAll('.msg.me')].some(x=>x.textContent.includes('Teşekkürler')));
 console.log('JS hataları:',errs.length?errs:'yok');console.log(`\n${ok} geçti, ${bad} kaldı`);srv.kill();process.exit(bad||errs.length?1:0)});
