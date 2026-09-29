package com.polaris.field.ui.home

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.polaris.field.ui.common.OfflineStateBanner
import com.polaris.field.ui.common.OperationalCard
import com.polaris.field.ui.common.StatusChip
import com.polaris.field.ui.common.SyntheticDataBanner
import com.polaris.field.ui.common.formatFieldDateTime
import com.polaris.field.ui.theme.*
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.concurrent.TimeUnit

fun calculateDaysRemaining(endDateString: String?): Long? {
    if (endDateString.isNullOrBlank()) return null
    return try {
        val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.US)
        val endDate = sdf.parse(endDateString)
        val diffMs = (endDate?.time ?: System.currentTimeMillis()) - System.currentTimeMillis()
        val days = TimeUnit.MILLISECONDS.toDays(diffMs)
        if (days > 0) days else 0L
    } catch (_: Exception) {
        null
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    stationName: String? = null,
    userName: String? = null,
    userRole: String? = null,
    assignmentEndDate: String? = null,
    nextShipmentCode: String? = null,
    nextShipmentEta: String? = null,
    cargoCount: Int = 0,
    unreadUpdatesCount: Int = 0,
    actionRequiredCount: Int = 0,
    currentShiftTime: String? = null,
    lowStockCount: Int = 0,
    activeIncidentsCount: Int = 0,
    weatherTempC: Double? = null,
    weatherWindKts: Double? = null,
    weatherSource: String? = null,
    syncStatus: String = "Online",
    isOffline: Boolean = false,
    lastSyncFormatted: String? = null,
    onShipmentClick: () -> Unit = {},
    onUpdatesClick: () -> Unit = {},
    onScheduleClick: () -> Unit = {},
    onInventoryClick: () -> Unit = {},
    onIncidentsClick: () -> Unit = {},
    onSyncClick: () -> Unit = {}
) {
    val computedDaysRemaining = calculateDaysRemaining(assignmentEndDate)

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = (stationName ?: "BHARATI STATION").uppercase(),
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = TextPrimaryCharcoal
                        )
                        Text(
                            text = "EXP-01 • ${userName ?: "A. Kumar"} (${userRole ?: "Logistics Officer"})",
                            style = MaterialTheme.typography.bodySmall,
                            color = TextSecondaryMuted
                        )
                    }
                },
                actions = {
                    StatusChip(status = if (isOffline) "OFFLINE" else "ONLINE", modifier = Modifier.padding(end = 12.dp))
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = EnterpriseSurface)
            )
        },
        containerColor = EnterpriseBackground
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            if (isOffline) {
                item {
                    OfflineStateBanner(lastSyncFormatted = lastSyncFormatted ?: "Just now")
                }
            }

            item {
                SyntheticDataBanner()
            }

            // Attention Required Section
            if (lowStockCount > 0 || activeIncidentsCount > 0 || actionRequiredCount > 0) {
                item {
                    OperationalCard(borderColor = SemanticAmber) {
                        Text(
                            text = "ATTENTION REQUIRED",
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold,
                            color = SemanticAmber
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        if (lowStockCount > 0) {
                            Text(
                                text = "• $lowStockCount Inventory item(s) below safety stock threshold",
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.SemiBold,
                                color = TextPrimaryCharcoal,
                                modifier = Modifier.clickable { onInventoryClick() }
                            )
                        }
                        if (activeIncidentsCount > 0) {
                            Text(
                                text = "• $activeIncidentsCount Active incident(s) reported for station",
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.SemiBold,
                                color = SemanticRed,
                                modifier = Modifier.clickable { onIncidentsClick() }
                            )
                        }
                    }
                }
            }

            // Quick Operational Actions
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedButton(
                        onClick = onInventoryClick,
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = PolarBlueAccent),
                        shape = MaterialTheme.shapes.small
                    ) {
                        Icon(Icons.AutoMirrored.Filled.List, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Inventory", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }

                    OutlinedButton(
                        onClick = onIncidentsClick,
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = SemanticRed),
                        shape = MaterialTheme.shapes.small
                    ) {
                        Icon(Icons.Default.Warning, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Incident", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }

                    OutlinedButton(
                        onClick = onSyncClick,
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = TextPrimaryCharcoal),
                        shape = MaterialTheme.shapes.small
                    ) {
                        Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Sync", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }

            // Next Shipment Arrival
            item {
                OperationalCard(modifier = Modifier.clickable { onShipmentClick() }) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("NEXT TRANSPORT LEG", style = MaterialTheme.typography.labelSmall, color = TextSecondaryMuted)
                        StatusChip(status = if (nextShipmentCode != null) "CONFIRMED" else "NO SHIPMENT")
                    }
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = nextShipmentCode ?: "No Active Shipment Scheduled",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimaryCharcoal
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("ETA  ${formatFieldDateTime(nextShipmentEta)}", style = MaterialTheme.typography.bodySmall, color = TextSecondaryMuted)
                        Text("$cargoCount ${if (cargoCount == 1) "Manifest Item" else "Manifest Items"}", style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Bold, color = PolarBlueAccent, maxLines = 1)
                    }
                }
            }

            // Station Roster Rotation
            item {
                OperationalCard(modifier = Modifier.clickable { onScheduleClick() }) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text("STATION ROSTER ROTATION", style = MaterialTheme.typography.labelSmall, color = TextSecondaryMuted)
                            Text(
                                text = if (computedDaysRemaining != null) "$computedDaysRemaining Days Remaining" else "Active Rotation",
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.Bold,
                                color = TextPrimaryCharcoal
                            )
                        }
                        StatusChip(status = "ACTIVE")
                    }
                }
            }
        }
    }
}
