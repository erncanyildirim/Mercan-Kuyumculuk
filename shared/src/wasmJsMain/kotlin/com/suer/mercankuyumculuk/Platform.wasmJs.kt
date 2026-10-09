package com.suer.mercankuyumculuk

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import kotlinx.browser.window

internal actual val platformKind: PlatformKind = PlatformKind.WEB

private fun webShare(text: String): Boolean =
    js("(navigator.share ? (navigator.share({ text: text }).catch(function () {}), true) : (navigator.clipboard ? (navigator.clipboard.writeText(text), false) : false))")

@Composable
internal actual fun rememberShareText(): (String) -> Unit = remember {
    { text: String -> webShare(text); Unit }
}

internal actual fun platformConfigEndpoints(): List<String> {
    val origin = runCatching { window.location.origin }.getOrNull().orEmpty()
    val isLocal = origin.contains("localhost") || origin.contains("127.0.0.1")
    return if (origin.startsWith("http") && !isLocal) listOf("$origin/api/config") + AppLinks.configEndpoints
    else AppLinks.configEndpoints
}
