package org.polarisos.field.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.polarisos.field.ui.theme.PolarisCodeTypography
import org.polarisos.field.ui.theme.PolarisColors
import org.polarisos.field.ui.theme.PolarisDimens

@Composable
fun PolarisListItem(
    code: String,
    title: String,
    statusText: String,
    modifier: Modifier = Modifier,
    statusTone: PolarisStatusTone = resolveStatusTone(statusText),
    subtitle: String? = null,
    metadataList: List<String> = emptyList(),
    actionLabel: String? = null,
    onActionClick: (() -> Unit)? = null,
    onClick: (() -> Unit)? = null
) {
    val clickableModifier = if (onClick != null) modifier.clickable(onClick = onClick) else modifier

    Surface(
        modifier = clickableModifier.fillMaxWidth(),
        shape = RoundedCornerShape(PolarisDimens.radiusMd),
        color = PolarisColors.PolarSurface,
        border = BorderStroke(1.dp, PolarisColors.LineLight),
        shadowElevation = PolarisDimens.elevationSubtle
    ) {
        Column(
            modifier = Modifier.padding(PolarisDimens.space3)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = code,
                    style = PolarisCodeTypography.codeMedium,
                    fontWeight = FontWeight.Bold,
                    color = PolarisColors.TextPrimary
                )
                PolarisStatusChip(text = statusText, tone = statusTone)
            }

            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = title,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = PolarisColors.TextPrimary
            )

            if (!subtitle.isNullOrBlank()) {
                Text(
                    text = subtitle,
                    fontSize = 12.sp,
                    color = PolarisColors.TextMuted,
                    modifier = Modifier.padding(top = 2.dp)
                )
            }

            if (metadataList.isNotEmpty()) {
                Spacer(modifier = Modifier.height(6.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    metadataList.forEach { meta ->
                        Text(
                            text = meta,
                            fontSize = 11.sp,
                            color = PolarisColors.TextMuted,
                            fontFamily = FontFamily.SansSerif
                        )
                    }
                }
            }

            if (actionLabel != null && onActionClick != null) {
                Spacer(modifier = Modifier.height(8.dp))
                PolarisSecondaryButton(
                    text = actionLabel,
                    onClick = onActionClick,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }
    }
}
