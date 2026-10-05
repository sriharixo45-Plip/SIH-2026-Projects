package org.polarisos.field.ui.theme

import androidx.compose.ui.graphics.Color

/**
 * POLARIS-OS Mobile Design System — Polar Operational Palette
 * Inspired by Arctic expedition operations and the POLARIS HQ Dashboard.
 * Focuses on high-contrast, professional, technical field readability.
 */
object PolarisColors {
    // Primary Polar Navy & Night Tones
    val Navy950 = Color(0xFF060F1A)       // Deepest polar night
    val Navy900 = Color(0xFF0B192C)       // Primary deep navy
    val Navy800 = Color(0xFF0D1E2E)       // Operational surface dark
    val Navy700 = Color(0xFF142333)       // Secondary surface dark
    val Navy600 = Color(0xFF1E3448)       // Dark borders / dividers

    // Polar Light & Ice Surfaces (Optimized for outdoor and daylight field contrast)
    val PolarBg = Color(0xFFF1F5F9)        // Crisp polar light background
    val PolarSurface = Color(0xFFFFFFFF)   // Pure white card / panel surface
    val PolarSurfaceAlt = Color(0xFFF8FAFC)// Muted panel background
    val PolarSurfaceMuted = Color(0xFFE2E8F0) // Recessed wells / borders

    // Polar Blues & Accents
    val PolarBlue = Color(0xFF0284C7)      // Primary polar blue
    val PolarBlueDark = Color(0xFF0369A1)  // Dark polar blue for high contrast text
    val PolarBlueLight = Color(0xFF38BDF8) // Bright ice highlight
    val PolarIce = Color(0xFFBAE6FD)       // Soft ice tint
    val PolarIceSoft = Color(0xFFE0F2FE)   // Very soft ice tint for backgrounds
    val PolarCyan = Color(0xFF06B6D4)      // Live / Telemetry accent

    // Technical Dividing Rules & Borders
    val LineLight = Color(0xFFCBD5E1)      // Standard card and field border
    val LineSubtle = Color(0xFFE2E8F0)     // Subtle internal dividers
    val LineFocus = Color(0xFF0284C7)      // Focused field border

    // Operational Typography Colors
    val TextPrimary = Color(0xFF0F172A)    // High-contrast primary slate
    val TextSecondary = Color(0xFF334155)  // Secondary readable slate
    val TextMuted = Color(0xFF64748B)      // Metadata & labels
    val TextFaint = Color(0xFF94A3B8)      // Disabled / placeholders
    val TextOnPrimary = Color(0xFFFFFFFF)  // Text on dark/blue surfaces
    val TextOnIce = Color(0xFF0369A1)      // Text on ice pills

    // Semantic Status Colors (Restrained, high-visibility operational signals)
    // Nominal / Success / Synced
    val StatusNominal = Color(0xFF16A34A)
    val StatusNominalBg = Color(0xFFDCFCE7)
    val StatusNominalBorder = Color(0xFF86EFAC)

    // Warning / Advisory / Pending
    val StatusWarning = Color(0xFFD97706)
    val StatusWarningBg = Color(0xFFFEF3C7)
    val StatusWarningBorder = Color(0xFFFCD34D)

    // Critical / Danger / Alert / Conflict
    val StatusCritical = Color(0xFFDC2626)
    val StatusCriticalBg = Color(0xFFFEE2E2)
    val StatusCriticalBorder = Color(0xFFFCA5A5)

    // Offline / Standby / Neutral
    val StatusOffline = Color(0xFF475569)
    val StatusOfflineBg = Color(0xFFF1F5F9)
    val StatusOfflineBorder = Color(0xFFCBD5E1)

    // Syncing / In-Progress
    val StatusSyncing = Color(0xFF0284C7)
    val StatusSyncingBg = Color(0xFFE0F2FE)
    val StatusSyncingBorder = Color(0xFF7DD3FC)
}
