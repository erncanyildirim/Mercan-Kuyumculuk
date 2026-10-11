# /api/config sözleşmesi

Uygulamalar (Android, iOS, web) mağaza ayarlarını `GET /api/config` adresinden okur. Belgeyi admin
paneli (`/admin/`) yazar ve Cloudflare KV'de saklar.

- Sunucu: `cloudflare/functions/api/config.js`, doğrulama: `cloudflare/functions/_lib/config.js`
- Uygulama tarafı model: `shared/.../data/config/RemoteConfig.kt`
- Her alanın güvenli bir varsayılanı vardır; boş belge `{"schema":1,"version":0}` geçerlidir.
- Yanıtta `ETag: "v<version>"` döner; uygulamalar `If-None-Match` ile sorar, değişmediyse `304` alır.
- Uygulamalar açılışta ve açık kaldıkça 2 dakikada bir sorar. Sunucuya ulaşılamazsa son kayıtlı belge kullanılır.

```json
{
  "schema": 1,
  "version": 3,
  "updatedAt": "2026-10-11T10:00:00Z",
  "feed": { "url": "wss://hrmsocketonly.haremaltin.com", "enabled": true },
  "store": {
    "name": "Mercan Kuyumculuk",
    "city": "Osmaniye",
    "phone": "+905436118088",
    "whatsapp": "+905436118088",
    "address": "Alibeyli Mah. Atatürk Cad., Eski Belediye civarı, Merkez / Osmaniye",
    "mapsQuery": "Mercan Kuyumculuk Osmaniye",
    "lat": null,
    "lng": null,
    "hoursText": "Hafta içi 09:00 – 19:00",
    "openingHours": [{ "days": [1, 2, 3, 4, 5], "open": "09:00", "close": "19:00" }],
    "instagram": "",
    "email": "",
    "website": ""
  },
  "announcement": { "enabled": false, "text": "", "style": "info" },
  "products": {
    "ALTIN": { "mode": "adjust", "visible": true, "buy": null, "sell": null, "buyAdj": -38, "sellAdj": 50, "adjUnit": "amount" },
    "CEYREK_YENI": { "mode": "fixed", "visible": true, "buy": 10700, "sell": 10900, "buyAdj": 0, "sellAdj": 0, "adjUnit": "amount" }
  }
}
```

| Alan | Açıklama |
| --- | --- |
| `products.<KOD>.mode` | `live` (Harem fiyatı), `adjust` (Harem fiyatı + fark), `fixed` (elle girilen fiyat) |
| `products.<KOD>.adjUnit` | `amount` (TL) veya `percent` (%, en fazla ±50) |
| `products.<KOD>.visible` | `false` ise ürün uygulamada gösterilmez |
| `openingHours[].days` | 1 = Pazartesi … 7 = Pazar; saatler İstanbul saatiyle `SS:DD` |
| `feed.enabled` | `false` ise canlı akış kapanır, yalnızca sabit fiyatlar gösterilir |

Ürün kodları Harem Altın kodlarıdır; liste `webApp/src/webMain/resources/catalog.json` dosyasındadır
(`Catalog.kt` ile aynı olduğu `CatalogJsonTest` ile denetlenir).
