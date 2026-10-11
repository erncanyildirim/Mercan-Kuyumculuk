# Web sitesi ve admin paneli yayını (Cloudflare Pages, ücretsiz)

Site, admin paneli ve `/api/config` tek bir Cloudflare Pages projesinde çalışır. Ücretsiz plan yeterlidir:
sabit sayfalarda trafik sınırı yoktur; `/api/config` ve admin istekleri günlük 100.000 ücretsiz istek
hakkından düşer (uygulama başına oturumda birkaç istek; yerel bir mağaza için bu sınırın çok altındadır).
Sınır bir gün aşılsa bile uygulamalar son kayıtlı ayarlarla ve canlı fiyatlarla çalışmaya devam eder.

## İlk kurulum (bir kez)

1. https://dash.cloudflare.com/sign-up adresinden ücretsiz hesap açın (kart gerekmez).
2. Bilgisayarda:
   ```bash
   cd cloudflare
   npm install
   npx wrangler login                      # tarayıcıda Cloudflare onayı açılır
   npx wrangler pages project create mercankuyumculuk --production-branch main
   npx wrangler kv namespace create CONFIG # çıkan id'yi wrangler.toml içine yazın
   npx wrangler pages secret put ADMIN_PASSWORD --project-name mercankuyumculuk
   npx wrangler pages secret put SESSION_SECRET --project-name mercankuyumculuk   # uzun rastgele bir metin
   ```
3. Siteyi derleyip yayınlayın:
   ```bash
   ./gradlew :webApp:composeCompatibilityBrowserDistribution
   cd cloudflare && npx wrangler pages deploy --branch main
   ```
   Site `https://mercankuyumculuk.pages.dev` adresinde açılır; admin paneli `/admin/` altındadır.

## Alan adını bağlama

1. Cloudflare panelinde **Add a domain** → `mercankuyumculukosmaniye.com.tr` → Free plan.
2. Cloudflare'in verdiği iki ad sunucusunu (nameserver) alan adını aldığınız firmanın panelinde
   "DNS / Nameserver" bölümüne yazın. Etkinleşmesi birkaç saat sürebilir.
3. Pages projesinde **Custom domains** → `mercankuyumculukosmaniye.com.tr` ekleyin. SSL otomatik ve ücretsizdir.

## Otomatik yayın (GitHub)

`main` dalına her birleştirmede `.github/workflows/ci.yml` testleri çalıştırır ve siteyi yayınlar.
Bunun için GitHub deposunda **Settings → Secrets and variables → Actions** altına ekleyin:

- `CLOUDFLARE_API_TOKEN`: Cloudflare → My Profile → API Tokens → "Edit Cloudflare Workers" şablonu
  (Account / Cloudflare Pages: Edit izni yeterli).
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare panelinde sağ altta yazar.

## Yerelde deneme

```bash
cd cloudflare
printf 'ADMIN_PASSWORD=yerel-sifre\nSESSION_SECRET=yerel\n' > .dev.vars
npx wrangler pages dev --port 8788
```
`http://localhost:8788/admin/` adresinden giriş yapılabilir. `.dev.vars` git'e eklenmez.
