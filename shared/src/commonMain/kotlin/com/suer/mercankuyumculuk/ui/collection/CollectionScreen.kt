package com.suer.mercankuyumculuk.ui.collection

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.backhandler.BackHandler
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.suer.mercankuyumculuk.AppGraph
import com.suer.mercankuyumculuk.ExternalLinks
import com.suer.mercankuyumculuk.core.TrFormat
import com.suer.mercankuyumculuk.data.config.GramPrices
import com.suer.mercankuyumculuk.data.config.SiteCategory
import com.suer.mercankuyumculuk.data.config.SiteItem
import com.suer.mercankuyumculuk.data.market.MarketState
import com.suer.mercankuyumculuk.ui.icons.AppIcons
import com.suer.mercankuyumculuk.ui.theme.AppTheme

/** "12,5 gr" */
internal fun gramLabel(g: Double): String =
    (if (g % 1.0 == 0.0) TrFormat.number(g, 0) else TrFormat.number(g, 2).trimEnd('0').trimEnd(',')) + " gr"

/**
 * Collection from the admin panel: categories, then the items of a category with gram options.
 * An item's price is gram × the store's gram sell price of its priceCode (with the admin's overrides).
 */
@OptIn(ExperimentalComposeUiApi::class)
@Composable
fun CollectionScreen(state: MarketState, modifier: Modifier = Modifier) {
    val site = state.site
    var openId by rememberSaveable { mutableStateOf<String?>(null) }
    val open = site.visibleCategories.firstOrNull { it.id == openId }
    BackHandler(enabled = open != null) { openId = null }

    AnimatedContent(
        targetState = open,
        transitionSpec = { fadeIn() togetherWith fadeOut() },
        modifier = modifier.fillMaxSize(),
        label = "collection",
    ) { category ->
        if (category == null) {
            CategoryGrid(site.visibleCategories, countOf = { site.itemsIn(it).size }, onOpen = { openId = it.id })
        } else {
            CategoryItems(category, site.itemsIn(category.id), state, onBack = { openId = null })
        }
    }
}

@Composable
private fun CategoryGrid(categories: List<SiteCategory>, countOf: (String) -> Int, onOpen: (SiteCategory) -> Unit) {
    val c = AppTheme.colors
    LazyVerticalGrid(
        columns = GridCells.Adaptive(160.dp),
        contentPadding = PaddingValues(16.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        modifier = Modifier.fillMaxSize(),
    ) {
        item(span = { GridItemSpan(maxLineSpan) }) {
            Column(Modifier.padding(bottom = 6.dp)) {
                Text("KOLEKSİYON", style = MaterialTheme.typography.labelSmall, color = c.goldInk, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(6.dp))
                Text(
                    "Her ana yakışan bir parça",
                    style = MaterialTheme.typography.headlineSmall,
                    color = c.text,
                    modifier = Modifier.semantics { heading() },
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    "Bir kategori seçin; beğendiğiniz modelin gramını seçip WhatsApp’tan fiyat sorun.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = c.textMuted,
                )
            }
        }
        items(categories, key = { it.id }) { cat ->
            val count = countOf(cat.id)
            Column(
                Modifier
                    .clip(RoundedCornerShape(18.dp))
                    .background(c.card)
                    .border(1.dp, c.outline, RoundedCornerShape(18.dp))
                    .clickable(role = Role.Button, onClickLabel = "${cat.title} kategorisini aç") { onOpen(cat) },
            ) {
                Box(Modifier.fillMaxWidth().aspectRatio(4f / 3f).background(c.cardHigh), contentAlignment = Alignment.Center) {
                    if (cat.image.isNotBlank()) MediaImage(cat.image, Modifier.fillMaxSize())
                    else Monogram(cat.title)
                }
                Column(Modifier.padding(horizontal = 12.dp, vertical = 10.dp)) {
                    Text(cat.title, style = MaterialTheme.typography.titleSmall, color = c.text, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(
                        if (count > 0) "$count model" else cat.subtitle,
                        style = MaterialTheme.typography.bodySmall,
                        color = c.textMuted,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
        }
    }
}

@Composable
private fun CategoryItems(category: SiteCategory, items: List<SiteItem>, state: MarketState, onBack: () -> Unit) {
    val c = AppTheme.colors
    val uri = LocalUriHandler.current
    val whatsapp = state.store.whatsapp.ifBlank { state.store.phone }
    fun ask(text: String) = runCatching { uri.openUri(ExternalLinks.whatsapp(whatsapp, text)) }

    LazyVerticalGrid(
        columns = GridCells.Adaptive(168.dp),
        contentPadding = PaddingValues(16.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        modifier = Modifier.fillMaxSize(),
    ) {
        item(span = { GridItemSpan(maxLineSpan) }) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    Modifier
                        .size(44.dp)
                        .clip(CircleShape)
                        .border(1.dp, c.outline, CircleShape)
                        .clickable(role = Role.Button, onClick = onBack)
                        .semantics { contentDescription = "Kategorilere dön" },
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(AppIcons.ChevronRight, null, tint = c.text, modifier = Modifier.size(20.dp).graphicsFlip())
                }
                Spacer(Modifier.width(12.dp))
                Column {
                    Text(category.title, style = MaterialTheme.typography.headlineSmall, color = c.text, modifier = Modifier.semantics { heading() })
                    if (category.subtitle.isNotBlank()) Text(category.subtitle, style = MaterialTheme.typography.bodySmall, color = c.textMuted)
                }
            }
        }
        if (items.isEmpty()) {
            item(span = { GridItemSpan(maxLineSpan) }) {
                Column(
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(18.dp))
                        .background(c.card)
                        .border(1.dp, c.outline, RoundedCornerShape(18.dp))
                        .padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Monogram(category.title)
                    Spacer(Modifier.height(12.dp))
                    Text("${category.title} modellerimiz mağazamızda", style = MaterialTheme.typography.titleMedium, color = c.text)
                    Spacer(Modifier.height(6.dp))
                    Text(
                        "Güncel modelleri ve fiyatları WhatsApp’tan sorun, fotoğraflarını hemen gönderelim.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = c.textMuted,
                    )
                    Spacer(Modifier.height(14.dp))
                    PillButton("WhatsApp’tan sorun") { ask("Merhaba, ${category.title} modellerinizi görmek istiyorum.") }
                }
            }
        }
        items(items, key = { it.id }) { item ->
            ItemCard(item, state, onAsk = { gram ->
                ask("Merhaba, \"${item.name}\"${gram?.let { " (${gramLabel(it)})" } ?: ""} hakkında bilgi almak istiyorum.")
            })
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ItemCard(item: SiteItem, state: MarketState, onAsk: (Double?) -> Unit) {
    val c = AppTheme.colors
    var gram by rememberSaveable(item.id) { mutableStateOf(item.grams.firstOrNull()) }
    LaunchedEffect(item.grams) { if (gram !in item.grams) gram = item.grams.firstOrNull() }

    Column(
        Modifier
            .clip(RoundedCornerShape(18.dp))
            .background(c.card)
            .border(1.dp, c.outline, RoundedCornerShape(18.dp)),
    ) {
        Box(Modifier.fillMaxWidth().aspectRatio(1f).background(c.cardHigh), contentAlignment = Alignment.Center) {
            if (item.image.isNotBlank()) MediaImage(item.image, Modifier.fillMaxSize()) else Monogram(item.name)
        }
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            val meta = item.detail
            if (meta.isNotBlank()) Text(meta.uppercase(), style = MaterialTheme.typography.labelSmall, color = c.goldInk, maxLines = 2)
            Text(item.name, style = MaterialTheme.typography.titleSmall, color = c.text)
            if (item.description.isNotBlank()) Text(item.description, style = MaterialTheme.typography.bodySmall, color = c.textMuted, maxLines = 3, overflow = TextOverflow.Ellipsis)
            if (item.grams.size > 1) {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    item.grams.forEach { g ->
                        val on = g == gram
                        Box(
                            Modifier
                                .heightIn(min = 36.dp)
                                .clip(CircleShape)
                                .background(if (on) c.text else c.card)
                                .border(1.dp, if (on) c.text else c.outline, CircleShape)
                                .clickable(role = Role.RadioButton) { gram = g }
                                .semantics { selected = on }
                                .padding(horizontal = 12.dp, vertical = 8.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(gramLabel(g), style = MaterialTheme.typography.labelMedium, color = if (on) c.background else c.text)
                        }
                    }
                }
            }
            if (item.grams.size == 1) {
                Text(gramLabel(item.grams[0]), style = MaterialTheme.typography.titleMedium, color = c.text)
            }
            PillButton("WhatsApp’tan sor", Modifier.fillMaxWidth()) { onAsk(gram) }
        }
    }
}

@Composable
private fun PillButton(label: String, modifier: Modifier = Modifier, onClick: () -> Unit) {
    val c = AppTheme.colors
    Box(
        modifier
            .heightIn(min = 44.dp)
            .clip(CircleShape)
            .background(c.text)
            .clickable(role = Role.Button, onClick = onClick)
            .padding(horizontal = 18.dp, vertical = 10.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(label, style = MaterialTheme.typography.labelLarge, color = c.background)
    }
}

/** Gold initial in a ring, used when a category or item has no photo. */
@Composable
private fun Monogram(title: String) {
    val c = AppTheme.colors
    Box(
        Modifier.size(64.dp).clip(CircleShape).border(1.dp, c.goldInk.copy(alpha = 0.6f), CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Icon(AppIcons.Diamond, contentDescription = null, tint = c.goldInk, modifier = Modifier.size(28.dp))
    }
}

@Composable
private fun MediaImage(id: String, modifier: Modifier) {
    val loader = AppGraph.media
    val image by produceState<ImageBitmap?>(loader.cached(id), id) { if (value == null) value = loader.load(id) }
    val bitmap = image
    if (bitmap != null) {
        Image(bitmap, contentDescription = null, contentScale = ContentScale.Crop, modifier = modifier)
    } else {
        Box(modifier, contentAlignment = Alignment.Center) {
            Icon(AppIcons.Diamond, contentDescription = null, tint = AppTheme.colors.goldInk.copy(alpha = 0.5f), modifier = Modifier.size(28.dp))
        }
    }
}

/** Mirrors the chevron so it points back. */
private fun Modifier.graphicsFlip(): Modifier = this.graphicsLayer(scaleX = -1f)
