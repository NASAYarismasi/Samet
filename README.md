# ARES — Mars Koloni Görevi

Türkçe, tarayıcıda çalışan uzay görevi oyunu prototipi. `index.html` dosyasını tarayıcıda açarak çalıştırabilirsiniz. Kurulum veya derleme gerekmez. İsteğe bağlı yerel sunucu: `python -m http.server 4173`.

## Bu sürüm

- Ana menü ve görev kontrol paneli.
- Sıralı dört aşama: hazırlık, yolculuk, iniş, koloni.
- Dört astronot, ekip seçimi ve kaynaklara uygulanan uzmanlık bonusları.
- Ortak oksijen, su, enerji, gıda ve malzeme rezervleri.
- Tarayıcıda otomatik kayıt ve onaylı görev sıfırlama.
- Mobil ekranlara uyarlanan tasarım ve klavye ile kullanılabilir kontroller.

Görevi başlatmadan önce ekip seçilebilir. Dört kişi fırlatma için gereklidir; görev başladıktan sonra ekip kilitlenir. Aşamaların üzerinde yazan maliyetler uzmanlık bonusları uygulanmış değerlerdir. Botanikçi koloni aşamasında ayrıca 10 gıda üretir. Görevi başlat düğmesi hazırlığı kilitler; ilk aşama düğmesi fırlatmayı gerçekleştirir.

Bu prototip tek oyunculudur. Ortak kaynaklar aynı ekibin rezervlerini ifade eder; çevrim içi çok oyunculu senkronizasyon içermez. Koordinatlar kurgusal iniş alanını temsil eder. Görev süreleri ve kaynak maliyetleri bilimsel model değildir. Google Fonts bağlantısı kullanılamazsa sistem fontları kullanılır. Kayıt mevcut tarayıcı ve adres için geçerlidir.

## Sonraki geliştirme önerileri

1. Olay kartları: güneş fırtınası, su geri dönüşüm arızası, iniş riski; her kartta maliyeti görünen seçenekler.
2. Koloni inşası: güneş paneli → enerji, sera → gıda, buz çıkarma → su; günlük üretim ve tüketim döngüsü.
3. Görev planlama: yük kapasitesine göre erzak ve ekipman seçimi.
4. Bilim günlüğü: oyun kararlarının arkasındaki gerçek uzay bilimi için kaynaklı kısa açıklamalar.
5. Yarışma puanlaması: hayatta kalma, bilim çıktısı ve sürdürülebilirlik üzerinden görev sonu raporu.

## Kol terminali kontrolleri

Alt: kol ekranını aç/kapat. Terminal açıkken 1: sağlık, 2: yemek, 3: su. Escape veya kapatma düğmesi de terminali kapatır. Mobilde kol ekranı düğmesi ve sekmeler kullanılabilir. Yemek ve su mevcut ortak stoktan okunur; sağlık 3D mürettebat bağlantısı yapılana kadar açıkça etiketlenmiş örnek değerdir. Bu sürümde kol cihazı CSS arayüz prototipidir; henüz 3D astronot modeli yoktur.

### Güncel kol ekranı
Alt ile açılan tek görünümde Batarya, Su, Oksijen, Yiyecek ve Aktif Görev birlikte gösterilir. Önceki sağlık sekmesi ve 1/2/3 sekme kısayolları kaldırıldı. Batarya bu prototipte mevcut ortak enerji rezervini gösterir; bağımsız batarya simülasyonu içermez. Aktif görev mevcut aşamadan okunur.

Kol terminali masaüstünde yataydır ve ekranın alt bölümünde bileğin üstünde görünür. Alt ile açılırken aşağıdan yükselir; Alt/Esc ile kapanır. Dar telefon ekranlarında okunabilirlik için içerik alt alta geçer. Bu görünüm hâlâ CSS prototipidir; 3D karakter koluna bağlanmamıştır.
