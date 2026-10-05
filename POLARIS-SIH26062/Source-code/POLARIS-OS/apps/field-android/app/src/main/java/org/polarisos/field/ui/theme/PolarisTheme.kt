package org.polarisos.field.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val PolarisLightColorScheme = lightColorScheme(
    primary = PolarisColors.PolarBlue,
    onPrimary = PolarisColors.TextOnPrimary,
    primaryContainer = PolarisColors.PolarIceSoft,
    onPrimaryContainer = PolarisColors.PolarBlueDark,

    secondary = PolarisColors.Navy900,
    onSecondary = PolarisColors.TextOnPrimary,
    secondaryContainer = PolarisColors.PolarSurfaceAlt,
    onSecondaryContainer = PolarisColors.TextPrimary,

    tertiary = PolarisColors.PolarCyan,
    onTertiary = PolarisColors.Navy950,

    background = PolarisColors.PolarBg,
    onBackground = PolarisColors.TextPrimary,

    surface = PolarisColors.PolarSurface,
    onSurface = PolarisColors.TextPrimary,
    surfaceVariant = PolarisColors.PolarSurfaceAlt,
    onSurfaceVariant = PolarisColors.TextMuted,

    outline = PolarisColors.LineLight,
    outlineVariant = PolarisColors.LineSubtle,

    error = PolarisColors.StatusCritical,
    onError = PolarisColors.TextOnPrimary,
    errorContainer = PolarisColors.StatusCriticalBg,
    onErrorContainer = PolarisColors.StatusCritical
)

private val PolarisShapes = Shapes(
    extraSmall = RoundedCornerShape(PolarisDimens.radiusXs),
    small = RoundedCornerShape(PolarisDimens.radiusSm),
    medium = RoundedCornerShape(PolarisDimens.radiusMd),
    large = RoundedCornerShape(PolarisDimens.radiusLg),
    extraLarge = RoundedCornerShape(PolarisDimens.radiusXl)
)

@Composable
fun PolarisTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = PolarisLightColorScheme,
        typography = PolarisTypography,
        shapes = PolarisShapes,
        content = content
    )
}
