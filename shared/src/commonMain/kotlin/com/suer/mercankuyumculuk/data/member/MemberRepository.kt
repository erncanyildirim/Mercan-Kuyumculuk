package com.suer.mercankuyumculuk.data.member

import com.suer.mercankuyumculuk.data.AppJson
import com.suer.mercankuyumculuk.data.storage.LocalStore
import io.ktor.client.HttpClient
import io.ktor.client.plugins.timeout
import io.ktor.client.request.HttpRequestBuilder
import io.ktor.client.request.delete
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.put
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.contentType
import io.ktor.http.isSuccess
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

@Serializable
data class MemberProfile(
    val name: String = "",
    val phone: String = "",
    val createdAt: String = "",
)

/** Members-only price of a product: sell lowered by [sell], buy raised by [buy] (₺ or %). */
@Serializable
data class MemberDeal(
    val sell: Double = 0.0,
    val buy: Double = 0.0,
    /** "amount" or "percent" */
    val unit: String = "amount",
)

@Serializable
data class MemberCoupon(
    val id: String = "",
    val code: String = "",
    val title: String = "",
    val description: String = "",
    /** percent | amount | gram | gift */
    val kind: String = "amount",
    val value: Double = 0.0,
    val validFrom: String = "",
    val validTo: String = "",
    val perMember: Int = 1,
    val used: Int = 0,
    val usable: Boolean = true,
)

@Serializable
data class MemberNotice(
    val id: String = "",
    val title: String = "",
    val body: String = "",
    val link: String = "",
    val at: String = "",
    val read: Boolean = false,
)

/** Signed-in customer with everything the server sent: prices, coupons and messages. */
@Serializable
data class MemberSession(
    val token: String,
    val member: MemberProfile,
    /** Whether the jeweler has membership switched on. */
    val enabled: Boolean = false,
    val deals: Map<String, MemberDeal> = emptyMap(),
    val coupons: List<MemberCoupon> = emptyList(),
    val notices: List<MemberNotice> = emptyList(),
    val unread: Int = 0,
) {
    val usableCoupons: Int get() = coupons.count { it.usable }
}

@Serializable
private data class MemberResponse(
    val token: String? = null,
    val member: MemberProfile = MemberProfile(),
    val enabled: Boolean = false,
    val deals: Map<String, MemberDeal> = emptyMap(),
    val coupons: List<MemberCoupon> = emptyList(),
    val notices: List<MemberNotice> = emptyList(),
    val unread: Int = 0,
)

/** Result of an account action; [error] is a Turkish message ready to show. */
data class MemberResult(val ok: Boolean, val error: String? = null)

/**
 * Customer accounts: register / log in with phone + password, keep the session on the device,
 * and fetch members-only prices, coupons and messages. Endpoints live under /api/member on the site.
 */
class MemberRepository(
    private val client: HttpClient,
    private val store: LocalStore,
    /** Site origins to try in order, e.g. https://mercankuyumculukosmaniye.com.tr. */
    private val bases: List<String>,
) {
    private val _session = MutableStateFlow(loadSession())
    val session: StateFlow<MemberSession?> = _session.asStateFlow()

    suspend fun register(name: String, phone: String, password: String): MemberResult =
        authenticate("register", mapOf("name" to name, "phone" to phone, "password" to password))

    suspend fun login(phone: String, password: String): MemberResult =
        authenticate("login", mapOf("phone" to phone, "password" to password))

    fun logout() = save(null)

    /** Reloads profile, prices, coupons and messages; signs out if the server rejects the session. */
    suspend fun refresh() {
        val current = _session.value ?: return
        val res = request { base -> client.get("$base/api/member/me") { auth(current.token) } } ?: return
        when {
            res.status.isSuccess() -> parse(res.bodyAsText())?.let { save(it.toSession(current.token)) }
            res.status.value == 401 || res.status.value == 403 -> save(null)
        }
    }

    /** Marks all messages read. */
    suspend fun markRead() {
        val current = _session.value ?: return
        if (current.unread == 0) return
        save(current.copy(unread = 0, notices = current.notices.map { it.copy(read = true) }))
        request { base ->
            client.post("$base/api/member/me") {
                auth(current.token)
                contentType(ContentType.Application.Json)
                setBody("""{"read":true}""")
            }
        }
    }

    suspend fun changePassword(old: String, new: String): MemberResult =
        update(JsonObject(mapOf("oldPassword" to JsonPrimitive(old), "password" to JsonPrimitive(new))))

    suspend fun rename(name: String): MemberResult = update(JsonObject(mapOf("name" to JsonPrimitive(name))))

    private suspend fun update(body: JsonObject): MemberResult {
        val current = _session.value ?: return MemberResult(false, "Giriş yapılmamış")
        val res = request { base ->
            client.put("$base/api/member/me") {
                auth(current.token)
                contentType(ContentType.Application.Json)
                setBody(body.toString())
            }
        } ?: return MemberResult(false, NETWORK_ERROR)
        if (!res.status.isSuccess()) return MemberResult(false, errorOf(res))
        val parsed = parse(res.bodyAsText()) ?: return MemberResult(false, "Beklenmeyen sunucu yanıtı")
        save(parsed.toSession(parsed.token ?: current.token))
        return MemberResult(true)
    }

    /** Permanently deletes the account on the server (App Store guideline 5.1.1(v)). */
    suspend fun deleteAccount(password: String): MemberResult {
        val current = _session.value ?: return MemberResult(false, "Giriş yapılmamış")
        val res = request { base ->
            client.delete("$base/api/member/me") {
                auth(current.token)
                contentType(ContentType.Application.Json)
                setBody(JsonObject(mapOf("password" to JsonPrimitive(password))).toString())
            }
        } ?: return MemberResult(false, NETWORK_ERROR)
        if (!res.status.isSuccess()) return MemberResult(false, errorOf(res))
        save(null)
        return MemberResult(true)
    }

    private suspend fun authenticate(path: String, body: Map<String, String>): MemberResult {
        val res = request { base ->
            client.post("$base/api/member/$path") {
                contentType(ContentType.Application.Json)
                setBody(JsonObject(body.mapValues { JsonPrimitive(it.value) }).toString())
            }
        } ?: return MemberResult(false, NETWORK_ERROR)
        if (!res.status.isSuccess()) return MemberResult(false, errorOf(res))
        val parsed = parse(res.bodyAsText())
        val token = parsed?.token ?: return MemberResult(false, "Beklenmeyen sunucu yanıtı")
        save(parsed.toSession(token))
        return MemberResult(true)
    }

    private fun MemberResponse.toSession(token: String) =
        MemberSession(token, member, enabled, deals, coupons, notices, unread)

    /** Tries each base until one answers; null when none could be reached. */
    private suspend fun request(block: suspend (String) -> HttpResponse): HttpResponse? {
        for (base in bases) {
            try {
                return block(base)
            } catch (e: CancellationException) {
                throw e
            } catch (_: Throwable) {
                // try the next address
            }
        }
        return null
    }

    private fun HttpRequestBuilder.auth(token: String) {
        header(HttpHeaders.Authorization, "Bearer $token")
        timeout { requestTimeoutMillis = 15_000 }
    }

    private suspend fun errorOf(res: HttpResponse): String = runCatching {
        AppJson.parseToJsonElement(res.bodyAsText()).jsonObject["error"]?.jsonPrimitive?.content
    }.getOrNull() ?: "Bir hata oluştu (${res.status.value})"

    private fun parse(text: String): MemberResponse? =
        runCatching { AppJson.decodeFromString(MemberResponse.serializer(), text) }.getOrNull()

    private fun save(session: MemberSession?) {
        _session.value = session
        store.putString(KEY, session?.let { AppJson.encodeToString(MemberSession.serializer(), it) })
    }

    private fun loadSession(): MemberSession? {
        val text = store.getString(KEY) ?: return null
        return runCatching { AppJson.decodeFromString(MemberSession.serializer(), text) }.getOrNull()
    }

    private companion object {
        const val KEY = "member.session"
        const val NETWORK_ERROR = "Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin."
    }
}
