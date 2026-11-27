# ProjeVitrin

İnşaat firmalarının proje sayfalarını etkileşimli bir vitrine çeviren motor. Aynı veriden 2D kroki, 3D maket, oda içi tur, daire listesi ve konum haritası üretir.

## Sunumu açmak
`Sunumu Aç.command` dosyasına çift tıklayın. Tarayıcı açılır (http://127.0.0.1:8765/projeler/saripekmez-71-evler/). Kapatmak için terminal penceresini kapatın.
Harita ve yazı tipleri için internet gerekir; 3D modeller internetsiz de çalışır.

## Klasörler
| Klasör | İçerik |
|---|---|
| `engine/` | Motor. `app.js` sayfa, `unit3d.js` 3D daire, `plan2d.js` kroki, `site3d.js` dış maket, `geom.js` ortak geometri, `vitrin.css` stil |
| `vendor/` | three.js 0.170, Leaflet 1.9.4 (yerel kopya) |
| `assets/tex/` | CC0 dokular (Poly Haven) |
| `projeler/<proje>/` | Projeye özel her şey: `index.html`, `proje.json`, `daire-*.json`, `marka/` |
| `araclar/kontrol.py` | Otomatik kontrol: konsol hataları + ekran görüntüleri |

## Yeni proje / yeni firma eklemek
1. `projeler/saripekmez-71-evler` klasörünü kopyalayın, adını değiştirin.
2. `marka/` içine logo ve favicon koyun.
3. `proje.json`: firma bilgileri ve renkler, proje metni, bloklar, daireler (oda listesi), konum ve çevre noktaları, vaziyet (blok kütleleri, sokaklar).
4. 3D gezilecek her daire için bir `daire-XX.json` dosyası oluşturun ve `proje.json` içinde ilgili dairede `"tur3d"` alanına yazın. İçerik: odalar (çokgen, m², kamera noktası), duvarlar (orta çizgi + kalınlık), açıklıklar (kapı/pencere; kapının hangi odaya açıldığı `yon`), mobilya (tip, konum, dönüş). Koordinatlar metre cinsindendir; x sağa, z aşağı doğru artar.
5. Açmak için: `python3 sunucu.py <klasör-adı>`

## 71 Evler: kaynak ve açık maddeler
- Ölçüler firmanın satış planından okundu; ölçek, plandaki oda m²'lerinden kalibre edildi (±10 cm). 3D'deki mobilya ve malzemeler temsilîdir.
- B Blok 1 nolu dairenin salon alanı kaynak görselde net okunmuyor; 23 m² olarak girildi, teyit edilmeli.
- Kesin parsel konumu yok: sokaklar OpenStreetMap'te kayıtlı değil. Haritadaki pin mahalle merkezini gösteriyor (`proje.json → konum.merkez`).
- Dış maketteki blok yerleşimi firmanın vaziyet görselinden yorumlandı; kat sayısı ve düzen doğru, ölçüler temsilî.
- Yayından önce logo ve marka kullanımı için firmadan izin alınmalı.

## Kontrol
`NO_BROWSER=1 python3 sunucu.py &` ile sunucuyu başlatın, sonra `python3 araclar/kontrol.py <çıktı> [genişlik] [yükseklik]` komutunu çalıştırın.
