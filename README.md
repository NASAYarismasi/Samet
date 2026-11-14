# ARES — Mars Koloni Görevi

## Çalıştırma

Node.js ile `npm install`, ardından `npm run dev`. Terminalin yazdığı yerel adresi açın. Üretim derlemesi: `npm run build`. Three.js 0.187.0 ve Vite 8.3.8 sürümleri Emre reposuyla eşleştirilerek sabitlenmiştir. ES modülleri ve model yüklemesi için HTTP sunucusu gerekir; index.html dosyasına çift tıklamak artık yeterli değildir.

## Mevcut sürüm

Ana menü, dört görev aşaması, astronot kartları ve tarayıcıda otomatik kayıt içerir. Görev maliyetleri ve uzmanlık bonusları ortak stoklara uygulanır. Örnek oyun sayıları bilimsel model değildir. README'de istenen üç kişilik ortak iniş JSON entegrasyonu, uçuş/koloni modülleri ve jüri senaryoları henüz tamamlanmamıştır.

## 3D bilek ekranı

- Alt veya kol ekranı düğmesi birinci şahıs Mars görünümünü açar ve kolu kaldırır.
- Sahnedeyken Alt kolu kaldırır/indirir. Esc kolu indirir. Menüye dön düğmesi sahneden çıkar.
- Bileğe bak düğmesi dokunmatik ekranlarda aynı hareketi sağlar.
- Batarya, su, oksijen, yiyecek ve aktif görev yatay küçük ekranda birlikte gösterilir. Batarya mevcut ortak enerji rezervidir.
- Terminalde Alt/Esc ve ortak ekip stoğu yazıları bulunmaz.
- Emre'nin belirtilen STL modelinin gerçek kol geometrisi kullanılır. Ekran, kasa ve kayış kol grubuna bağlı 3D nesnelerdir; veriler CanvasTexture üzerinden çizilir.
- STL kemiksizdir. Bu sürüm rijit kol hareketi kullanan birinci şahıs prototipidir; tam karakter iskeleti, yürüme ve mouse ile çevreye bakma henüz yoktur.
- Model yüklenemediğinde hata ve yeniden deneme düğmesi gösterilir. Sahne menüye dönülünce animasyonu durdurur; sayfa kapanırken GPU kaynakları temizlenir.
- Model kaynağı ve yapılan dönüşümler public/models/README.md içindedir.
