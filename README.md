# Mars — İlk Koloni / Açılış ve Astronot Seçimi

Samet'in güncel arayüz teslimi: Mars açılışı → Yeni Oyun / Ayarlar / Çıkış → üç astronottan görünüş seçimi → başlangıç sahnesine devir.

## Çalıştırma

Node.js ile:

```sh
npm install
npm run dev
```

Terminaldeki adresi açın. `npm run build` üretim derlemesi, `npm run preview` derleme önizlemesi, `npm test` sahne devir kontrolleridir. HTML dosyasına çift tıklamak yeterli değildir.

## Güncel kapsam

- NASA Mars haritası üzerinde dönen gerçek zamanlı 3D gezegen, yıldızlar, hafif atmosfer ve yavaş kamera hareketi. Beş saniyelik açılış atlanabilir veya yeniden izlenebilir. Video hissi veren 3D animasyondur; MP4 veya çekilmiş video değildir.
- Yeni Oyun, Ayarlar ve Çıkış menüsü.
- Ana ses, ortam ve efekt seviyesi. Web Audio ile oluşturulan ortam tonu ve arayüz sesleri gerçek seviyelerine uygulanır. Tarayıcı kuralları nedeniyle ses ilk tıklama/tuş etkileşiminden sonra başlar.
- Otomatik, 1920×1080, 1600×900 ve 1280×720 render çözünürlükleri; tam ekran düğmesi. İşletim sistemi monitör çözünürlüğü değiştirilmez. Sabit 16:9 görüntü, farklı ekran oranlarında kırpılarak doldurulur.
- Grafik kalitesi alanı sonraki geliştirmeye ayrılmıştır ve etkileşime kapalıdır.
- İstenen üç astronot görünüşü. Hepsi kıyafetli, başlığını kolunun altında tutar. Seçim yalnızca görünüş içindir; ülke veya yetenek etiketi yoktur. Karakterler bu aşamada 2D seçim görselleridir, iskeletli 3D oyuncu modelleri değildir.
- Ayarlar ve görünüş tarayıcıda saklanır. Kayıt engellenirse oturum çalışmaya devam eder.
- Çıkış onayı, ortam sesinin durması ve sekme kapatılamazsa kapanış ekranı.
- Hareket azaltma tercihi, klavye kullanımı ve küçük ekran yerleşimleri.

Eski ARES panosu ve kol ekranı güncel index.html tarafından yüklenmez. Önceki kodlar ve exports/kol-ekran-sistemi paketi ayrı tutulur.

## Diğer geliştiriciye devir

Uçuş/oyun sahnesi henüz uygulanmaz. Bağlantı yokken görünüş onayından sonra dürüst bir Göreve hazır ekranı gösterilir; sahte yükleme yapılmaz.

Yeni başlangıç sahnesini ekleyen geliştirici `game-bridge.js` üzerinden bağlantı kurabilir:

```js
import { registerGameStart } from './game-bridge.js';

registerGameStart(async (session, host) => {
  // host: #game-root, tam ekran HTML kapsayıcısı.
  // Kendi oyun sahnenizi burada oluşturun ve başlatın.
  // session.player.appearanceId: astronaut-1 | astronaut-2 | astronaut-3
  // session.settings: master, ambient, effects, resolution
});
```

Bağlanan fonksiyon başarılı olursa menü ve gezegen kapatılıp alan yeni sahneye bırakılır. Hata olursa hazır ekranından tekrar denemeye dönülebilir. Aynı veri `mars:new-game` CustomEvent'iyle bildirilir ve `mars-new-game` anahtarına saklanır. Yalnız olay dinlemek sahne bağlantısı sayılmaz; devir için registerGameStart kullanılır. Bu veri görünüş/ayar oturumudur; ekipçe kararlaştırılan ortak iniş JSON alanlarını değiştirmez.

## Kaynaklar

Görsellerin kaynakları ve üretim istemi: public/art/ASSETS.md. Astronotlar yerleşik ImageGen ile üretildi. Mars haritası NASA/JPL/Caltech kaynağından alındı. Google Fonts kullanılamazsa sistem fontları devreye girer.
