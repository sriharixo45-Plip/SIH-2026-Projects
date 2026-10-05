package org.polarisos.field.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import org.polarisos.field.ui.theme.PolarisColors

/**
 * Technical operational icons drawn via vector canvas for crisp rendering and zero external icon bloat.
 */
object PolarisIcons {

    @Composable
    fun PolarisStar(modifier: Modifier = Modifier, size: Dp = 24.dp, color: Color = PolarisColors.PolarBlue) {
        Canvas(modifier = modifier.size(size)) {
            val cx = this.size.width / 2f
            val cy = this.size.height / 2f
            val r = this.size.width * 0.45f
            val inner = r * 0.28f

            val path = Path().apply {
                moveTo(cx, cy - r)
                lineTo(cx + inner, cy - inner)
                lineTo(cx + r, cy)
                lineTo(cx + inner, cy + inner)
                lineTo(cx, cy + r)
                lineTo(cx - inner, cy + inner)
                lineTo(cx - r, cy)
                lineTo(cx - inner, cy - inner)
                close()
            }
            drawPath(path, color)

            // Small 4-point secondary cardinal rays
            val ray = r * 0.6f
            val rayInner = inner * 0.6f
            val rayPath = Path().apply {
                moveTo(cx + ray * 0.7f, cy - ray * 0.7f)
                lineTo(cx, cy)
                moveTo(cx + ray * 0.7f, cy + ray * 0.7f)
                lineTo(cx, cy)
                moveTo(cx - ray * 0.7f, cy + ray * 0.7f)
                lineTo(cx, cy)
                moveTo(cx - ray * 0.7f, cy - ray * 0.7f)
                lineTo(cx, cy)
            }
            drawPath(rayPath, color.copy(alpha = 0.6f), style = Stroke(width = 1.5.dp.toPx(), cap = StrokeCap.Round))
        }
    }

    @Composable
    fun CargoBox(modifier: Modifier = Modifier, size: Dp = 20.dp, color: Color = PolarisColors.TextPrimary) {
        Canvas(modifier = modifier.size(size)) {
            val stroke = 1.6.dp.toPx()
            val w = this.size.width
            val h = this.size.height
            val cx = w / 2f

            // Isometric 3D cargo crate
            val path = Path().apply {
                moveTo(cx, h * 0.12f)
                lineTo(w * 0.88f, h * 0.32f)
                lineTo(w * 0.88f, h * 0.74f)
                lineTo(cx, h * 0.94f)
                lineTo(w * 0.12f, h * 0.74f)
                lineTo(w * 0.12f, h * 0.32f)
                close()
            }
            drawPath(path, color, style = Stroke(width = stroke, cap = StrokeCap.Round, join = StrokeJoin.Round))

            // Internal edges
            drawLine(color, Offset(cx, h * 0.12f), Offset(cx, h * 0.54f), strokeWidth = stroke)
            drawLine(color, Offset(cx, h * 0.54f), Offset(w * 0.88f, h * 0.32f), strokeWidth = stroke)
            drawLine(color, Offset(cx, h * 0.54f), Offset(w * 0.12f, h * 0.32f), strokeWidth = stroke)
            drawLine(color, Offset(cx, h * 0.54f), Offset(cx, h * 0.94f), strokeWidth = stroke)
        }
    }

    @Composable
    fun InventoryGrid(modifier: Modifier = Modifier, size: Dp = 20.dp, color: Color = PolarisColors.TextPrimary) {
        Canvas(modifier = modifier.size(size)) {
            val stroke = 1.6.dp.toPx()
            val w = this.size.width
            val h = this.size.height
            val p = w * 0.12f
            val cellW = (w - p * 2 - 3.dp.toPx()) / 2f
            val cellH = (h - p * 2 - 3.dp.toPx()) / 2f
            val gap = 3.dp.toPx()

            drawRoundRect(color, Offset(p, p), Size(cellW, cellH), CornerRadius(2.dp.toPx()), style = Stroke(stroke))
            drawRoundRect(color, Offset(p + cellW + gap, p), Size(cellW, cellH), CornerRadius(2.dp.toPx()), style = Stroke(stroke))
            drawRoundRect(color, Offset(p, p + cellH + gap), Size(cellW, cellH), CornerRadius(2.dp.toPx()), style = Stroke(stroke))
            drawRoundRect(color, Offset(p + cellW + gap, p + cellH + gap), Size(cellW, cellH), CornerRadius(2.dp.toPx()), style = Stroke(stroke))
        }
    }

    @Composable
    fun AlertTriangle(modifier: Modifier = Modifier, size: Dp = 20.dp, color: Color = PolarisColors.StatusCritical) {
        Canvas(modifier = modifier.size(size)) {
            val stroke = 1.8.dp.toPx()
            val w = this.size.width
            val h = this.size.height
            val cx = w / 2f

            val path = Path().apply {
                moveTo(cx, h * 0.12f)
                lineTo(w * 0.9f, h * 0.86f)
                lineTo(w * 0.1f, h * 0.86f)
                close()
            }
            drawPath(path, color, style = Stroke(width = stroke, cap = StrokeCap.Round, join = StrokeJoin.Round))

            // Exclamation line & dot
            drawLine(color, Offset(cx, h * 0.38f), Offset(cx, h * 0.60f), strokeWidth = stroke, cap = StrokeCap.Round)
            drawCircle(color, radius = stroke * 0.7f, center = Offset(cx, h * 0.73f))
        }
    }

    @Composable
    fun SyncArrows(modifier: Modifier = Modifier, size: Dp = 20.dp, color: Color = PolarisColors.PolarBlue) {
        Canvas(modifier = modifier.size(size)) {
            val stroke = 1.8.dp.toPx()
            val w = this.size.width
            val h = this.size.height
            val cx = w / 2f
            val cy = h / 2f
            val r = w * 0.34f

            // Top arc
            drawArc(
                color = color,
                startAngle = 200f,
                sweepAngle = 140f,
                useCenter = false,
                topLeft = Offset(cx - r, cy - r),
                size = Size(r * 2, r * 2),
                style = Stroke(stroke, cap = StrokeCap.Round)
            )

            // Top arrow head
            val arrowTop = Path().apply {
                moveTo(cx + r + 3.dp.toPx(), cy - 2.dp.toPx())
                lineTo(cx + r - 3.dp.toPx(), cy - 6.dp.toPx())
                lineTo(cx + r - 3.dp.toPx(), cy + 2.dp.toPx())
                close()
            }
            drawPath(arrowTop, color)

            // Bottom arc
            drawArc(
                color = color,
                startAngle = 20f,
                sweepAngle = 140f,
                useCenter = false,
                topLeft = Offset(cx - r, cy - r),
                size = Size(r * 2, r * 2),
                style = Stroke(stroke, cap = StrokeCap.Round)
            )

            // Bottom arrow head
            val arrowBot = Path().apply {
                moveTo(cx - r - 3.dp.toPx(), cy + 2.dp.toPx())
                lineTo(cx - r + 3.dp.toPx(), cy + 6.dp.toPx())
                lineTo(cx - r + 3.dp.toPx(), cy - 2.dp.toPx())
                close()
            }
            drawPath(arrowBot, color)
        }
    }

    @Composable
    fun TransportShip(modifier: Modifier = Modifier, size: Dp = 20.dp, color: Color = PolarisColors.TextPrimary) {
        Canvas(modifier = modifier.size(size)) {
            val stroke = 1.6.dp.toPx()
            val w = this.size.width
            val h = this.size.height

            // Ship / Transport vessel hull
            val path = Path().apply {
                moveTo(w * 0.12f, h * 0.65f)
                lineTo(w * 0.88f, h * 0.65f)
                lineTo(w * 0.78f, h * 0.85f)
                lineTo(w * 0.22f, h * 0.85f)
                close()
            }
            drawPath(path, color, style = Stroke(stroke, cap = StrokeCap.Round, join = StrokeJoin.Round))

            // Cabin / Bridge
            val bridge = Path().apply {
                moveTo(w * 0.32f, h * 0.65f)
                lineTo(w * 0.32f, h * 0.35f)
                lineTo(w * 0.62f, h * 0.35f)
                lineTo(w * 0.68f, h * 0.65f)
            }
            drawPath(bridge, color, style = Stroke(stroke, cap = StrokeCap.Round, join = StrokeJoin.Round))

            // Mast
            drawLine(color, Offset(w * 0.46f, h * 0.35f), Offset(w * 0.46f, h * 0.18f), strokeWidth = stroke)
        }
    }

    @Composable
    fun PersonnelBadge(modifier: Modifier = Modifier, size: Dp = 20.dp, color: Color = PolarisColors.TextPrimary) {
        Canvas(modifier = modifier.size(size)) {
            val stroke = 1.6.dp.toPx()
            val w = this.size.width
            val h = this.size.height
            val cx = w / 2f

            // Head circle
            drawCircle(color, radius = w * 0.18f, center = Offset(cx, h * 0.30f), style = Stroke(stroke))

            // Shoulders arc
            drawArc(
                color = color,
                startAngle = 180f,
                sweepAngle = 180f,
                useCenter = false,
                topLeft = Offset(w * 0.16f, h * 0.46f),
                size = Size(w * 0.68f, h * 0.50f),
                style = Stroke(stroke, cap = StrokeCap.Round)
            )
        }
    }

    @Composable
    fun ScheduleCalendar(modifier: Modifier = Modifier, size: Dp = 20.dp, color: Color = PolarisColors.TextPrimary) {
        Canvas(modifier = modifier.size(size)) {
            val stroke = 1.6.dp.toPx()
            val w = this.size.width
            val h = this.size.height

            // Outer box
            drawRoundRect(
                color = color,
                topLeft = Offset(w * 0.15f, h * 0.22f),
                size = Size(w * 0.70f, h * 0.66f),
                cornerRadius = CornerRadius(3.dp.toPx()),
                style = Stroke(stroke)
            )

            // Header line
            drawLine(color, Offset(w * 0.15f, h * 0.42f), Offset(w * 0.85f, h * 0.42f), strokeWidth = stroke)

            // Top binders
            drawLine(color, Offset(w * 0.32f, h * 0.12f), Offset(w * 0.32f, h * 0.25f), strokeWidth = stroke, cap = StrokeCap.Round)
            drawLine(color, Offset(w * 0.68f, h * 0.12f), Offset(w * 0.68f, h * 0.25f), strokeWidth = stroke, cap = StrokeCap.Round)

            // Schedule ticks
            drawCircle(color, radius = 1.2.dp.toPx(), center = Offset(w * 0.35f, h * 0.58f))
            drawCircle(color, radius = 1.2.dp.toPx(), center = Offset(w * 0.50f, h * 0.58f))
            drawCircle(color, radius = 1.2.dp.toPx(), center = Offset(w * 0.65f, h * 0.58f))
            drawCircle(color, radius = 1.2.dp.toPx(), center = Offset(w * 0.35f, h * 0.74f))
            drawCircle(color, radius = 1.2.dp.toPx(), center = Offset(w * 0.50f, h * 0.74f))
        }
    }

    @Composable
    fun RadioAntenna(modifier: Modifier = Modifier, size: Dp = 20.dp, color: Color = PolarisColors.PolarCyan) {
        Canvas(modifier = modifier.size(size)) {
            val stroke = 1.6.dp.toPx()
            val w = this.size.width
            val h = this.size.height
            val cx = w / 2f

            // Antenna mast
            drawLine(color, Offset(cx, h * 0.40f), Offset(cx, h * 0.88f), strokeWidth = stroke, cap = StrokeCap.Round)
            drawLine(color, Offset(cx - 5.dp.toPx(), h * 0.88f), Offset(cx + 5.dp.toPx(), h * 0.88f), strokeWidth = stroke, cap = StrokeCap.Round)
            drawCircle(color, radius = 2.dp.toPx(), center = Offset(cx, h * 0.40f))

            // Transmission wave arcs
            drawArc(color, 210f, 120f, false, Offset(cx - w * 0.25f, h * 0.15f), Size(w * 0.50f, w * 0.50f), style = Stroke(stroke, cap = StrokeCap.Round))
            drawArc(color, 215f, 110f, false, Offset(cx - w * 0.40f, h * 0.02f), Size(w * 0.80f, w * 0.80f), style = Stroke(stroke, cap = StrokeCap.Round))
        }
    }
}
