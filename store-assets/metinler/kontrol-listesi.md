# Yayın öncesi kontrol listesi ve reddedilme riskleri

Durum işaretleri: ✅ hazır · ⏳ bekliyor · ⚠️ dikkat

## Önce yapılması gerekenler (yükleme engelleri)

- ✅ **Web sitesi yayında:** https://mercankuyumculuk.pages.dev (gizlilik `/gizlilik/`, destek `/destek/`).
- ⏳ **Alan adı:** `mercankuyumculukosmaniye.com.tr` Cloudflare'e yönlendirildi; etkinleşince uygulamadaki
  bağlantılar (`AppLinks.SITE_URL`) çalışır. Mağazaya göndermeden önce adresin açıldığını kontrol edin.
- ✅ **E-posta adresi:** mercankuyumculukosmaniye@gmail.com (mağaza metinlerine, gizlilik ve destek sayfalarına eklendi).
- ⏳ **Yetki belgesi** imzalanıp taranmalı (`yetki-belgesi.md`).
- ✅ **Android yükleme anahtarı:** `~/.mercan-signing/upload.jks` (şifresi `upload-keystore.properties` içinde).
  Kaybedilirse güncelleme yayınlanamaz; yedeğini güvenli bir yere alın. Play App Signing açık.
- ✅ **Apple Team ID** (K2MRSSMA4U) ve App Store Connect kaydı (com.suer.mercankuyumculuk) hazır.

## Apple App Store

- ⚠️ **5.2.1 / 4.1 – İşletme adı kişisel hesapta.** En yüksek risk bu. Apple, bir işletmenin adını ve
  logosunu taşıyan uygulamanın o işletmenin hesabından yayınlanmasını tercih eder. Seçenekler:
  1. Kişisel hesap + imzalı yetki belgesi (inceleme notuna ek). Çoğu zaman kabul edilir, bazen ret gelir.
  2. Mağaza sahibi adına **kuruluş hesabı**: şahıs şirketi D-U-N-S numarasını ücretsiz alabilir,
     yıllık ücret aynıdır (99 USD). Reddedilme riski en düşük yol budur.
- ✅ **4.2 – Asgari işlevsellik.** Uygulama bir web sayfası kopyası değil: canlı fiyat, favoriler,
  hesaplayıcı, mağaza iletişimi, koyu/açık tema, çevrimdışı son fiyat.
- ✅ **5.1.1 – Veri toplama.** Giriş yok, veri toplanmıyor; App Privacy "Veri Toplanmıyor".
- ✅ **Gizlilik bildirimi (PrivacyInfo.xcprivacy)** eklendi: UserDefaults (CA92.1), dosya zaman damgası
  (C617.1), sistem açılış süresi (35F9.1).
- ✅ **İhracat uyumluluğu:** `ITSAppUsesNonExemptEncryption = NO`.
- ✅ **2.3.7 – Meta veri:** Anahtar kelimelerde başka marka adı yok ("harem" çıkarıldı).
- ✅ **2.1 – Çalışan uygulama:** Hafta sonu "Piyasa kapalı" durumu ve son fiyatlar düzgün gösteriliyor,
  inceleme notunda da açıklandı.
- ✅ **iPad:** Uygulama iPad'i destekliyor (geniş ekranda yan menü). iPad ekran görüntüleri hazır.
- ✅ **Minimum iOS:** 16.0.
- ⚠️ **Ekran görüntüleri hafta sonu çekildi** ("Piyasa kapalı" yazıyor). Hafta içi piyasa açıkken yeniden
  çekmek daha canlı görünür: simülatörde 4 ekranı yakalayıp `tools/store/make_store_images.py` çalıştırılır.

## Google Play

- ⚠️ **Kişisel hesap kuralı:** 12 test kullanıcısı, 14 gün kesintisiz kapalı test, sonra üretim erişimi başvurusu.
- ⚠️ **Geliştirici kimlik doğrulaması:** Play Console kimlik ve adres doğrulaması ister; hesap açılırken tamamlanmalı.
- ⚠️ **Taklit / yetki (Impersonation):** İşletme adı kullanıldığı için Google da yetki sorabilir;
  aynı yetki belgesi kullanılır.
- ✅ **Veri güvenliği:** "Veri toplanmıyor ve paylaşılmıyor".
- ✅ **Finansal özellikler beyanı:** "Finansal özellik sunmuyor" (yalnızca fiyat gösterimi).
- ✅ **Hedef kitle:** 18+ (Aileler politikası dışı).
- ✅ **Hedef API seviyesi:** targetSdk 37.
- ✅ **İzinler:** Yalnızca `INTERNET`.
- ✅ **Grafikler:** 512 simge, 1024×500 öne çıkan grafik, 4 telefon ekran görüntüsü (1080×1920).

## Uygulama içi zorunlu metinler

- ✅ Her fiyat ekranında "Fiyat kaynağı: Harem Altın" ve "bilgi amaçlıdır, yatırım tavsiyesi değildir".
- ✅ Ayarlar → Gizlilik politikası bağlantısı (alan adı yayına girince çalışacak).
- ✅ Uygulama içi satın alma, reklam veya üyelik yok.
