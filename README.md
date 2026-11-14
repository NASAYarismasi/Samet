# Mars’a İlk Koloni — Arayüz ve Entegrasyon

**Sorumlu: Samet**

Uçuş ve koloniyi tek bir 3D web oyununda birleştir. Jüri demosu bu repodan açılacak.

- [ ] Ana menü, görev aşamaları, astronot kartları ve ortak kaynak göstergelerini oluştur.
- [ ] Emre’nin uçuş sonucu ile İhan’ın koloni başlangıcını bağla. Aynı mürettebat, kalan stok ve modüller sahneler arasında korunsun.
- [ ] Koloniden gelen sonuçla görev raporunu göster. Kazanma/başarısızlık nedenleri ile yeniden başlatma düğmesi ekle.
- [ ] İki jüri demosu hazırla. Aynı toz fırtınasını iki farklı batarya seçimiyle oynat ve sonucun değiştiğini göster.

**İlk teslim:** Örnek iniş verisiyle hazırlık → uçuş → koloni → rapor ekranları arasında geçilebilen tek oyun.

## Ortak iniş verisi

Emre üretir, Samet aktarır, İhan koloni başlangıcında okur. İlk entegrasyon için aynı örneği kullanın. Sayılar oyun birimidir.

```json
{
  "crew": [
    { "id": "astronaut-1", "health": 100 },
    { "id": "astronaut-2", "health": 100 },
    { "id": "astronaut-3", "health": 100 }
  ],
  "supplies": { "food": 12, "water": 12, "oxygen": 12, "spareParts": 1 },
  "modules": ["habitat", "solarPanel", "battery", "oxygenUnit", "waterRecycler", "greenhouse"],
  "landingSite": "flat",
  "surfaceEnergy": 8
}
```

Ortak alanları değiştirmeden önce üç kişi birlikte karar versin.

[Ekip repoları](https://github.com/orgs/NASAYarismasi/repositories)

## Ortak 3D geliştirme planı

- **Aday teknik temel:** Vite + Three.js, JavaScript ES modülleri. Üç ekip üyesi aynı paket sürümünü kullanır. Samet ana uygulamayı ve sahne geçişlerini yönetir.
- **Model biçimi:** Blender’da içe al, ölçeği ve geometriyi kontrol et, glTF/GLB olarak dışa aktar. Three.js sahnelerinde metre ve Y-yukarı kullan. Bir modelin kaynak URL’sini, kullanım koşullarını ve yapılan düzenlemeleri kaydet. [NASA medya kullanım kuralları](https://www.nasa.gov/nasa-brand-center/images-and-media/)
- **Görev bağlamı:** SLS ve Orion gerçek araçlardan alınan görsel referanslardır. Mars transfer aracı, insanlı iniş aracı ve yüzey üssü oyun için tasarlanan konseptlerdir.
- **Entegrasyon:** README’deki ortak iniş JSON’u korunur. Uçuş sahnesi başarılı inişte bu veriyi döndürür, koloni aynı nesneyi alır. Sahne kapatılırken olay dinleyicileri, animasyonlar ve GPU kaynakları temizlenir.
- **İlk ortak demo:** 3D kalkış → yolculuk kararı → 3D iniş → üç modül kur → bir sol ilerlet → görev raporu. Modeli yüklenemeyen bir sahne hata bilgisi ve yeniden deneme sunar.

## Atanan GitHub görevleri

- [Ortak Three.js uygulamasını ve 3D sahne altyapısını kur](https://github.com/NASAYarismasi/Samet/issues/1)
- [Uçuş ve koloni sahnelerini tek demoda birleştir](https://github.com/NASAYarismasi/Samet/issues/2)
- [Jüri demosu, sonuç ekranı ve model kaynaklarını tamamla](https://github.com/NASAYarismasi/Samet/issues/3)
