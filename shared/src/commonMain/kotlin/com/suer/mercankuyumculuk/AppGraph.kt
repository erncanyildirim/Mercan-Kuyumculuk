package com.suer.mercankuyumculuk

import com.suer.mercankuyumculuk.data.Preferences
import com.suer.mercankuyumculuk.data.config.ConfigRepository
import com.suer.mercankuyumculuk.data.createHttpClient
import com.suer.mercankuyumculuk.data.harem.HaremFeed
import com.suer.mercankuyumculuk.data.market.MarketRepository
import com.suer.mercankuyumculuk.data.storage.SettingsStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob

/** Public URLs of the project. Change [SITE_URL] once the domain is registered. */
object AppLinks {
    /** Primary site (Cloudflare Pages custom domain). */
    const val SITE_URL = "https://mercankuyumculukosmaniye.com.tr"
    /** Always-available Cloudflare Pages address of the same project. */
    const val PAGES_URL = "https://mercankuyumculuk.pages.dev"

    const val PRIVACY_PATH = "/gizlilik"
    const val SUPPORT_PATH = "/destek"

    val configEndpoints: List<String> = listOf("$SITE_URL/api/config", "$PAGES_URL/api/config")

    fun privacyUrl(base: String = SITE_URL) = base + PRIVACY_PATH
    fun supportUrl(base: String = SITE_URL) = base + SUPPORT_PATH
}

/** Process-wide singletons (survive Android configuration changes). */
object AppGraph {
    val scope: CoroutineScope by lazy { CoroutineScope(SupervisorJob() + Dispatchers.Default) }
    private val httpClient by lazy { createHttpClient() }
    private val store by lazy { SettingsStore() }

    val preferences: Preferences by lazy { Preferences(store) }

    val configRepository: ConfigRepository by lazy {
        ConfigRepository(httpClient, store, platformConfigEndpoints())
    }

    val market: MarketRepository by lazy {
        MarketRepository(HaremFeed(httpClient), configRepository, store, scope)
    }
}

/** Web uses the page's own origin first; apps use [AppLinks.configEndpoints]. */
internal expect fun platformConfigEndpoints(): List<String>
