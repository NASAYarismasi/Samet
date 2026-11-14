# Mars’a İlk Koloni — Arayüz ve Entegrasyon

**Sorumlu: Samet**

Uçuş ve koloniyi tek bir 2D web oyununda birleştir. Jüri demosu bu repodan açılacak.

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

İlk sürüm için düz JavaScript modülleri kullanın. Ortak alanları değiştirmeden önce üç kişi birlikte karar versin.

[Ekip repoları](https://github.com/orgs/NASAYarismasi/repositories)

