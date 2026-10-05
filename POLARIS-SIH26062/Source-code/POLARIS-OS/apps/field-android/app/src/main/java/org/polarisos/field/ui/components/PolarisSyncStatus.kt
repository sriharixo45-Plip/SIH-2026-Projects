package org.polarisos.field.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.polarisos.field.ui.theme.PolarisColors
import org.polarisos.field.ui.theme.PolarisDimens

/**
 * Compact pill showing network telemetry and pending queue count.
 */
@Composable
fun PolarisSyncStatus(
    isOnline: Boolean,
    pendingCount: Int,
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null
) {
    val clickableModifier = if (onClick != null) modifier.clickable(onClick = onClick) else modifier

    val (dotColor, text, textColor, bg, border) = when {
        !isOnline -> Quintuple(
            PolarisColors.StatusOffline,
            if (pendingCount > 0) "OFFLINE ($pendingCount)" else "OFFLINE",
            PolarisColors.StatusOffline,
            PolarisColors.StatusOfflineBg,
            PolarisColors.StatusOfflineBorder
        )
        pendingCount > 0 -> Quintuple(
            PolarisColors.StatusWarning,
            "SYNC PENDING ($pendingCount)",
            PolarisColors.StatusWarning,
            PolarisColors.StatusWarningBg,
            PolarisColors.StatusWarningBorder
        )
        else -> Quintuple(
            PolarisColors.StatusNominal,
            "ONLINE • SYNCED",
            PolarisColors.StatusNominal,
            PolarisColors.StatusNominalBg,
            PolarisColors.StatusNominalBorder
        )
    }

    Row(
        modifier = clickableModifier
            .clip(RoundedCornerShape(PolarisDimens.radiusPill))
            .background(bg)
            .border(1.dp, border, RoundedCornerShape(PolarisDimens.radiusPill))
            .padding(horizontal = 8.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(6.dp)
                .clip(CircleShape)
                .background(dotColor)
        )
        Spacer(modifier = Modifier.width(5.dp))
        Text(
            text = text,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            color = textColor,
            letterSpacing = 0.5.sp
        )
    }
}

private data class Quintuple<A, B, C, D, E>(val first: A, val second: B, val third: C, val fourth: D, val fifth: E)
