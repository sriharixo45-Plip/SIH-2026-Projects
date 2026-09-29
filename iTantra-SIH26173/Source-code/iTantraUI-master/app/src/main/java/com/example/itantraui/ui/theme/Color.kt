package com.example.itantraui.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// Theme-aware palette aliases used by the app UI.
val PrimaryBrandGreen: Color @Composable get() = MaterialTheme.colorScheme.primary
val DeepGreen: Color @Composable get() = MaterialTheme.colorScheme.primaryContainer
val MainBackground: Color @Composable get() = MaterialTheme.colorScheme.background
val HeaderBackground: Color @Composable get() = MaterialTheme.colorScheme.surfaceVariant
val CardSurface: Color @Composable get() = MaterialTheme.colorScheme.surface
val BorderColor: Color @Composable get() = MaterialTheme.colorScheme.outline
val PrimaryText: Color @Composable get() = MaterialTheme.colorScheme.onSurface
val SecondaryText: Color @Composable get() = MaterialTheme.colorScheme.onSurfaceVariant
val MutedText: Color @Composable get() = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.72f)
val TechnicalCyan: Color @Composable get() = MaterialTheme.colorScheme.secondary
val ErrorEmergencyRed: Color @Composable get() = MaterialTheme.colorScheme.error
val DeepGreenHighlight: Color @Composable get() = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.32f)
val GreenGlow: Color @Composable get() = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.16f)
val TextOnBrandGreen: Color @Composable get() = MaterialTheme.colorScheme.onPrimary
