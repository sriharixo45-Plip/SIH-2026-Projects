package org.polarisos.field.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import org.polarisos.field.ui.theme.PolarisColors
import org.polarisos.field.ui.theme.PolarisDimens

/**
 * Standard POLARIS operational card with crisp polar borders and subtle elevation.
 */
@Composable
fun PolarisCard(
    modifier: Modifier = Modifier,
    backgroundColor: Color = PolarisColors.PolarSurface,
    borderColor: Color = PolarisColors.LineLight,
    borderWidth: Dp = 1.dp,
    cornerRadius: Dp = PolarisDimens.radiusMd,
    onClick: (() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit
) {
    val clickableModifier = if (onClick != null) modifier.clickable(onClick = onClick) else modifier
    Surface(
        modifier = clickableModifier.fillMaxWidth(),
        shape = RoundedCornerShape(cornerRadius),
        color = backgroundColor,
        border = BorderStroke(borderWidth, borderColor),
        shadowElevation = PolarisDimens.elevationSubtle
    ) {
        Column(
            modifier = Modifier.padding(PolarisDimens.space3),
            content = content
        )
    }
}
