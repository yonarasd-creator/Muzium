# 🎵 Yoni v2


Kişiselleştirilebilir müzik çalar: hesap/giriş, Discord tarzı profiller, arkadaşlar, anlık mesajlaşma, şarkı paylaşımı ve tamamen özel temalar (arka plan görseli/videosu dahil).

## KOLAY KURULUM EN ALTTA

## Hızlı kurulum
1. **Node.js 18+** kur (nodejs.org → LTS).
2. Klasörde terminal aç (VS Code: *Terminal > New Terminal*):
   ```
   npm install
   npm start
   ```
   (Windows'ta `start.bat`, Mac/Linux'ta `./start.sh` çift tıklama/tek komutla aynı işi yapar.)
3. Tarayıcıda **http://localhost:3000** aç → *Hesap oluştur*.
4. Telefon/başka bilgisayar: aynı Wi‑Fi'dayken sunucunun yazdığı `http://192.168.x.x:3000` adresini aç. Chrome/Edge/Safari'de **"Uygulama olarak yükle / Ana ekrana ekle"** ile uygulama gibi kurulur.

## Özellikler
- **Hesap:** kullanıcı adı + şifre (scrypt ile hashlenir), 30 günlük oturum, giriş denemesi sınırı. "Hesapsız devam" ile yalnızca yerel çalar da kullanılabilir.
- **Profil:** görünen ad, durum, biyografi, profil rengi, profil fotoğrafı, kapak görseli. Görseller tarayıcıda küçültülür (256px / 960×320).
- **Sosyal:** kullanıcı ara → arkadaş ekle/kabul et, çevrimiçi durumu, "🎧 şu an dinliyor", anlık mesajlaşma (WebSocket), okunmamış rozeti.
- **Şarkı paylaşma:** her şarkıdaki **↗** ile arkadaşına gönder; alıcı sohbetten çalar veya listesine ekler.
- **Tema:** 6 hazır tema, 4 renk, köşe yuvarlaklığı, yazı boyutu, panel opaklığı, karartma, bulanıklık, **kendi arka plan görselin veya videon**, tema dışa/içe aktarma. Renk ve ayarlar hesabına senkronlanır; arka plan dosyası yalnızca o cihazda kalır.
- **Müzik:** Audius + Jamendo + Internet Archive araması, indir/çevrimdışı dinle, kendi mp3 dosyaların, Spotify/YT/Apple liste içe aktarma (CSV), karışık/tekrar, tam ekran oynatıcı, ses ayarı.

## Performans notları
- Tema değişiklikleri yalnızca CSS değişkenleri ile yapılır (yeniden çizim yok), kaydırıcılar `requestAnimationFrame` ile sınırlıdır.
- Arka plan görseli 1920px'e küçültülüp WebP yapılır; video en fazla 40 MB, sessiz/döngülü oynar, **sekme gizlenince durur**, "hareketsiz" seçeneği ve sistemin "hareketi azalt" ayarına uyar.
- Bulanıklık varsayılan **kapalı** (zayıf cihazlarda yavaşlatabilir).
- Sunucu tek süreçte, veriyi bellekte tutar ve diske gecikmeli/atomik yazar; arkadaş grubu ölçeği (onlarca‑yüzlerce kişi) için uygundur.

## Klasör yapısı
```
server/index.js   Sunucu (API + WebSocket + veri)
public/           İstemci: index.html (tüm arayüz), sw.js, manifest, ikon
test/test.js      Sunucu uçtan uca testi   → npm test
test/ui.test.js   Arayüz duman testi       → npm run test:ui (npm install gerekir)
data/             Çalışırken oluşur: db.json + yüklenen profil görselleri (yedeklenecek klasör bu)
```
VS Code'da `public/index.html` düzenle → sayfayı yenile. Sunucu için `npm run dev` (otomatik yeniden başlar) veya **F5**.

## Ayarlar (ortam değişkenleri)
`PORT` (3000) · `DATA_DIR` (./data) · `TRUST_PROXY=1` (ters vekil/HTTPS arkasında).

## İnternete açmak (arkadaşların farklı ağdan girsin)
Sunucuyu bir bilgisayarda/VPS'te çalıştır ve **HTTPS** arkasına koy (Caddy, Nginx veya ücretsiz Cloudflare Tunnel: `cloudflared tunnel --url http://localhost:3000`). HTTPS olmadan şifreler açık gider; yalnızca ev ağında kullanacaksan gerekmez. Docker: `docker build -t muzigim . && docker run -p 3000:3000 -v muzigim-data:/data muzigim`.

## Bilinen sınırlar
- Kaynaklar bağımsız/ücretsiz lisanslı müziktir; Spotify/Apple/YT Music şarkıları DRM nedeniyle çalınamaz.
- Parolayı sıfırlama ve e‑posta yok (basit hesap sistemi). Sohbet yalnızca arkadaşlar arasında.
- Windows `.exe` / Android `.apk` paketleri bu sürümde yok; tarayıcıdan "uygulama olarak yükle" kullanılır.

## Masaüstü uygulaması (Windows / Mac / Linux) 
- Denemek için: `npm install` → `npm run app`
- Kurulum dosyası üretmek için: Windows'ta `kurulum-dosyasi-olustur.bat` çift tıkla (Mac/Linux: `./kurulum-dosyasi-olustur.sh`). Sonuç `dist/` klasöründe.
- Pencereyi kapatınca uygulama sistem tepsisine iner. Genel kısayollar: **Ctrl+Alt+M** mini oynatıcı · **Ctrl+Alt+Boşluk** oynat/duraklat · **Ctrl+Alt+←/→** önceki/sonraki.
- Veriler kullanıcı klasöründe tutulur; sunucu 38123 portunda çalışır (`MUZIGIM_PORT`, başka sunucuya bağlanmak için `MUZIGIM_URL`).

## Hazır indirmek icin (Exe dosyası)
 <img width="223" height="142" alt="image" src="https://github.com/user-attachments/assets/0ff0e589-396f-4c4e-93c1-d6b7e6a6df98" /> 
 girdikten sonra exe dosyasını indrip kurun guncellemlerı denetleyerek guncel halde kullanbılrısnız

## Otomatik güncelleme
Kurulu masaüstü uygulaması açılışta ve her 6 saatte bir GitHub Releases'i denetler; yeni sürüm varsa indirir ve "Şimdi yeniden başlat" diye sorar. Elle denetlemek için sistem tepsisi menüsünde **Güncellemeleri denetle**.
Yeni sürüm yayınlamak için: `package.json`'daki `version` değerini artır → GitHub'da `v<sürüm>` etiketiyle Release oluştur (örn. `v2.4.0`); derleme otomatik yapılır.

## 10 Kasım anma ekranı
Her yıl 10 Kasım'da uygulama açılırken Atatürk'ü anan kısa bir video gösterilir. İlk 5 saniye geçilemez, sonra **Geç** düğmesi açılır; video bitince de kendiliğinden kapanır. Denemek için adrese `?anma=1` ekle (örn. `http://localhost:3000/?anma=1`). Video: `public/anma/ataturk.mp4`.

## Kediler 🐱
Ayarlar → **Kediler** bölümünden açılıp kapatılır; 9 türden (zencefil, kahve, gece, pamuk, alaca, smokin, tüylü, sütlü, tekir) en fazla 3 kedi seçilir.
Kediler arayüzün **tamamında** gezer: sayfadaki kutu kenarlarını ve çizgileri zemin olarak tarar, üstünde yürür, bir kenardan diğerine zıplar, aşağı atlar, pencere kenarına tırmanır, kutunun ucunda **kuyruğu sarkıtarak uyur**, tımar eder, esner, gerinir, imlece bakar, arada fare kovalar; üzerine gelince sevilir, müzik çalarken oturanlar sallanır. Tıklamayı engellemezler, "hareketi azalt" ayarında zıplamaz/tırmanmazlar.
**Mod menüsü:** kediye sağ tıkla (dokunmatikte uzun bas) → "Bugün modun ne?" → Sakin, Enerjik, Odak, Hüzünlü, Eğlenceli, Gece, Yürüyüş. Kedi o moda uyan bir şarkı önerir (**Çal**, **Playlist yap**, **Başka**, **Uymuyor**). Öneriler dinleme geçmişinden (mod seçiliyken dinlediklerin 6 saat boyunca o moda sayılır), şarkı adı/sanatçı anahtar kelimelerinden ve eksik kalırsa arama kaynaklarından gelir; "Uymuyor" dediğin şarkı o modda bir daha önerilmez.
Çizim PNG değil, her karede iskeletten (gövde, kafa, bacak, kuyruk) kodla yapılır: `public/kedi-art.js` (çizim), `public/kedi.js` (davranış). Yeni tür için `kedi-art.js` içindeki `T` tablosuna renk paleti ekle.

## Hareketli profil fotoğrafı ve videolu kapak
Profil → Fotoğraf: JPG, PNG veya hareketli GIF/WebP (en fazla 120 MB). Profil → Kapak: görsel, GIF/WebP veya MP4/WebM video (en fazla 40 MB; sessiz ve döngüde oynar, "hareketi azalt" açıksa düz renk görünür). Dosyalar ham yüklenir (`PUT /api/me/media/:kind`), türü sihirli baytlarla doğrulanır.

## YouTube hesabını bağlama (Google ile giriş)
Ayarlar (⚙) → **YouTube hesabı** → "Google ile giriş yap". Kullanıcı sadece Google'da giriş yapar; beğendiği müzikler ve playlistler listelerine aktarılır, YouTube aramaları kendi hesabıyla yapılır (API anahtarı gerekmez), kediler beğenilenlerden şarkı önerir. Jetonlar yalnızca kullanıcının cihazında tutulur.

**Uygulama sahibinin tek seferlik kurulumu** (kullanıcılar bunu yapmaz):
1. console.cloud.google.com → proje oluştur → **YouTube Data API v3**'ü etkinleştir.
2. OAuth izin ekranı: *Harici*; "Test kullanıcıları"na hesapları ekle (doğrulama olmadan en fazla 100 kişi).
3. Kimlik bilgileri → OAuth istemci kimliği → *Web uygulaması*; yetkili yönlendirme URI'si: `http://localhost:38123/api/yt/callback` (masaüstü) ve varsa kendi sunucu adresin için `https://alanadin/api/yt/callback`.
4. Çıkan Client ID ve Secret'ı **depoya yazma** (GitHub push koruması engeller). GitHub → Settings → Secrets and variables → Actions → *New repository secret* ile `GOOGLE_CLIENT_ID` ve `GOOGLE_CLIENT_SECRET` adıyla ekle; sürüm derlenirken `server/google.json` otomatik oluşturulur ve uygulamayla paketlenir. Yerelde denemek için aynı adlı ortam değişkenlerini ver.
5. Yayınlamak için OAuth izin ekranında ana sayfa ve gizlilik politikası adresi gerekir: ana sayfa `https://github.com/yonarasd-creator/Yoni`, gizlilik `https://github.com/yonarasd-creator/Yoni/blob/main/PRIVACY.md`. Masaüstü tipi uygulamalarda Google bu secret'ı gizli saymaz, yine de depo herkese açıksa repoya yazmak yerine yalnızca derleme sırasında dosyayı ekleyebilirsin.
