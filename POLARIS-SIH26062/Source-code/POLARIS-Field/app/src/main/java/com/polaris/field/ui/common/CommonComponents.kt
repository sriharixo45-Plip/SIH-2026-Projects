package com.polaris.field.ui.common

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.polaris.field.ui.theme.*

@Composable
fun SyntheticDataBanner(modifier: Modifier = Modifier) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        color = SemanticAmber.copy(alpha = 0.12f),
        contentColor = SemanticAmber,
        border = BorderStroke(1.dp, SemanticAmber.copy(alpha = 0.3f)),
        shape = RoundedCornerShape(6.dp)
    ) {
        Text(
            text = "Synthetic demonstration data — not operational NCPOR data.",
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.SemiBold,
            fontSize = 11.sp
        )
    }
}

@Composable
fun OfflineStateBanner(lastSyncFormatted: String, modifier: Modifier = Modifier) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        color = SemanticRed.copy(alpha = 0.1f),
        contentColor = SemanticRed,
        border = BorderStroke(1.dp, SemanticRed.copy(alpha = 0.3f)),
        shape = RoundedCornerShape(6.dp)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = "OFFLINE MODE — Operations enqueued locally",
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "Last sync: $lastSyncFormatted",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
fun StatusChip(status: String, modifier: Modifier = Modifier) {
    val (bgColor, textColor, borderColor) = when (status.uppercase()) {
        "CONFIRMED", "RECEIVED", "RESOLVED", "SYNCED", "NORMAL", "ACTIVE DEPLOYMENT" -> 
            Triple(SemanticGreen.copy(alpha = 0.15f), SemanticGreen, SemanticGreen.copy(alpha = 0.4f))
        "IN TRANSIT", "PENDING", "LOW STOCK", "DECLARED", "LOW" -> 
            Triple(SemanticAmber.copy(alpha = 0.15f), SemanticAmber, SemanticAmber.copy(alpha = 0.4f))
        "CRITICAL", "FAILED", "DAMAGED", "CONFLICT", "DELAYED" -> 
            Triple(SemanticRed.copy(alpha = 0.15f), SemanticRed, SemanticRed.copy(alpha = 0.4f))
        else -> 
            Triple(MaterialTheme.colorScheme.surfaceVariant, MaterialTheme.colorScheme.primary, MaterialTheme.colorScheme.outline)
    }

    Surface(
        modifier = modifier,
        color = bgColor,
        contentColor = textColor,
        border = BorderStroke(1.dp, borderColor),
        shape = RoundedCornerShape(6.dp)
    ) {
        Text(
            text = status.uppercase(),
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Bold,
            fontSize = 10.sp
        )
    }
}

@Composable
fun OperationalCard(
    modifier: Modifier = Modifier,
    borderColor: Color = MaterialTheme.colorScheme.outline,
    content: @Composable ColumnScope.() -> Unit
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, borderColor),
        shape = RoundedCornerShape(8.dp),
        shadowElevation = 0.dp
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            content = content
        )
    }
}
