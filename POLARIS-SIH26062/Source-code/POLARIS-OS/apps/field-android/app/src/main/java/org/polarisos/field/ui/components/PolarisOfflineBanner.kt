package org.polarisos.field.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import org.polarisos.field.ui.theme.PolarisColors
import org.polarisos.field.ui.theme.PolarisDimens

/**
 * Persistent unobtrusive banner indicating offline status or pending offline operations.
 */
@Composable
fun PolarisOfflineBanner(
    isOnline: Boolean,
    pendingCount: Int,
    modifier: Modifier = Modifier
) {
    AnimatedVisibility(
        visible = !isOnline || pendingCount > 0,
        enter = expandVertically(),
        exit = shrinkVertically()
    ) {
        val bgColor = if (isOnline) PolarisColors.StatusWarningBg else PolarisColors.StatusOfflineBg
        val textColor = if (isOnline) PolarisColors.StatusWarning else PolarisColors.StatusOffline
        val label = if (isOnline) "ONLINE · SYNC PENDING" else "OFFLINE"
        val message = if (isOnline) {
            "$pendingCount operation${if (pendingCount == 1) "" else "s"} awaiting synchronization"
        } else if (pendingCount > 0) {
            "$pendingCount operation${if (pendingCount == 1) "" else "s"} queued for reconnect"
        } else {
            "Local records available; changes will queue on this device"
        }

        Row(
            modifier = modifier
                .fillMaxWidth()
                .background(bgColor)
                .padding(horizontal = PolarisDimens.space4, vertical = PolarisDimens.space2)
                .semantics { liveRegion = LiveRegionMode.Polite },
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(7.dp)
                    .clip(CircleShape)
                    .background(textColor)
            )
            Spacer(modifier = Modifier.width(PolarisDimens.space2))
            Column {
                Text(label, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = textColor, letterSpacing = 0.55.sp)
                Text(message, fontSize = 11.sp, fontWeight = FontWeight.Medium, color = textColor, maxLines = 1)
            }
        }
    }
}
