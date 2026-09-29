package com.polaris.field.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// Dark Navy / Slate Palette (Default)
val DarkBackground = Color(0xFF07111F)
val DarkSurface = Color(0xFF0D1B2A)
val DarkSurfaceVariant = Color(0xFF122337)
val DarkBorder = Color(0xFF24384D)
val DarkTextPrimary = Color(0xFFF1F5F9)
val DarkTextSecondary = Color(0xFF94A3B8)
val DarkPrimaryAccent = Color(0xFF38BDF8)

// Light Enterprise Polar Palette
val LightBackground = Color(0xFFF8FAFC)
val LightSurface = Color(0xFFFFFFFF)
val LightSurfaceVariant = Color(0xFFF1F5F9)
val LightBorder = Color(0xFFE2E8F0)
val LightTextPrimary = Color(0xFF0F172A)
val LightTextSecondary = Color(0xFF64748B)
val LightPrimaryAccent = Color(0xFF0284C7)

// Shared Semantic Statuses
val SemanticGreen = Color(0xFF22C55E)
val SemanticAmber = Color(0xFFF59E0B)
val SemanticRed = Color(0xFFEF4444)

// Dynamic Composable Color Getters driven by MaterialTheme.colorScheme
val EnterpriseBackground @Composable get() = MaterialTheme.colorScheme.background
val EnterpriseSurface @Composable get() = MaterialTheme.colorScheme.surface
val EnterpriseSurfaceVariant @Composable get() = MaterialTheme.colorScheme.surfaceVariant
val EnterpriseBorder @Composable get() = MaterialTheme.colorScheme.outline
val TextPrimaryCharcoal @Composable get() = MaterialTheme.colorScheme.onSurface
val TextSecondaryMuted @Composable get() = MaterialTheme.colorScheme.onSurfaceVariant
val PolarBlueAccent @Composable get() = MaterialTheme.colorScheme.primary
