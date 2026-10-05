package org.polarisos.field.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
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
import org.polarisos.field.ui.theme.PolarisColors
import org.polarisos.field.ui.theme.PolarisDimens

@Composable
fun PolarisMetricCard(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
    subtext: String? = null,
    valueColor: Color = PolarisColors.TextPrimary,
    accentColor: Color = PolarisColors.PolarBlue,
    icon: (@Composable () -> Unit)? = null,
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
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = label.uppercase(),
                    color = PolarisColors.TextMuted,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = 0.5.sp,
                    modifier = Modifier.weight(1f)
                )
                if (icon != null) {
                    Box(modifier = Modifier.padding(start = 4.dp)) {
                        icon()
                    }
                }
            }
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                text = value,
                color = valueColor,
                fontSize = 22.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.SansSerif
            )
            if (subtext != null) {
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = subtext,
                    color = PolarisColors.TextMuted,
                    fontSize = 11.sp,
                    maxLines = 1
                )
            }
        }
    }
}
