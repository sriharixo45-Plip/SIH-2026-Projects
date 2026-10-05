package org.polarisos.field.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.polarisos.field.ui.theme.PolarisColors
import org.polarisos.field.ui.theme.PolarisDimens

@Composable
fun PolarisErrorBanner(
    message: String,
    modifier: Modifier = Modifier,
    retryLabel: String? = null,
    onRetry: (() -> Unit)? = null
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(PolarisColors.StatusCriticalBg, RoundedCornerShape(PolarisDimens.radiusSm))
            .border(1.dp, PolarisColors.StatusCriticalBorder, RoundedCornerShape(PolarisDimens.radiusSm))
            .padding(PolarisDimens.space3)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            PolarisIcons.AlertTriangle(size = 18.dp, color = PolarisColors.StatusCritical)
            Spacer(modifier = Modifier.width(PolarisDimens.space2))
            Text(
                text = "OPERATIONAL ERROR",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = PolarisColors.StatusCritical,
                letterSpacing = 0.5.sp
            )
        }
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = message,
            fontSize = 13.sp,
            color = PolarisColors.TextPrimary,
            lineHeight = 18.sp
        )
        if (retryLabel != null && onRetry != null) {
            Spacer(modifier = Modifier.height(8.dp))
            PolarisSecondaryButton(
                text = retryLabel,
                onClick = onRetry,
                modifier = Modifier.fillMaxWidth(0.5f)
            )
        }
    }
}
