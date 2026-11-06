# Mercan Kuyumculuk Osmaniye

Osmaniye'deki Mercan Kuyumculuk için canlı altın ve döviz fiyatı uygulaması: Android, iOS ve web
(Kotlin Multiplatform + Compose Multiplatform). Üyelik, reklam ve ücretli servis yoktur.

## Nasıl çalışır?

- **Canlı fiyatlar:** Her cihaz Harem Altın'ın herkese açık Socket.IO yayınına (`wss://hrmsocketonly.haremaltin.com`)
  doğrudan bağlanır. Bağlantı yalnızca uygulama açıkken tutulur, kopunca kendiliğinden yeniden kurulur, son fiyatlar
  cihazda saklanır. Kod: `shared/.../data/harem/`, `shared/.../data/market/`.
- **Mağaza ayarları:** Kuyumcu `/admin/` panelinden ürün bazında fark ekleyebilir, sabit fiyat girebilir, ürün gizleyebilir,
  duyuru ve iletişim bilgilerini değiştirebilir. Uygulamalar bunları `/api/config` adresinden okur. Ayrıntı: `docs/api-contract.md`.
- **Web sitesi + admin paneli + API:** Cloudflare Pages (ücretsiz). Kurulum ve yayın: `docs/yayin.md`.
- **Mağaza yayını:** Metinler, formlar, ekran görüntüleri ve kontrol listesi: `store-assets/`.

## Klasörler

| Klasör | İçerik |
| --- | --- |
| `shared/` | Ortak kod: veri katmanı, fiyat hesaplama, tüm ekranlar |
| `androidApp/` | Android uygulaması |
| `iosApp/` | iOS uygulaması (Xcode projesi) |
| `webApp/` | Web uygulaması; `resources/` altında gizlilik, destek ve admin sayfaları |
| `cloudflare/` | `/api/config` ve admin API'si (Pages Functions) |
| `store-assets/` | Simgeler, ekran görüntüleri, mağaza metinleri |
| `tools/` | Simge, ekran görüntüsü ve metin uzunluğu araçları |

## Komutlar

```bash
./gradlew :androidApp:assembleDebug                         # Android
./gradlew :webApp:composeCompatibilityBrowserDistribution   # Web (wasm + js yedeği)
./gradlew :shared:testAndroidHostTest :shared:iosSimulatorArm64Test
cd cloudflare && npm test                                   # API testleri
python3 tools/store/check_lengths.py                        # mağaza metin uzunlukları
```

iOS: `iosApp/iosApp.xcodeproj` dosyasını Xcode'da açın; yayın için `iosApp/Configuration/Config.xcconfig` içindeki
`TEAM_ID` doldurulmalıdır.
