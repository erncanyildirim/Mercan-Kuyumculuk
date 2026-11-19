package com.suer.mercankuyumculuk.ui.account

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.suer.mercankuyumculuk.AppLinks
import com.suer.mercankuyumculuk.core.TrFormat
import com.suer.mercankuyumculuk.data.member.MemberCoupon
import com.suer.mercankuyumculuk.data.member.MemberRepository
import com.suer.mercankuyumculuk.data.member.MemberSession
import com.suer.mercankuyumculuk.ui.components.AppCard
import com.suer.mercankuyumculuk.ui.icons.AppIcons
import com.suer.mercankuyumculuk.ui.theme.AppTheme
import kotlinx.coroutines.launch

/**
 * Üyelik: sign in / sign up, then the member's coupons, messages and account.
 * The same features as /uye/ on the web site.
 */
@Composable
fun AccountScreen(
    session: MemberSession?,
    membersEnabled: Boolean,
    memberNote: String,
    repo: MemberRepository,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val c = AppTheme.colors
    Column(modifier.fillMaxSize().verticalScroll(rememberScrollState()), horizontalAlignment = Alignment.CenterHorizontally) {
        Column(Modifier.widthIn(max = 560.dp).fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    Modifier.size(44.dp).clip(CircleShape).border(1.dp, c.outline, CircleShape).clickable(role = Role.Button, onClickLabel = "Geri", onClick = onBack),
                    contentAlignment = Alignment.Center,
                ) { Icon(AppIcons.Close, contentDescription = "Kapat", tint = c.text, modifier = Modifier.size(20.dp)) }
                Spacer(Modifier.width(12.dp))
                Text(if (session == null) "Üyelik" else "Hesabım", style = MaterialTheme.typography.headlineMedium, color = c.text, modifier = Modifier.semantics { heading() })
            }
            if (session == null) AuthForms(membersEnabled, memberNote, repo) else MemberHome(session, repo)
        }
    }
}

// ---------- sign in / sign up ----------

@Composable
private fun AuthForms(membersEnabled: Boolean, note: String, repo: MemberRepository) {
    val c = AppTheme.colors
    val scope = rememberCoroutineScope()
    var signup by rememberSaveable { mutableStateOf(false) }
    var name by rememberSaveable { mutableStateOf("") }
    var phone by rememberSaveable { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }

    AppCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(if (signup) "Üye olun" else "Üye girişi", style = MaterialTheme.typography.titleLarge, color = c.text)
            Text(
                when {
                    signup -> "Üyelere özel fiyatlar, kuponlar ve kampanya bildirimleri için ücretsiz üye olun."
                    !membersEnabled -> "Üyelik şu anda kapalı. Zaten üyeyseniz giriş yapabilirsiniz."
                    note.isNotBlank() -> note
                    else -> "Üyelere özel fiyat ve kuponlarınızı görmek için giriş yapın."
                },
                style = MaterialTheme.typography.bodyMedium, color = c.textMuted,
            )
            if (signup) Field("Ad soyad", name, { name = it })
            Field("Cep telefonu", phone, { phone = it }, keyboard = KeyboardType.Phone, placeholder = "05XX XXX XX XX")
            Field("Şifre", password, { password = it }, keyboard = KeyboardType.Password, secret = true)
            error?.let { Text(it, color = c.down, style = MaterialTheme.typography.bodySmall) }
            PrimaryButton(if (busy) "Lütfen bekleyin…" else if (signup) "Üye ol" else "Giriş yap", enabled = !busy) {
                busy = true
                error = null
                scope.launch {
                    val r = if (signup) repo.register(name, phone, password) else repo.login(phone, password)
                    busy = false
                    if (!r.ok) error = r.error
                }
            }
            if (signup) {
                Text("Üye olarak bilgilerinizin yalnızca Mercan Kuyumculuk tarafından üyelik için kullanılmasını kabul edersiniz.", style = MaterialTheme.typography.bodySmall, color = c.textMuted)
            }
            if (membersEnabled || signup) {
                TextButton(onClick = { signup = !signup; error = null }, modifier = Modifier.align(Alignment.CenterHorizontally)) {
                    Text(if (signup) "Zaten üye misiniz? Giriş yapın" else "Hesabınız yok mu? Üye olun", color = c.goldInk)
                }
            }
            if (!signup) Text("Şifrenizi unuttuysanız mağazamıza yazın, yeni şifre verelim.", style = MaterialTheme.typography.bodySmall, color = c.textMuted, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
        }
    }
}

// ---------- signed in ----------

@Composable
private fun MemberHome(s: MemberSession, repo: MemberRepository) {
    val c = AppTheme.colors
    var tab by rememberSaveable { mutableStateOf(0) }
    Text("Merhaba, ${s.member.name.substringBefore(' ')}", style = MaterialTheme.typography.titleLarge, color = c.text)
    if (s.deals.isNotEmpty()) {
        Text("Fiyatlar ekranında size özel üye fiyatları gösteriliyor.", style = MaterialTheme.typography.bodyMedium, color = c.goldInk)
    }
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(999.dp)).background(c.cardHigh).padding(4.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        listOf("Kuponlar" + if (s.usableCoupons > 0) " (${s.usableCoupons})" else "", "Bildirimler" + if (s.unread > 0) " (${s.unread})" else "", "Hesap").forEachIndexed { i, label ->
            val on = tab == i
            Box(
                Modifier.weight(1f).heightIn(min = 40.dp).clip(RoundedCornerShape(999.dp)).background(if (on) c.text else c.cardHigh)
                    .clickable(role = Role.Tab) { tab = i }.padding(horizontal = 6.dp, vertical = 10.dp),
                contentAlignment = Alignment.Center,
            ) { Text(label, style = MaterialTheme.typography.labelMedium, color = if (on) c.background else c.text, maxLines = 1) }
        }
    }
    when (tab) {
        0 -> Coupons(s.coupons)
        1 -> Notices(s, repo)
        else -> AccountSettings(s, repo)
    }
}

private fun kindText(c: MemberCoupon): String = when (c.kind) {
    "percent" -> "%${TrFormat.number(c.value, if (c.value % 1.0 == 0.0) 0 else 1)} indirim"
    "amount" -> "${TrFormat.number(c.value, 0)} ₺ indirim"
    "gram" -> "Gram başına ${TrFormat.number(c.value, 0)} ₺ indirim"
    else -> "Size özel hediye"
}

private fun day(iso: String): String {
    val p = iso.take(10).split('-')
    if (p.size != 3) return iso
    val months = listOf("Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık")
    return "${p[2].toIntOrNull() ?: p[2]} ${months.getOrElse((p[1].toIntOrNull() ?: 1) - 1) { "" }} ${p[0]}"
}

@Composable
private fun Coupons(coupons: List<MemberCoupon>) {
    val c = AppTheme.colors
    if (coupons.isEmpty()) {
        Empty("Şu anda size tanımlı kupon yok. Yeni kuponlar burada ve bildirimlerinizde görünecek.")
        return
    }
    Text("Kuponunuzu kullanmak için kasada kodu gösterin ya da telefon numaranızı söyleyin.", style = MaterialTheme.typography.bodySmall, color = c.textMuted)
    coupons.forEach { k ->
        Column(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(if (k.usable) c.goldSoft else c.cardHigh)
                .border(1.dp, if (k.usable) c.goldInk.copy(alpha = 0.4f) else c.outline, RoundedCornerShape(18.dp)).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(k.title, style = MaterialTheme.typography.titleMedium, color = c.text, modifier = Modifier.weight(1f))
                Text(
                    k.code,
                    fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold, fontSize = 16.sp, letterSpacing = 2.sp, color = c.text,
                    modifier = Modifier.clip(RoundedCornerShape(10.dp)).background(c.card).border(1.dp, c.outline, RoundedCornerShape(10.dp)).padding(horizontal = 10.dp, vertical = 6.dp),
                )
            }
            Text(
                buildString {
                    append(kindText(k))
                    if (k.validTo.isNotBlank()) append(" · son gün ${day(k.validTo)}")
                    if (k.perMember > 1) append(" · ${k.used}/${k.perMember} kullanıldı") else if (k.used > 0) append(" · kullanıldı")
                },
                style = MaterialTheme.typography.bodySmall, color = c.textMuted,
            )
            if (k.description.isNotBlank()) Text(k.description, style = MaterialTheme.typography.bodyMedium, color = c.text)
        }
    }
}

@Composable
private fun Notices(s: MemberSession, repo: MemberRepository) {
    val c = AppTheme.colors
    val uri = LocalUriHandler.current
    // Opening the box marks everything read (on the server too).
    LaunchedEffect(s.unread) { if (s.unread > 0) repo.markRead() }
    if (s.notices.isEmpty()) {
        Empty("Henüz bildiriminiz yok.")
        return
    }
    AppCard(Modifier.fillMaxWidth()) {
        Column {
            s.notices.forEachIndexed { i, n ->
                if (i > 0) HorizontalDivider(color = c.outline)
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        if (!n.read) { Box(Modifier.size(8.dp).clip(CircleShape).background(c.down)); Spacer(Modifier.width(8.dp)) }
                        Text(n.title, style = MaterialTheme.typography.titleSmall, color = c.text)
                    }
                    Text(n.body, style = MaterialTheme.typography.bodyMedium, color = c.text)
                    if (n.link.startsWith("https://")) {
                        Text("Detaylar →", color = c.goldInk, style = MaterialTheme.typography.labelLarge, modifier = Modifier.clickable { runCatching { uri.openUri(n.link) } })
                    }
                    Text(day(n.at), style = MaterialTheme.typography.bodySmall, color = c.textMuted)
                }
            }
        }
    }
}

@Composable
private fun AccountSettings(s: MemberSession, repo: MemberRepository) {
    val c = AppTheme.colors
    val scope = rememberCoroutineScope()
    val uri = LocalUriHandler.current
    var name by rememberSaveable { mutableStateOf(s.member.name) }
    var old by remember { mutableStateOf("") }
    var new by remember { mutableStateOf("") }
    var message by remember { mutableStateOf<Pair<Boolean, String>?>(null) }
    var deleting by remember { mutableStateOf(false) }

    AppCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Field("Ad soyad", name, { name = it })
            SecondaryButton("Adımı kaydet") {
                scope.launch { val r = repo.rename(name); message = r.ok to (r.error ?: "Adınız kaydedildi") }
            }
            HorizontalDivider(color = c.outline)
            Field("Mevcut şifre", old, { old = it }, keyboard = KeyboardType.Password, secret = true)
            Field("Yeni şifre", new, { new = it }, keyboard = KeyboardType.Password, secret = true)
            SecondaryButton("Şifremi değiştir") {
                scope.launch {
                    val r = repo.changePassword(old, new)
                    message = r.ok to (r.error ?: "Şifreniz değiştirildi")
                    if (r.ok) { old = ""; new = "" }
                }
            }
            message?.let { (ok, text) -> Text(text, color = if (ok) c.up else c.down, style = MaterialTheme.typography.bodySmall) }
            Text("Telefon: ${s.member.phone.replaceFirst("90", "0")} · üyelik ${day(s.member.createdAt)}", style = MaterialTheme.typography.bodySmall, color = c.textMuted)
        }
    }
    PrimaryButton("Çıkış yap") { repo.logout() }
    SecondaryButton("Üyeliğimi sil") { deleting = true }
    Text(
        "Gizlilik politikası",
        color = c.goldInk, style = MaterialTheme.typography.labelLarge,
        textAlign = TextAlign.Center,
        modifier = Modifier.fillMaxWidth().clickable { runCatching { uri.openUri(AppLinks.privacyUrl()) } }.padding(8.dp),
    )

    if (deleting) {
        var pw by remember { mutableStateOf("") }
        var err by remember { mutableStateOf<String?>(null) }
        AlertDialog(
            onDismissRequest = { deleting = false },
            title = { Text("Üyeliğinizi silin") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Üyeliğiniz, kuponlarınız ve bildirimleriniz kalıcı olarak silinir. Onaylamak için şifrenizi yazın.")
                    Field("Şifre", pw, { pw = it }, keyboard = KeyboardType.Password, secret = true)
                    err?.let { Text(it, color = c.down) }
                }
            },
            confirmButton = {
                TextButton(onClick = { scope.launch { val r = repo.deleteAccount(pw); if (r.ok) deleting = false else err = r.error } }) { Text("Kalıcı olarak sil", color = c.down) }
            },
            dismissButton = { TextButton(onClick = { deleting = false }) { Text("Vazgeç") } },
        )
    }
}

// ---------- small parts ----------

@Composable
private fun Field(label: String, value: String, onChange: (String) -> Unit, keyboard: KeyboardType = KeyboardType.Text, secret: Boolean = false, placeholder: String? = null) {
    val c = AppTheme.colors
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        label = { Text(label) },
        placeholder = placeholder?.let { { Text(it) } },
        singleLine = true,
        visualTransformation = if (secret) PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None,
        keyboardOptions = KeyboardOptions(keyboardType = keyboard),
        shape = RoundedCornerShape(14.dp),
        colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = c.goldInk, cursorColor = c.goldInk, focusedLabelColor = c.goldInk),
        modifier = Modifier.fillMaxWidth(),
    )
}

@Composable
private fun PrimaryButton(label: String, enabled: Boolean = true, onClick: () -> Unit) {
    val c = AppTheme.colors
    Box(
        Modifier.fillMaxWidth().heightIn(min = 50.dp).clip(RoundedCornerShape(999.dp)).background(if (enabled) c.text else c.textMuted)
            .clickable(enabled = enabled, role = Role.Button, onClick = onClick).padding(12.dp),
        contentAlignment = Alignment.Center,
    ) { Text(label, color = c.background, style = MaterialTheme.typography.labelLarge) }
}

@Composable
private fun SecondaryButton(label: String, onClick: () -> Unit) {
    val c = AppTheme.colors
    Box(
        Modifier.fillMaxWidth().heightIn(min = 46.dp).clip(RoundedCornerShape(999.dp)).border(1.dp, c.outline, RoundedCornerShape(999.dp))
            .clickable(role = Role.Button, onClick = onClick).padding(10.dp),
        contentAlignment = Alignment.Center,
    ) { Text(label, color = c.text, style = MaterialTheme.typography.labelLarge) }
}

@Composable
private fun Empty(text: String) {
    val c = AppTheme.colors
    AppCard(Modifier.fillMaxWidth()) {
        Text(text, style = MaterialTheme.typography.bodyMedium, color = c.textMuted, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(24.dp))
    }
    Spacer(Modifier.height(4.dp))
}
