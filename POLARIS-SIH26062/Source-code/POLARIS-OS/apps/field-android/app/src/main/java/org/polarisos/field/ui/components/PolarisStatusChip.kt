package org.polarisos.field.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.polarisos.field.ui.theme.PolarisColors
import org.polarisos.field.ui.theme.PolarisDimens

enum class PolarisStatusTone {
    NOMINAL,
    WARNING,
    CRITICAL,
    INFO,
    OFFLINE,
    MUTED
}

/**
 * Standard status badge with dot indicator and uppercase operational typography.
 */
@Composable
fun PolarisStatusChip(
    text: String,
    modifier: Modifier = Modifier,
    tone: PolarisStatusTone = resolveStatusTone(text),
    showDot: Boolean = true
) {
    val (bgColor, textColor, borderColor, dotColor) = when (tone) {
        PolarisStatusTone.NOMINAL -> Quadruple(
            PolarisColors.StatusNominalBg,
            PolarisColors.StatusNominal,
            PolarisColors.StatusNominalBorder,
            PolarisColors.StatusNominal
        )
        PolarisStatusTone.WARNING -> Quadruple(
            PolarisColors.StatusWarningBg,
            PolarisColors.StatusWarning,
            PolarisColors.StatusWarningBorder,
            PolarisColors.StatusWarning
        )
        PolarisStatusTone.CRITICAL -> Quadruple(
            PolarisColors.StatusCriticalBg,
            PolarisColors.StatusCritical,
            PolarisColors.StatusCriticalBorder,
            PolarisColors.StatusCritical
        )
        PolarisStatusTone.INFO -> Quadruple(
            PolarisColors.StatusSyncingBg,
            PolarisColors.StatusSyncing,
            PolarisColors.StatusSyncingBorder,
            PolarisColors.PolarBlue
        )
        PolarisStatusTone.OFFLINE -> Quadruple(
            PolarisColors.StatusOfflineBg,
            PolarisColors.StatusOffline,
            PolarisColors.StatusOfflineBorder,
            PolarisColors.StatusOffline
        )
        PolarisStatusTone.MUTED -> Quadruple(
            PolarisColors.PolarSurfaceAlt,
            PolarisColors.TextMuted,
            PolarisColors.LineLight,
            PolarisColors.TextMuted
        )
    }

    Row(
        modifier = modifier
            .clip(RoundedCornerShape(PolarisDimens.radiusPill))
            .background(bgColor)
            .border(1.dp, borderColor, RoundedCornerShape(PolarisDimens.radiusPill))
            .padding(horizontal = 8.dp, vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        if (showDot) {
            Box(
                modifier = Modifier
                    .size(6.dp)
                    .clip(CircleShape)
                    .background(dotColor)
            )
            Spacer(modifier = Modifier.width(5.dp))
        }
        Text(
            text = text.replace('-', ' ').replace('_', ' ').uppercase(),
            color = textColor,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = FontFamily.SansSerif,
            letterSpacing = 0.5.sp
        )
    }
}

fun resolveStatusTone(raw: String): PolarisStatusTone {
    val lower = raw.lowercase().trim()
    return when {
        lower in listOf("nominal", "synced", "delivered", "active", "in-storage-at-station", "completed", "low", "approved", "ok", "online") -> PolarisStatusTone.NOMINAL
        lower in listOf("warning", "delayed", "pending", "moderate", "in-transit", "packed", "declared", "planning", "reorder") -> PolarisStatusTone.WARNING
        lower in listOf("critical", "danger", "damaged", "high", "aborted", "conflict", "conflicted", "rejected", "error", "failed") -> PolarisStatusTone.CRITICAL
        lower in listOf("syncing", "investigating", "contained", "in-progress", "info") -> PolarisStatusTone.INFO
        lower in listOf("offline", "standby", "unrecorded", "returned", "departed") -> PolarisStatusTone.OFFLINE
        else -> PolarisStatusTone.MUTED
    }
}

private data class Quadruple<A, B, C, D>(val first: A, val second: B, val third: C, val fourth: D)
