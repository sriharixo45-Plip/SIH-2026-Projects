package org.polarisos.field.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.polarisos.field.ui.theme.PolarisColors
import org.polarisos.field.ui.theme.PolarisDimens

@Composable
fun PolarisTopBar(
    stationCode: String?,
    userName: String?,
    isOnline: Boolean,
    pendingCount: Int,
    modifier: Modifier = Modifier,
    title: String? = null,
    showBackButton: Boolean = false,
    onBackClick: (() -> Unit)? = null,
    onSyncClick: (() -> Unit)? = null,
    onSettingsClick: (() -> Unit)? = null
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(PolarisColors.Navy950)
            .statusBarsPadding()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = PolarisDimens.space4, vertical = PolarisDimens.space3),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (showBackButton && onBackClick != null) {
                    Box(
                        modifier = Modifier
                            .size(PolarisDimens.minTouchTarget)
                            .clip(RoundedCornerShape(PolarisDimens.radiusSm))
                            .background(PolarisColors.Navy800)
                            .clickable(role = Role.Button, onClickLabel = "Back to home", onClick = onBackClick)
                            .semantics { contentDescription = "Back" },
                        contentAlignment = Alignment.Center
                    ) {
                        Text("BACK", color = Color.White, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                    }
                    Spacer(modifier = Modifier.width(PolarisDimens.space3))
                }

                PolarisIcons.PolarisStar(size = 24.dp, color = PolarisColors.PolarBlueLight)
                Spacer(modifier = Modifier.width(PolarisDimens.space2))

                Column {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = if (showBackButton) title ?: "FIELD OPERATIONS" else "POLARIS",
                            color = Color.White,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 0.5.sp
                        )
                        if (!stationCode.isNullOrBlank()) {
                            Spacer(modifier = Modifier.width(8.dp))
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(PolarisDimens.radiusXs))
                                    .background(PolarisColors.Navy800)
                                    .border(1.dp, PolarisColors.Navy600, RoundedCornerShape(PolarisDimens.radiusXs))
                                    .padding(horizontal = 6.dp, vertical = 2.dp)
                            ) {
                                Text(
                                    text = stationCode.uppercase(),
                                    color = PolarisColors.PolarIce,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    fontFamily = FontFamily.Monospace
                                )
                            }
                        }
                    }
                    if (showBackButton) {
                        Text(
                            text = "FIELD OPERATIONS",
                            color = PolarisColors.TextFaint,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.SemiBold,
                            letterSpacing = 0.8.sp
                        )
                    } else {
                        Text(
                            text = if (!stationCode.isNullOrBlank()) "${stationCode.uppercase()} BASE  ·  ONLINE" else "FIELD OPERATIONS  ·  ONLINE",
                            color = PolarisColors.TextFaint,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Medium,
                            maxLines = 1
                        )
                    }
                }
            }

            Row(verticalAlignment = Alignment.CenterVertically) {
                PolarisSyncStatus(
                    isOnline = isOnline,
                    pendingCount = pendingCount,
                    onClick = onSyncClick
                )
                if (onSettingsClick != null) {
                    Spacer(modifier = Modifier.width(PolarisDimens.space2))
                    Box(
                        modifier = Modifier
                            .size(PolarisDimens.minTouchTarget)
                            .clip(RoundedCornerShape(PolarisDimens.radiusSm))
                            .background(PolarisColors.Navy800)
                            .clickable(role = Role.Button, onClickLabel = "Open settings", onClick = onSettingsClick)
                            .semantics { contentDescription = "Settings" },
                        contentAlignment = Alignment.Center
                    ) {
                        Text("SET", color = PolarisColors.PolarIce, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
        HorizontalDivider(color = PolarisColors.Navy700, thickness = 1.dp)
    }
}
