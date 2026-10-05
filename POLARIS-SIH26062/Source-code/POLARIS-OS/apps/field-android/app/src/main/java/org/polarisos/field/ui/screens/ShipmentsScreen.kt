package org.polarisos.field.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import org.polarisos.field.data.CachedRecord
import org.polarisos.field.data.FieldRepository
import org.polarisos.field.ui.components.PolarisConfirmationDialog
import org.polarisos.field.ui.components.PolarisEmptyState
import org.polarisos.field.ui.components.PolarisIcons
import org.polarisos.field.ui.components.PolarisListItem
import org.polarisos.field.ui.components.PolarisSectionHeader
import org.polarisos.field.ui.components.PolarisStatusChip
import org.polarisos.field.ui.components.PolarisTextField
import org.polarisos.field.ui.theme.PolarisCodeTypography
import org.polarisos.field.ui.theme.PolarisColors
import org.polarisos.field.ui.theme.PolarisDimens
import org.polarisos.field.util.RecordParser

@Composable
fun ShipmentsScreen(
    repository: FieldRepository,
    onMessage: (String) -> Unit
) {
    val records by repository.observeRecords("transport_leg").collectAsState(initial = emptyList())
    val scope = rememberCoroutineScope()

    var searchQuery by remember { mutableStateOf("") }
    var selectedRecord by remember { mutableStateOf<CachedRecord?>(null) }
    var confirmAdvanceRecord by remember { mutableStateOf<CachedRecord?>(null) }

    val filteredRecords = remember(records, searchQuery) {
        records.filter { record ->
            val leg = RecordParser.parseTransportLeg(record)
            searchQuery.isBlank() ||
                    leg.code.contains(searchQuery, ignoreCase = true) ||
                    leg.origin.contains(searchQuery, ignoreCase = true) ||
                    leg.destination.contains(searchQuery, ignoreCase = true)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(PolarisColors.PolarBg)
            .padding(horizontal = PolarisDimens.space4)
    ) {
        Spacer(modifier = Modifier.height(PolarisDimens.space2))

        PolarisTextField(
            value = searchQuery,
            onValueChange = { searchQuery = it },
            label = "Search Transport Legs",
            placeholder = "Filter by route code, departure hub, or destination base…",
            leadingIcon = { Text("🔍", fontSize = 14.sp) }
        )

        Spacer(modifier = Modifier.height(PolarisDimens.space3))

        PolarisSectionHeader(
            title = "Vessel & Aircraft Transport Legs",
            count = filteredRecords.size
        )

        if (filteredRecords.isEmpty()) {
            PolarisEmptyState(
                title = if (records.isEmpty()) "No Cached Transport Legs" else "No Matching Routes",
                description = if (records.isEmpty())
                    "Connect to synchronization server to download scheduled vessel and aircraft movement legs."
                else "No transport legs match '${searchQuery}'.",
                icon = { PolarisIcons.TransportShip(size = 40.dp, color = PolarisColors.TextFaint) }
            )
        } else {
            LazyColumn(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(filteredRecords, key = { it.entityId }) { record ->
                    val leg = RecordParser.parseTransportLeg(record)
                    val metadata = mutableListOf<String>()
                    if (leg.plannedDeparture != null) metadata.add("Dep: ${leg.plannedDeparture}")
                    if (leg.plannedArrival != null) metadata.add("Arr: ${leg.plannedArrival}")
                    if (leg.syncStatus != null) metadata.add("Sync: ${leg.syncStatus.uppercase()}")

                    val nextStatus = if (leg.status == "delayed") "in-transit" else "delayed"

                    PolarisListItem(
                        code = leg.code,
                        title = "${leg.origin} → ${leg.destination}",
                        statusText = leg.status,
                        subtitle = "Leg ID: ${leg.legId.take(8).uppercase()}",
                        metadataList = metadata,
                        actionLabel = "Toggle Status ($nextStatus)",
                        onActionClick = { confirmAdvanceRecord = record },
                        onClick = { selectedRecord = record }
                    )
                }
                item {
                    Spacer(modifier = Modifier.height(16.dp))
                }
            }
        }
    }

    // Detail Dialog
    selectedRecord?.let { record ->
        val leg = RecordParser.parseTransportLeg(record)
        AlertDialog(
            onDismissRequest = { selectedRecord = null },
            title = {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = leg.code,
                        style = PolarisCodeTypography.codeLarge,
                        fontWeight = FontWeight.Bold,
                        color = PolarisColors.TextPrimary
                    )
                    PolarisStatusChip(text = leg.status)
                }
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        text = "${leg.origin} → ${leg.destination}",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PolarisColors.TextPrimary
                    )
                    HorizontalDivider(color = PolarisColors.LineSubtle)

                    DetailRow("Route Origin", leg.origin)
                    DetailRow("Destination Base", leg.destination)
                    DetailRow("Operational Status", leg.status.uppercase())
                    if (leg.plannedDeparture != null) DetailRow("Departure", leg.plannedDeparture)
                    if (leg.plannedArrival != null) DetailRow("Arrival", leg.plannedArrival)
                    DetailRow("Leg ID", leg.legId.take(8).uppercase())
                    DetailRow("Local Version", record.version.toString())
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    val toAdvance = record
                    selectedRecord = null
                    confirmAdvanceRecord = toAdvance
                }) {
                    Text("Toggle Status", fontWeight = FontWeight.Bold, color = PolarisColors.PolarBlue)
                }
            },
            dismissButton = {
                TextButton(onClick = { selectedRecord = null }) {
                    Text("Close", color = PolarisColors.TextMuted)
                }
            },
            shape = RoundedCornerShape(PolarisDimens.radiusLg),
            containerColor = PolarisColors.PolarSurface
        )
    }

    // Advance Confirmation
    confirmAdvanceRecord?.let { record ->
        val leg = RecordParser.parseTransportLeg(record)
        val nextStatus = if (leg.status == "delayed") "in-transit" else "delayed"
        PolarisConfirmationDialog(
            title = "Toggle Transport Leg Status",
            message = "Change transport leg ${leg.code} status from '${leg.status}' to '$nextStatus'? This will queue locally for synchronization.",
            confirmLabel = "Queue Status Update",
            onConfirm = {
                confirmAdvanceRecord = null
                scope.launch {
                    runCatching { repository.advance(record) }
                        .onSuccess { onMessage("Transport leg ${leg.code} updated to $nextStatus offline.") }
                        .onFailure { onMessage(it.message ?: "Could not update transport leg.") }
                }
            },
            onDismiss = { confirmAdvanceRecord = null }
        )
    }
}
