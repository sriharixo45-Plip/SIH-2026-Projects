package org.polarisos.field.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.polarisos.field.data.FieldRepository
import org.polarisos.field.ui.components.PolarisCard
import org.polarisos.field.ui.components.PolarisIcons
import org.polarisos.field.ui.components.PolarisListItem
import org.polarisos.field.ui.components.PolarisMetricCard
import org.polarisos.field.ui.components.PolarisPrimaryButton
import org.polarisos.field.ui.components.PolarisSecondaryButton
import org.polarisos.field.ui.components.PolarisSectionHeader
import org.polarisos.field.ui.components.PolarisStatusChip
import org.polarisos.field.ui.components.PolarisStatusTone
import org.polarisos.field.ui.theme.PolarisColors
import org.polarisos.field.ui.theme.PolarisDimens
import org.polarisos.field.util.RecordParser

@Composable
fun DashboardScreen(
    repository: FieldRepository,
    isOnline: Boolean,
    onNavigate: (String) -> Unit
) {
    val records by repository.observeRecords(null).collectAsState(initial = emptyList())
    val pending by repository.database.fieldDao().observePendingCount().collectAsState(initial = 0)
    val conflicts by repository.observeConflicts().collectAsState(initial = emptyList())

    // Real metric counts computed from Room database records
    val cargoCount = remember(records) { records.count { it.entityType == "cargo_item" } }
    val inventoryCount = remember(records) { records.count { it.entityType == "inventory_stock" } }
    val incidentCount = remember(records) { records.count { it.entityType == "incident" } }
    val personnelCount = remember(records) { records.count { it.entityType == "personnel_assignment" } }
    val shipmentCount = remember(records) { records.count { it.entityType == "transport_leg" } }
    val scheduleCount = remember(records) { records.count { it.entityType == "expedition" } }

    val recentRecords = remember(records) { records.take(6) }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(PolarisColors.PolarBg)
            .padding(horizontal = PolarisDimens.space4),
        verticalArrangement = Arrangement.spacedBy(PolarisDimens.space3)
    ) {
        item {
            Spacer(modifier = Modifier.height(PolarisDimens.space2))

            // Station Identity & Operational Summary Card
            PolarisCard(
                backgroundColor = PolarisColors.Navy950,
                borderColor = PolarisColors.Navy700
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = "STATION BASE STATUS",
                            color = PolarisColors.PolarCyan,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 1.sp
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = repository.session.stationCode?.uppercase() ?: "ARCTIC FIELD STATION",
                            color = Color.White,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 0.5.sp
                        )
                        Text(
                            text = "Operator: ${repository.session.userName ?: "Field Specialist"}",
                            color = PolarisColors.TextFaint,
                            fontSize = 12.sp
                        )
                    }

                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(PolarisDimens.radiusPill))
                            .background(if (isOnline) PolarisColors.StatusNominalBg else PolarisColors.Navy800)
                            .border(
                                1.dp,
                                if (isOnline) PolarisColors.StatusNominalBorder else PolarisColors.Navy600,
                                RoundedCornerShape(PolarisDimens.radiusPill)
                            )
                            .padding(horizontal = 10.dp, vertical = 5.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(6.dp)
                                    .clip(CircleShape)
                                    .background(if (isOnline) PolarisColors.StatusNominal else PolarisColors.StatusOffline)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = if (isOnline) "ONLINE" else "LOCAL OFFLINE",
                                color = if (isOnline) PolarisColors.StatusNominal else PolarisColors.TextFaint,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                fontFamily = FontFamily.Monospace
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))
                HorizontalDivider(color = PolarisColors.Navy800)
                Spacer(modifier = Modifier.height(10.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column {
                        Text("LOCAL DATABASE", color = PolarisColors.TextFaint, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
                        Text("${records.size} cached", color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                    }
                    Column {
                        Text("PENDING SYNC", color = PolarisColors.TextFaint, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
                        Text(
                            "$pending operations",
                            color = if (pending > 0) PolarisColors.PolarCyan else Color.White,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    Column {
                        Text("CONFLICTS", color = PolarisColors.TextFaint, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
                        Text(
                            "${conflicts.size} unresolved",
                            color = if (conflicts.isNotEmpty()) PolarisColors.StatusCritical else Color.White,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }

        // Quick Operational Actions Launcher
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                PolarisPrimaryButton(
                    text = "Report Incident",
                    onClick = { onNavigate("Incident") },
                    modifier = Modifier.weight(1f),
                    leadingIcon = { PolarisIcons.AlertTriangle(size = 16.dp, color = Color.White) }
                )
                PolarisSecondaryButton(
                    text = if (pending > 0) "Sync ($pending)" else "Sync Center",
                    onClick = { onNavigate("Sync") },
                    modifier = Modifier.weight(1f),
                    leadingIcon = { PolarisIcons.SyncArrows(size = 16.dp, color = PolarisColors.PolarBlue) }
                )
            }
        }

        // Operational Metrics Grid
        item {
            PolarisSectionHeader(title = "Station Operational Metrics")

            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    PolarisMetricCard(
                        label = "Cargo Items",
                        value = cargoCount.toString(),
                        subtext = "Manifest entries",
                        modifier = Modifier.weight(1f),
                        icon = { PolarisIcons.CargoBox(size = 18.dp, color = PolarisColors.PolarBlue) },
                        onClick = { onNavigate("Cargo") }
                    )
                    PolarisMetricCard(
                        label = "Station Stock",
                        value = inventoryCount.toString(),
                        subtext = "Catalog lines",
                        modifier = Modifier.weight(1f),
                        icon = { PolarisIcons.InventoryGrid(size = 18.dp, color = PolarisColors.PolarBlue) },
                        onClick = { onNavigate("Inventory") }
                    )
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    PolarisMetricCard(
                        label = "Incidents",
                        value = incidentCount.toString(),
                        subtext = if (incidentCount > 0) "Field alerts" else "Nominal status",
                        valueColor = if (incidentCount > 0) PolarisColors.StatusCritical else PolarisColors.TextPrimary,
                        modifier = Modifier.weight(1f),
                        icon = { PolarisIcons.AlertTriangle(size = 18.dp, color = PolarisColors.StatusCritical) },
                        onClick = { onNavigate("Incident") }
                    )
                    PolarisMetricCard(
                        label = "Personnel",
                        value = personnelCount.toString(),
                        subtext = "Assigned members",
                        modifier = Modifier.weight(1f),
                        icon = { PolarisIcons.PersonnelBadge(size = 18.dp, color = PolarisColors.PolarBlue) },
                        onClick = { onNavigate("Personnel") }
                    )
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    PolarisMetricCard(
                        label = "Transport Legs",
                        value = shipmentCount.toString(),
                        subtext = "Movement routes",
                        modifier = Modifier.weight(1f),
                        icon = { PolarisIcons.TransportShip(size = 18.dp, color = PolarisColors.PolarBlue) },
                        onClick = { onNavigate("Shipments") }
                    )
                    PolarisMetricCard(
                        label = "Expeditions",
                        value = scheduleCount.toString(),
                        subtext = "Active schedules",
                        modifier = Modifier.weight(1f),
                        icon = { PolarisIcons.ScheduleCalendar(size = 18.dp, color = PolarisColors.PolarBlue) },
                        onClick = { onNavigate("Schedules") }
                    )
                }
            }
        }

        // Module Quick Access Section
        item {
            PolarisSectionHeader(title = "Field Modules Hub")
            PolarisCard {
                val modules = listOf(
                    Triple("Cargo Logistics", "Track manifests, packages & return cargo", "Cargo"),
                    Triple("Inventory & Stock", "Record consumables, supplies & field usage", "Inventory"),
                    Triple("Field Incidents", "Report emergencies, safety & equipment faults", "Incident"),
                    Triple("Personnel Roster", "View team assignments & rotation status", "Personnel"),
                    Triple("Transport Legs", "Vessel & aircraft leg schedules & statuses", "Shipments"),
                    Triple("Expedition Schedules", "Timeline, operations & season objectives", "Schedules"),
                    Triple("All Cached Records", "Raw database inspection & record updates", "Records"),
                    Triple("Device & Station Settings", "Configure backend URL, diagnostics & sign out", "Settings")
                )
                modules.forEachIndexed { index, (title, desc, route) ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onNavigate(route) }
                            .padding(vertical = 10.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = title,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = PolarisColors.TextPrimary
                            )
                            Text(
                                text = desc,
                                fontSize = 11.sp,
                                color = PolarisColors.TextMuted
                            )
                        }
                        Text("→", color = PolarisColors.PolarBlue, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                    }
                    if (index < modules.size - 1) {
                        HorizontalDivider(color = PolarisColors.LineSubtle)
                    }
                }
            }
        }

        // Recent Field Records Section
        item {
            PolarisSectionHeader(
                title = "Recent Field Activity",
                count = recentRecords.size,
                actionLabel = "View All",
                onAction = { onNavigate("Records") }
            )
        }

        if (recentRecords.isEmpty()) {
            item {
                PolarisCard {
                    Text(
                        text = "No records currently cached in local database. Synchronize with the base station or server to populate station data.",
                        fontSize = 12.sp,
                        color = PolarisColors.TextMuted,
                        lineHeight = 17.sp,
                        modifier = Modifier.padding(vertical = 6.dp)
                    )
                }
            }
        } else {
            items(recentRecords, key = { "${it.entityType}:${it.entityId}" }) { record ->
                val (code, title, status) = when (record.entityType) {
                    "cargo_item" -> {
                        val c = RecordParser.parseCargo(record)
                        Triple(c.trackingCode, c.description, c.status)
                    }
                    "inventory_stock" -> {
                        val inv = RecordParser.parseInventory(record)
                        Triple(inv.code, "${inv.name} (Qty: ${inv.quantity} ${inv.unit})", if (inv.isLowStock) "LOW STOCK" else "IN STOCK")
                    }
                    "incident" -> {
                        val inc = RecordParser.parseIncident(record)
                        Triple(inc.type.uppercase(), inc.description, inc.severity)
                    }
                    "personnel_assignment" -> {
                        val p = RecordParser.parsePersonnel(record)
                        Triple(p.employeeCode, "${p.name} · ${p.role}", p.status)
                    }
                    "transport_leg" -> {
                        val leg = RecordParser.parseTransportLeg(record)
                        Triple(leg.code, "${leg.origin} → ${leg.destination}", leg.status)
                    }
                    "expedition" -> {
                        val exp = RecordParser.parseExpedition(record)
                        Triple(exp.code, exp.name, exp.status)
                    }
                    else -> Triple(record.entityId.take(8).uppercase(), record.entityType.replace('_', ' '), "RECORD")
                }

                PolarisListItem(
                    code = code,
                    title = title,
                    statusText = status,
                    subtitle = "Entity: ${record.entityType.replace('_', ' ').uppercase()}",
                    onClick = { onNavigate("Records") }
                )
            }
        }

        item {
            Spacer(modifier = Modifier.height(PolarisDimens.space6))
        }
    }
}
