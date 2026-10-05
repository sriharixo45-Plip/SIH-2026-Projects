package org.polarisos.field.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.polarisos.field.ui.theme.PolarisColors
import org.polarisos.field.ui.theme.PolarisDimens

data class PolarisNavItem(
    val route: String,
    val label: String,
    val icon: @Composable (selected: Boolean) -> Unit,
    val badgeCount: Int = 0,
    val isAlertBadge: Boolean = false
)

@Composable
fun PolarisBottomBar(
    currentRoute: String,
    onNavigate: (String) -> Unit,
    pendingSyncCount: Int = 0,
    activeIncidentsCount: Int = 0,
    modifier: Modifier = Modifier
) {
    val items = listOf(
        PolarisNavItem(
            route = "Dashboard",
            label = "Home",
            icon = { sel ->
                PolarisIcons.PolarisStar(
                    size = 20.dp,
                    color = if (sel) PolarisColors.PolarBlue else PolarisColors.TextFaint
                )
            }
        ),
        PolarisNavItem(
            route = "Cargo",
            label = "Cargo",
            icon = { sel ->
                PolarisIcons.CargoBox(
                    size = 20.dp,
                    color = if (sel) PolarisColors.PolarBlue else PolarisColors.TextFaint
                )
            }
        ),
        PolarisNavItem(
            route = "Inventory",
            label = "Inventory",
            icon = { sel ->
                PolarisIcons.InventoryGrid(
                    size = 20.dp,
                    color = if (sel) PolarisColors.PolarBlue else PolarisColors.TextFaint
                )
            }
        ),
        PolarisNavItem(
            route = "Incident",
            label = "Incidents",
            badgeCount = activeIncidentsCount,
            isAlertBadge = true,
            icon = { sel ->
                PolarisIcons.AlertTriangle(
                    size = 20.dp,
                    color = if (sel) PolarisColors.StatusCritical else PolarisColors.TextFaint
                )
            }
        ),
        PolarisNavItem(
            route = "Sync",
            label = "Sync",
            badgeCount = pendingSyncCount,
            icon = { sel ->
                PolarisIcons.SyncArrows(
                    size = 20.dp,
                    color = if (sel) PolarisColors.PolarBlue else PolarisColors.TextFaint
                )
            }
        )
    )

    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(PolarisColors.PolarSurface)
            .navigationBarsPadding()
    ) {
        HorizontalDivider(color = PolarisColors.LineSubtle, thickness = 1.dp)
        Row(
            modifier = Modifier
                .fillMaxWidth()
            .heightIn(min = 56.dp),
            horizontalArrangement = Arrangement.SpaceAround,
            verticalAlignment = Alignment.CenterVertically
        ) {
            items.forEach { item ->
                val isSelected = currentRoute == item.route
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .heightIn(min = PolarisDimens.minTouchTarget)
                        .clickable(role = Role.Tab, onClickLabel = "Open ${item.label}") { onNavigate(item.route) }
                        .semantics {
                            contentDescription = item.label
                            selected = isSelected
                        }
                        .padding(vertical = 4.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        modifier = Modifier
                            .clip(RoundedCornerShape(PolarisDimens.radiusSm))
                            .background(if (isSelected) PolarisColors.PolarIceSoft else Color.Transparent)
                            .padding(horizontal = 8.dp, vertical = 4.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        Box(contentAlignment = Alignment.TopEnd) {
                            item.icon(isSelected)
                            if (item.badgeCount > 0) {
                                Box(
                                    modifier = Modifier
                                        .padding(start = 12.dp, bottom = 12.dp)
                                        .size(if (item.badgeCount > 9) 14.dp else 10.dp)
                                        .clip(CircleShape)
                                        .background(if (item.isAlertBadge) PolarisColors.StatusCritical else PolarisColors.StatusWarning),
                                    contentAlignment = Alignment.Center
                                ) {
                                    if (item.badgeCount > 9) {
                                        Text("9+", color = Color.White, fontSize = 8.sp, fontWeight = FontWeight.Bold)
                                    }
                                }
                            }
                        }
                        Spacer(modifier = Modifier.height(3.dp))
                        Text(
                            text = item.label,
                            fontSize = 10.sp,
                            letterSpacing = 0.35.sp,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                            color = if (isSelected) PolarisColors.PolarBlueDark else PolarisColors.TextMuted
                        )
                    }
                }
            }
        }
    }
}
