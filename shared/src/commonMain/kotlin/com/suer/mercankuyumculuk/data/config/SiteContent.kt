package com.suer.mercankuyumculuk.data.config

import kotlinx.serialization.Serializable

/**
 * Collection edited in the admin panel's "Web sitesi" tab (config.site). The web site, the
 * TV board and the apps all read it. Defaults mirror DEFAULT_SITE in assets/site-defaults.js.
 */
@Serializable
data class SiteContent(
    val categories: List<SiteCategory> = DEFAULT_CATEGORIES,
    val items: List<SiteItem> = emptyList(),
) {
    val visibleCategories: List<SiteCategory> get() = categories.filter { it.visible }
    fun itemsIn(categoryId: String): List<SiteItem> = items.filter { it.visible && it.categoryId == categoryId }

    companion object {
        val DEFAULT_CATEGORIES = listOf(
            SiteCategory("ajda-bilezik", "Ajda Bilezik", "Klasik ve modern ajda modelleri", inBar = true),
            SiteCategory("burma-bilezik", "Burma Bilezik", "Kilitli ve kilitsiz burmalar", inBar = true),
            SiteCategory("sarnel-bilezik", "Şarnel Bilezik", "İnce işçilikli şarnel modeller", inBar = true),
            SiteCategory("ankara-bilezik", "Ankara Bilezik", "Geleneksel Ankara işi", inBar = true),
            SiteCategory("ray-bilezik", "Ray Bilezik", "Sade ve şık ray bilezikler", inBar = true),
            SiteCategory("trabzon-hasir", "Trabzon Hasır", "El örgüsü hasır bilezikler", inBar = true),
            SiteCategory("ziynet", "Ziynet Altını", "Çeyrek, yarım, tam, ata ve beşli"),
            SiteCategory("alyans", "Alyans", "Düz, taşlı ve desenli alyanslar"),
            SiteCategory("pirlanta", "Pırlanta & Tektaş", "Tektaş, beştaş ve tria"),
            SiteCategory("kolye", "Kolye", "Zarif ve iddialı kolyeler"),
            SiteCategory("kupe", "Küpe", "Halka, sallantılı ve vidalı"),
            SiteCategory("set", "Set & Takım", "Gelin ve söz setleri"),
        )
    }
}

@Serializable
data class SiteCategory(
    val id: String = "",
    val title: String = "",
    val subtitle: String = "",
    val visible: Boolean = true,
    /** Shown in the bangle bar under the web site header. */
    val inBar: Boolean = false,
    /** Media id; the photo is served at /api/media/{image}. */
    val image: String = "",
    val icon: String = "",
)

@Serializable
data class SiteItem(
    val id: String = "",
    val categoryId: String = "",
    val name: String = "",
    val detail: String = "",
    val description: String = "",
    val image: String = "",
    val visible: Boolean = true,
    /** Weight options in grams, ascending. */
    val grams: List<Double> = emptyList(),
    /** Catalog code whose gram price prices this item (e.g. AYAR22); empty = no price shown. */
    val priceCode: String = "",
)

/** Gram prices an item can follow; same list as GRAM_PRICES in assets/site-defaults.js. */
object GramPrices {
    val all: List<Pair<String, String>> = listOf(
        "AYAR22" to "22 Ayar",
        "AYAR14" to "14 Ayar",
        "ALTIN" to "24 Ayar (Has)",
        "KULCEALTIN" to "Gram Altın",
        "GUMUSTRY" to "Gümüş",
    )

    fun label(code: String): String = all.firstOrNull { it.first == code }?.second ?: ""

    /** Price of [gram] grams of [item] at the given gram (sell) price; null when not priced. */
    fun price(item: SiteItem, gram: Double?, gramSellPrice: Double?): Double? {
        if (item.priceCode.isBlank() || gram == null || gram <= 0 || gramSellPrice == null) return null
        return gram * gramSellPrice
    }
}
