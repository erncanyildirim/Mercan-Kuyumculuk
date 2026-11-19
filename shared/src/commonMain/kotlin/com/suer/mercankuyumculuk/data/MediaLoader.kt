package com.suer.mercankuyumculuk.data

import androidx.compose.ui.graphics.ImageBitmap
import io.ktor.client.HttpClient
import io.ktor.client.plugins.timeout
import io.ktor.client.request.get
import io.ktor.client.statement.readRawBytes
import io.ktor.http.isSuccess
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.jetbrains.compose.resources.decodeToImageBitmap

/**
 * Loads product and category photos uploaded in the admin panel (GET /api/media/{id}).
 * Ids are random and never reused, so decoded images are kept in a small in-memory cache.
 */
class MediaLoader(
    private val client: HttpClient,
    private val baseUrls: List<String>,
    private val maxEntries: Int = 60,
) {
    private val cache = LinkedHashMap<String, ImageBitmap>()
    private val lock = Mutex()

    fun cached(id: String): ImageBitmap? = cache[id]

    suspend fun load(id: String): ImageBitmap? {
        if (!MEDIA_ID.matches(id)) return null
        lock.withLock { cache[id] }?.let { return it }
        for (base in baseUrls) {
            try {
                val response = client.get("$base/api/media/$id") { timeout { requestTimeoutMillis = 20_000 } }
                if (!response.status.isSuccess()) continue
                val image = response.readRawBytes().decodeToImageBitmap()
                lock.withLock {
                    cache[id] = image
                    while (cache.size > maxEntries) cache.remove(cache.keys.first())
                }
                return image
            } catch (e: CancellationException) {
                throw e
            } catch (_: Throwable) {
                // Try the next address.
            }
        }
        return null
    }

    private companion object {
        val MEDIA_ID = Regex("^[a-f0-9]{32}$")
    }
}
