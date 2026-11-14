# Kol + ekran sistemi

Ana oyundan bağımsız çalışan, tam kaynak kodlu bilek terminali demosu.

## Çalıştır

Node.js kurulu bilgisayarda bu klasörün içinde:

```sh
npm install
npm run dev
```

Terminalde verilen adresi aç. HTML dosyasına çift tıklamak yeterli değildir. Üretim derlemesi: `npm run build`.

## Dosyalar

- `main.js`: Alt tuşu, ekran açma/kapama, örnek veriler ve oyun veri bağlantısı.
- `wrist-scene.js`: Gerçek astronot kolu, ekran/kasa/kayış geometrisi, kamera ve kol animasyonu.
- `terminal-template.html`: Kullanıcının HTML tasarımından uyarlanan turuncu ekran.
- `terminal-texture.js`: HTML ekranını Three.js kaplamasına dönüştürür ve değerleri günceller.
- `terminal-input.css`, `terminal-generated.css`, `tailwind.config.cjs`: Ekran stilleri.
- `public/models/astronaut.stl`: Kullanılan astronot modeli. Kaynak bilgisi yanındaki README içindedir.

## Kontroller

Alt: 3D görünümü aç / kolu kaldır / indir. Esc: kolu indir. Menüye dön: sahneden çık. Bileğe bak: dokunmatik alternatif.

## Kendi oyununa bağla

`main.js` içindeki `mission` nesnesini kendi oyun verilerinle besle veya dosyada örneği verilen `wrist-data` olayını gönder. Kaynak anahtarları: `energy`, `water`, `oxygen`, `food`. Her biri 0–100 oyun birimidir. `mission` aktif görev başlığı, `objective` görev hedefidir.

`createWristScene(host, getData)` bir HTML kapsayıcısı ve güncel veriyi döndüren fonksiyon alır. Dönen denetleyici: `start()`, `stop()`, `raise(true/false)`, `toggle()`, `update()`, `dispose()`. Sahne belirli DOM kimliklerini kullanır; örnek index.html içindeki model-status, model-retry ve mobile-wrist öğelerini de koru.

Bu sürüm kendi renderer ve kamerasını oluşturur. Mevcut başka bir Three.js sahnesine gömmek için wrist-scene.js içindeki rig grubunu o sahnenin kamerasına taşımak gerekir. STL kemiksizdir; ön kol tek grup olarak hareket eder. Dalga çizimleri dekoratiftir.
