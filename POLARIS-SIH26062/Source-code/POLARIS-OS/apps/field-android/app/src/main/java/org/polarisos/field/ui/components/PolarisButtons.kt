package org.polarisos.field.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.polarisos.field.ui.theme.PolarisColors
import org.polarisos.field.ui.theme.PolarisDimens

@Composable
fun PolarisPrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    loading: Boolean = false,
    leadingIcon: (@Composable () -> Unit)? = null
) {
    Button(
        onClick = onClick,
        modifier = modifier
            .fillMaxWidth()
            .defaultMinSize(minHeight = PolarisDimens.minTouchTarget),
        enabled = enabled && !loading,
        shape = RoundedCornerShape(PolarisDimens.radiusSm),
        colors = ButtonDefaults.buttonColors(
            containerColor = PolarisColors.PolarBlue,
            contentColor = PolarisColors.TextOnPrimary,
            disabledContainerColor = PolarisColors.LineLight,
            disabledContentColor = PolarisColors.TextFaint
        ),
        contentPadding = PaddingValues(horizontal = PolarisDimens.space4, vertical = PolarisDimens.space3)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (loading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(16.dp),
                    color = PolarisColors.TextOnPrimary,
                    strokeWidth = 2.dp
                )
                Spacer(modifier = Modifier.width(PolarisDimens.space2))
            } else if (leadingIcon != null) {
                leadingIcon()
                Spacer(modifier = Modifier.width(PolarisDimens.space2))
            }
            Text(
                text = text,
                fontWeight = FontWeight.SemiBold,
                fontSize = 14.sp,
                letterSpacing = 0.25.sp
            )
        }
    }
}

@Composable
fun PolarisSecondaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    leadingIcon: (@Composable () -> Unit)? = null
) {
    OutlinedButton(
        onClick = onClick,
        modifier = modifier
            .fillMaxWidth()
            .defaultMinSize(minHeight = PolarisDimens.minTouchTarget),
        enabled = enabled,
        shape = RoundedCornerShape(PolarisDimens.radiusSm),
        border = BorderStroke(1.dp, if (enabled) PolarisColors.LineLight else PolarisColors.PolarSurfaceMuted),
        colors = ButtonDefaults.outlinedButtonColors(
            contentColor = PolarisColors.TextPrimary,
            disabledContentColor = PolarisColors.TextFaint
        ),
        contentPadding = PaddingValues(horizontal = PolarisDimens.space4, vertical = PolarisDimens.space3)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (leadingIcon != null) {
                leadingIcon()
                Spacer(modifier = Modifier.width(PolarisDimens.space2))
            }
            Text(
                text = text,
                fontWeight = FontWeight.Medium,
                fontSize = 14.sp
            )
        }
    }
}

@Composable
fun PolarisDangerButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    loading: Boolean = false
) {
    Button(
        onClick = onClick,
        modifier = modifier
            .fillMaxWidth()
            .defaultMinSize(minHeight = PolarisDimens.minTouchTarget),
        enabled = enabled && !loading,
        shape = RoundedCornerShape(PolarisDimens.radiusSm),
        colors = ButtonDefaults.buttonColors(
            containerColor = PolarisColors.StatusCritical,
            contentColor = Color.White,
            disabledContainerColor = PolarisColors.LineLight,
            disabledContentColor = PolarisColors.TextFaint
        ),
        contentPadding = PaddingValues(horizontal = PolarisDimens.space4, vertical = PolarisDimens.space3)
    ) {
        if (loading) {
            CircularProgressIndicator(
                modifier = Modifier.size(16.dp),
                color = Color.White,
                strokeWidth = 2.dp
            )
            Spacer(modifier = Modifier.width(PolarisDimens.space2))
        }
        Text(
            text = text,
            fontWeight = FontWeight.SemiBold,
            fontSize = 14.sp
        )
    }
}
