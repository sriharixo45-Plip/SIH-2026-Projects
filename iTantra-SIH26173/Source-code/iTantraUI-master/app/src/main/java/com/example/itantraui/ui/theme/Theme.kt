package com.example.itantraui.ui.theme

import android.app.Activity
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val ITantraColorScheme = darkColorScheme(
    primary = Color(0xFF00E676),
    onPrimary = Color(0xFF00220E),
    primaryContainer = Color(0xFF073C32),
    onPrimaryContainer = Color(0xFFF1F5F9),
    secondary = Color(0xFF00D9FF),
    onSecondary = Color(0xFF080D14),
    background = Color(0xFF080D14),
    onBackground = Color(0xFFF1F5F9),
    surface = Color(0xFF141B27),
    onSurface = Color(0xFFF1F5F9),
    surfaceVariant = Color(0xFF0D2927),
    onSurfaceVariant = Color(0xFF94A3B8),
    outline = Color(0xFF29364A),
    error = Color(0xFFFF3B4A)
)

private val ITantraLightColorScheme = lightColorScheme(
    primary = Color(0xFF087A46),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFD4F5E2),
    onPrimaryContainer = Color(0xFF082D1C),
    secondary = Color(0xFF006B7A),
    onSecondary = Color.White,
    background = Color(0xFFF4F7F8),
    onBackground = Color(0xFF17212B),
    surface = Color.White,
    onSurface = Color(0xFF17212B),
    surfaceVariant = Color(0xFFE8EEF1),
    onSurfaceVariant = Color(0xFF4D5B66),
    outline = Color(0xFFB7C3CB),
    error = Color(0xFFB3261E)
)

@Composable
fun ITantraUITheme(
    darkTheme: Boolean = true,
    dynamicColor: Boolean = false,
    content: @Composable () -> Unit
) {
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = (if (darkTheme) Color(0xFF0D2927) else Color(0xFFF4F7F8)).toArgb()
            window.navigationBarColor = (if (darkTheme) Color(0xFF080D14) else Color(0xFFF4F7F8)).toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = !darkTheme
            WindowCompat.getInsetsController(window, view).isAppearanceLightNavigationBars = !darkTheme
        }
    }

    MaterialTheme(
        colorScheme = if (darkTheme) ITantraColorScheme else ITantraLightColorScheme,
        typography = Typography,
        content = content
    )
}
