// Website content used until the jeweler saves their own in the admin panel ("Web sitesi" tab).

export const DEFAULT_SITE = {
  hero: {
    eyebrow: "Osmaniye · Atatürk Caddesi",
    title: "Altının ışığı, Mercan’ın imzası",
    lead: "Ajda’dan burmaya, ziynetten pırlantaya kadar her parçayı güvenle seçin. Güncel fiyatlarımızı anlık takip edin, mağazamızda size en uygun modeli birlikte bulalım.",
  },
  about: {
    title: "Osmaniye’nin güvendiği adres",
    text: "Mercan Kuyumculuk olarak Osmaniye Merkez’de altın alım satımı, bilezik, ziynet, alyans ve takı hizmeti veriyoruz. Fiyatlarımızı piyasaya göre anlık ve şeffaf biçimde paylaşıyor, her müşterimize aradığı parçayı bulana kadar eşlik ediyoruz.",
    quote: "Altın bir yatırım, takı bir hatıradır. İkisini de doğru fiyatla ve gönül rahatlığıyla sunmak için buradayız.",
  },
  categories: [
    { id: "ajda-bilezik", title: "Ajda Bilezik", subtitle: "Klasik ve modern ajda modelleri", visible: true, inBar: true, icon: "bangle" },
    { id: "burma-bilezik", title: "Burma Bilezik", subtitle: "Kilitli ve kilitsiz burmalar", visible: true, inBar: true, icon: "twist" },
    { id: "sarnel-bilezik", title: "Şarnel Bilezik", subtitle: "İnce işçilikli şarnel modeller", visible: true, inBar: true, icon: "bangle" },
    { id: "ankara-bilezik", title: "Ankara Bilezik", subtitle: "Geleneksel Ankara işi", visible: true, inBar: true, icon: "bangle" },
    { id: "ray-bilezik", title: "Ray Bilezik", subtitle: "Sade ve şık ray bilezikler", visible: true, inBar: true, icon: "bangle" },
    { id: "trabzon-hasir", title: "Trabzon Hasır", subtitle: "El örgüsü hasır bilezikler", visible: true, inBar: true, icon: "chain" },
    { id: "ziynet", title: "Ziynet Altını", subtitle: "Çeyrek, yarım, tam, ata ve beşli", visible: true, inBar: false, icon: "coin" },
    { id: "alyans", title: "Alyans", subtitle: "Düz, taşlı ve desenli alyanslar", visible: true, inBar: false, icon: "ring" },
    { id: "pirlanta", title: "Pırlanta & Tektaş", subtitle: "Tektaş, beştaş ve tria", visible: true, inBar: false, icon: "gem" },
    { id: "kolye", title: "Kolye", subtitle: "Zarif ve iddialı kolyeler", visible: true, inBar: false, icon: "necklace" },
    { id: "kupe", title: "Küpe", subtitle: "Halka, sallantılı ve vidalı", visible: true, inBar: false, icon: "earring" },
    { id: "set", title: "Set & Takım", subtitle: "Gelin ve söz setleri", visible: true, inBar: false, icon: "heart" },
  ],
  items: [],
  tv: [
    { code: "ALTIN", label: "HAS ALTIN" },
    { code: "AYAR22", label: "22 AYAR" },
    { code: "KULCEALTIN", label: "GRAM" },
    { code: "CEYREK_YENI", label: "ÇEYREK" },
    { code: "YARIM_YENI", label: "YARIM" },
    { code: "TEK_YENI", label: "TAM" },
    { code: "ATA_YENI", label: "ATA" },
    { code: "AYAR14", label: "14 AYAR" },
    { code: "USDTRY", label: "DOLAR" },
    { code: "EURTRY", label: "EURO" },
  ],
  story: [
    { code: "ALTIN", label: "HAS ALTIN", note: "" },
    { code: "AYAR22", label: "22 AYAR", note: "bilezik" },
    { code: "CEYREK_YENI", label: "ÇEYREK", note: "yeni" },
    { code: "YARIM_YENI", label: "YARIM", note: "yeni" },
    { code: "TEK_YENI", label: "TAM", note: "yeni" },
    { code: "ATA_YENI", label: "ATA", note: "yeni" },
  ],
};

/** Saved content merged over the defaults; empty fields fall back to the default text. */
export function siteContent(config) {
  const s = config?.site;
  if (!s) return DEFAULT_SITE;
  const pick = (a, b) => (a && String(a).trim() ? a : b);
  return {
    hero: {
      eyebrow: pick(s.hero?.eyebrow, DEFAULT_SITE.hero.eyebrow),
      title: pick(s.hero?.title, DEFAULT_SITE.hero.title),
      lead: pick(s.hero?.lead, DEFAULT_SITE.hero.lead),
    },
    about: {
      title: pick(s.about?.title, DEFAULT_SITE.about.title),
      text: pick(s.about?.text, DEFAULT_SITE.about.text),
      quote: s.about?.quote ?? DEFAULT_SITE.about.quote,
    },
    categories: s.categories ?? DEFAULT_SITE.categories,
    items: s.items ?? [],
    tv: s.tv?.length ? s.tv : DEFAULT_SITE.tv,
    story: s.story?.length ? s.story : DEFAULT_SITE.story,
  };
}

/** Gram prices a product can follow (Catalog codes). Same list as GramPrices in SiteContent.kt. */
export const GRAM_PRICES = [
  ["AYAR22", "22 Ayar"],
  ["AYAR14", "14 Ayar"],
  ["ALTIN", "24 Ayar (Has)"],
  ["KULCEALTIN", "Gram Altın"],
  ["GUMUSTRY", "Gümüş"],
];

/** "12,5 gr" */
export function gramLabel(g) {
  return `${Number(g).toLocaleString("tr-TR", { maximumFractionDigits: 2 })} gr`;
}

// Line drawings for category cards and the bangle bar (24×24, stroke = currentColor).
export const ICONS = {
  bangle: '<ellipse cx="12" cy="12" rx="9" ry="5.2"/><ellipse cx="12" cy="12" rx="6.4" ry="3.2"/>',
  twist: '<ellipse cx="12" cy="12" rx="9" ry="5.2"/><path d="M5 9.5c2 2 4 2 6 0s4-2 6 0M5 14.5c2-2 4-2 6 0s4 2 6 0"/>',
  chain: '<rect x="2.5" y="9" width="7" height="6" rx="3"/><rect x="8.5" y="9" width="7" height="6" rx="3"/><rect x="14.5" y="9" width="7" height="6" rx="3"/>',
  coin: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5.5"/><path d="M12 9v6M10 10.5h4"/>',
  bar: '<path d="M4 16l2.5-7h11L20 16z"/><path d="M8 12.5h8"/>',
  ring: '<circle cx="12" cy="14.5" r="6"/><path d="M9.5 8.5l2.5-4 2.5 4"/>',
  gem: '<path d="M6 4h12l3 5-9 11L3 9z"/><path d="M3 9h18M9 4l3 16 3-16"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10a4.3 4.3 0 0 1 7.5-2.8A4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
  necklace: '<path d="M4 4c0 7 3.5 10.5 8 10.5S20 11 20 4"/><path d="M12 14.5l-2 3 2 2.5 2-2.5z"/>',
  earring: '<circle cx="12" cy="5" r="2"/><path d="M12 7v3"/><path d="M12 10l-4 6a4 4 0 0 0 8 0z"/>',
};

export function iconFor(c) {
  if (c.icon && ICONS[c.icon]) return c.icon;
  const t = (c.title || "").toLocaleLowerCase("tr");
  if (t.includes("burma") || t.includes("burgu")) return "twist";
  if (t.includes("hasır") || t.includes("zincir") || t.includes("bileklik")) return "chain";
  if (t.includes("bilezik") || t.includes("kelepçe")) return "bangle";
  if (t.includes("ziynet") || t.includes("çeyrek") || t.includes("lira")) return "coin";
  if (t.includes("alyans") || t.includes("yüzük")) return "ring";
  if (t.includes("pırlanta") || t.includes("tektaş") || t.includes("taş")) return "gem";
  if (t.includes("kolye")) return "necklace";
  if (t.includes("küpe")) return "earring";
  if (t.includes("külçe") || t.includes("yatırım") || t.includes("gram")) return "bar";
  return "heart";
}

export function iconSvg(name, cls = "") {
  return `<svg class="${cls}" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.heart}</svg>`;
}
