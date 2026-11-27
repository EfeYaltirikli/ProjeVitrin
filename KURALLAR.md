# ProjeVitrin · Proje kuralları

Bu dosya, her oturumda önce okunur. Kullanıcıyla netleşmiş kararlar burada; yeni bir karar alınınca buraya eklenir.

## 1. Kapsam
- **Ürün:** İnşaat firmalarının web sitesini, etkileşimli proje vitrinine çevirmek. İlk müşteri: Sarıpekmez İnşaat (Eskişehir). Başka firmalara da satılacak, bu yüzden motor firmaya bağımlı olmamalı.
- **Sarıpekmez sitesi** (`siteler/saripekmez/`) şu bölümlerden oluşur: Ana sayfa, Projeler (41 tamamlanmış proje, filtreli, her birinin detay sayfası), Kurumsal (tarihçe, misyon ve vizyon tek sayfada), Petrol, Haberler, İletişim.
- **Boş kategoriler:** "Başlayan" ve "Devam eden" projeler "Yakında duyurulacak" olarak görünür; içi boş liste gösterilmez.
- **3D tur yalnız 71 Evler Kocakaya · C Blok 1 nolu daire** için yapılır (karar: 28.11.2026). Diğer projelere 3D eklenmez.
- **Sadelik:** Kafa karıştıran ayrıntı gösterilmez. Çerez/KVKK metinleri yalnız footer bağlantısı olarak kalır.

## 2. Görseller
- Firmanın kendi proje fotoğrafları kullanılır: sitesinden **yerel kopyalanır**, WebP'ye çevrilir, hotlink yapılmaz. Yayından önce firmadan **yazılı izin** alınacak.
- Claude bu fotoğrafları yalnız düzenler (kırpma, boyutlandırma, renk ve ton eşitleme). İçerik uydurmaz, yapay zekâ render'ı veya Higgsfield kullanılmaz.
- 3D sahneler ve diyagramlar kodla, veriden üretilir. Stok fotoğraf kullanılmaz.
- Görsellerin altına açıklama yazılmaz (taste-skill kural 1).

## 3. taste-skill (design-taste-frontend)
- Kurulum: `.claude/skills/design-taste-frontend` (yalnız bu projede). Kaynak ve sürüm bilgisi `KAYNAK.txt`'de.
- Node 22: `~/.local/bin/node`. PATH'te yok, bu yüzden komutlar tam yolla çalıştırılır. Skill'in Stop hook'u bu yolu kullanacak şekilde yamalandı (SKILL.md, tek satır).
- Tarayıcı: `CHROME_PATH="$HOME/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"`
- Skill kurallarının tamamı uygulanır. **Bilinçli istisnalar** (`.taste-skill/waivers.json` dosyasına gerekçesiyle yazılır):
  - Kural 9 (gerçek telefon ve adres yasağı): Bu gerçek bir firma sitesi. Firmanın kendi telefonu ve adresi yazılır.
  - Stok veya yedek fotoğraf yok: firmanın kendi fotoğrafları kullanılır.
  - Metinler Türkçedir; copy-lint'in İngilizce sözcük kuralları Türkçe metinde yanlış alarm verirse muaf tutulur.
- Kit dosyaları (`assets/`, `scripts/`) düzenlenmez.

## 4. Geometri ve ölçü (3D ve kroki)
- Koordinatlar plan metresi: x sağa, z aşağı (güneye) doğru artar. Duvarlar orta çizgiyle verilir; uç noktalar diğer duvarın orta çizgisinde biter.
- Ölçek, satış planındaki oda m²'lerinden kalibre edilir. Hesaplanan oda alanı ile plandaki etiket arasındaki fark **en fazla %8** olmalı; daha fazlası uyarı verir.
- Kapı kanadı **oda adıyla** açılır (`yon`), menteşe tarafı gerekirse `mente: "a"` ile değiştirilir. Kapının süpürme alanı mobilyaya, başka bir kapıya veya kameraya çarpmamalı.
- Mobilya kendi odasının içinde kalır, duvara veya başka mobilyaya girmez (5 cm tolerans).
- **Kroki 3D görünümü:** Model ölçeklenmez; **yatay kesit** alınır (1,2 m). Kesitte duvarlar koyu poşe görünür; kapı ve pencere üstündeki lentolar görünmez.
- **Maket görünümü:** Kesit 2,05 m. Kapı üstü lentolar açıklıkların üstünde "kiriş" gibi görünmesin diye kesilir.
- Kroki (2D) kuralları: kapı yayı kesik çizgiyle çizilir, mobilya ve etiketlerin altında kalır; etiketler kapı yayıyla çakışırsa kaydırılır.
- Her değişiklikten sonra `araclar/dogrula.py` çalıştırılır (alan, çakışma, kapı süpürme alanı). Hata varsa teslim edilmez.

## 5. Test ve teslim
- Sayısal kontrol: `araclar/dogrula.py`. Görsel kontrol: `araclar/kontrol.py` (başsız Chromium, 1440 ve 390 genişlikte ekran görüntüsü). Ekran görüntüleri tek tek açılıp bakılır; `screencapture` kullanılmaz.
- Site için ek olarak taste-skill kalite kapısı çalıştırılır: `gate.mjs`, sonucu raporda.
- Sunum kullanıcının dizüstünden yapılır: `Sunumu Aç.command` (yerel sunucu, 8765 portu).

## 6. Site yapısı ve üretim (28.11.2026)
- `siteler/saripekmez/` statik site. **Elle düzenlenmez**; `python3 araclar/site_uret.py` ile `veri/projeler.json` ve `veri/site.json` dosyalarından üretilir.
- Fotoğraflar: `araclar/foto_indir.py` (indir ve WebP'ye çevir) + `araclar/foto_temizle.py` (yan dolguyu kırp, ton ve netlik). Kat planları kırpılmaz. %15'ten az kırpılacak fotoğrafa dokunulmaz.
- Proje adlarındaki kısaltmalar açılır (Mah. → Mahallesi, Sk. → Sokak).
- Harita konumları **mahalle merkezi** düzeyindedir (OSM Nominatim, Eskişehir sınırıyla kısıtlı); sayfada bu belirtilir.
- taste-skill deal (28.11): hero split, nav-split, close-photo, footer-dark, rhythm dark-band, butonlar arrow, Red Hat yazı tipleri, firma renkleri (zemin #efe9e0, vurgu lacivert #353a4a; sarı yalnız logoda, çünkü açık zeminde kontrastı 1,6:1).
- photo-chapters anı kullanılmadı: firmanın fotoğrafları 820 px, tam genişlikte bulanıklaşıyor. Yerine 4'lü adım şeridi var.
- Gate sonucu (index.html): **OPEN 2** (3 tur doldu): card-layout (#insaat) ve section-gaps (telefonda petrol/haberler). Muafiyetler `.taste-skill/waivers.json` dosyasında (telefon ×2, hero-lines, copy-headings Türkçe).
- Başlatıcı: `Sunumu Aç.command` siteyi açar (port doluysa mevcut sunucuyu kullanır).
- **3D tur sitenin içinde** (28.11): `proje/71-evler-mah-kocakaya-sokak.html#tur`. Kod `engine/app.js → mountTour()`, stil `engine/tur.css` (`.pv-tourhost` kapsamlı, sitenin token'larıyla). Aynı sayfada 6 daire tipinin listesi var. Eski bağımsız sayfa (`projeler/saripekmez-71-evler/`) yalnız motor demosu olarak kaldı; siteden bağlantı verilmiyor.
- Kural: Firma sitesine eklenen her bileşen sitenin menüsü, altbilgisi ve token'larıyla gelir; ayrı tasarımlı bir sayfaya çıkılmaz.

## 7. Ticari
- Fiyat önerisi (28.11.2026): kurulum 35.000 TL + KDV (1 daire 3D dahil), ek 3D daire 7.500 TL, barındırma ve güncelleme ayda 1.500–2.500 TL. İlk müşteriye referans karşılığında %20 indirim pazarlık payı.

## 8. Açık maddeler
- B Blok 1 nolu dairenin salon alanı (23 mü 29 mu) firmadan teyit edilecek.
- 71 Evler Kocakaya'nın kesin parsel konumu firmadan teyit edilecek (şu an mahalle merkezi gösteriliyor).
- Logo ve fotoğrafların kullanımı için yazılı izin alınacak.
- İnşaat birimine ait e-posta adresi yok (sitede yalnız petrol@ adresi var).
- Telefonda bazı bölümlerin altında boşluk var (skill'in bölüm = en az 1 ekran kuralı). İstenirse telefonda bu kural gevşetilebilir.
- Firmanın fotoğrafları düşük çözünürlüklü (850 px); daha büyük orijinaller alınırsa görsel kalite belirgin artar.
