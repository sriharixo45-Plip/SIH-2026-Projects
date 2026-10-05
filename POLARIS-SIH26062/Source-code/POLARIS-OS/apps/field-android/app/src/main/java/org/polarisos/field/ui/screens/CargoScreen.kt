package org.polarisos.field.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
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
import org.polarisos.field.ui.components.PolarisPrimaryButton
import org.polarisos.field.ui.components.PolarisSectionHeader
import org.polarisos.field.ui.components.PolarisStatusChip
import org.polarisos.field.ui.components.PolarisTextField
import org.polarisos.field.ui.theme.PolarisCodeTypography
import org.polarisos.field.ui.theme.PolarisColors
import org.polarisos.field.ui.theme.PolarisDimens
import org.polarisos.field.util.RecordParser

@Composable
fun CargoScreen(
    repository: FieldRepository,
    onMessage: (String) -> Unit
) {
    val records by repository.observeRecords("cargo_item").collectAsState(initial = emptyList())
    val scope = rememberCoroutineScope()

    var searchQuery by remember { mutableStateOf("") }
    var selectedStatusFilter by remember { mutableStateOf<String?>(null) }
    var selectedRecord by remember { mutableStateOf<CachedRecord?>(null) }
    var confirmAdvanceRecord by remember { mutableStateOf<CachedRecord?>(null) }

    val statusFilters = listOf(
        "All",
        "packed",
        "in-transit",
        "in-storage-at-station",
        "delivered",
        "damaged",
        "returned"
    )

    val filteredRecords = remember(records, searchQuery, selectedStatusFilter) {
        records.filter { record ->
            val parsed = RecordParser.parseCargo(record)
            val matchesQuery = searchQuery.isBlank() ||
                    parsed.trackingCode.contains(searchQuery, ignoreCase = true) ||
                    parsed.description.contains(searchQuery, ignoreCase = true) ||
                    parsed.category.contains(searchQuery, ignoreCase = true)

            val matchesFilter = selectedStatusFilter == null ||
                    parsed.status.equals(selectedStatusFilter, ignoreCase = true)

            matchesQuery && matchesFilter
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(PolarisColors.PolarBg)
            .padding(horizontal = PolarisDimens.space4)
    ) {
        Spacer(modifier = Modifier.height(PolarisDimens.space2))

        // Search Bar
        PolarisTextField(
            value = searchQuery,
            onValueChange = { searchQuery = it },
            label = "Search Cargo Manifest",
            placeholder = "Filter by tracking code, item name, or category…",
            leadingIcon = {
                Text("🔍", fontSize = 14.sp)
            },
            trailingIcon = if (searchQuery.isNotBlank()) {
                {
                    Text(
                        text = "CLEAR",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = PolarisColors.PolarBlue,
                        modifier = Modifier
                            .clickable { searchQuery = "" }
                            .padding(end = 8.dp)
                    )
                }
            } else null
        )

        Spacer(modifier = Modifier.height(PolarisDimens.space2))

        // Status Filter Chips Row
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            statusFilters.forEach { status ->
                val isSelected = (status == "All" && selectedStatusFilter == null) ||
                        (selectedStatusFilter.equals(status, ignoreCase = true))

                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(PolarisDimens.radiusPill))
                        .background(if (isSelected) PolarisColors.PolarBlue else PolarisColors.PolarSurface)
                        .clickable {
                            selectedStatusFilter = if (status == "All") null else status
                        }
                        .heightIn(min = PolarisDimens.minTouchTarget)
                        .padding(horizontal = 12.dp, vertical = 6.dp)
                ) {
                    Text(
                        text = status.replace('-', ' ').uppercase(),
                        color = if (isSelected) Color.White else PolarisColors.TextSecondary,
                        fontSize = 11.sp,
                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(PolarisDimens.space3))

        PolarisSectionHeader(
            title = "Station Cargo Manifest",
            count = filteredRecords.size
        )

        if (filteredRecords.isEmpty()) {
            PolarisEmptyState(
                title = if (records.isEmpty()) "No Cached Cargo Records" else "No Matching Cargo Items",
                description = if (records.isEmpty())
                    "Connect this terminal to the station network and run synchronization to retrieve active manifests."
                else "No items match '${searchQuery.ifBlank { selectedStatusFilter }}'. Adjust filters or search terms.",
                icon = { PolarisIcons.CargoBox(size = 40.dp, color = PolarisColors.TextFaint) }
            )
        } else {
            LazyColumn(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(filteredRecords, key = { it.entityId }) { record ->
                    val cargo = RecordParser.parseCargo(record)
                    val metadata = mutableListOf<String>()
                    if (cargo.category.isNotBlank()) metadata.add("Cat: ${cargo.category}")
                    if (cargo.weight != "—") metadata.add("Wt: ${cargo.weight} kg")
                    if (cargo.volume != "—") metadata.add("Vol: ${cargo.volume} m³")
                    if (cargo.isReturnCargo) metadata.add("RETURN CARGO")
                    if (cargo.syncStatus != null) metadata.add("Sync: ${cargo.syncStatus.uppercase()}")

                    PolarisListItem(
                        code = cargo.trackingCode,
                        title = cargo.description,
                        statusText = cargo.status,
                        metadataList = metadata,
                        actionLabel = "Advance Status",
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
        val cargo = RecordParser.parseCargo(record)
        AlertDialog(
            onDismissRequest = { selectedRecord = null },
            title = {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = cargo.trackingCode,
                        style = PolarisCodeTypography.codeLarge,
                        fontWeight = FontWeight.Bold,
                        color = PolarisColors.TextPrimary
                    )
                    PolarisStatusChip(text = cargo.status)
                }
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        text = cargo.description,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PolarisColors.TextPrimary
                    )
                    HorizontalDivider(color = PolarisColors.LineSubtle)

                    DetailRow("Category", cargo.category)
                    DetailRow("Weight", "${cargo.weight} kg")
                    DetailRow("Volume", "${cargo.volume} m³")
                    if (cargo.hazardClass != null) {
                        DetailRow("Hazard Class", cargo.hazardClass)
                    }
                    DetailRow("Return Cargo", if (cargo.isReturnCargo) "Yes (Outbound)" else "No")
                    if (cargo.legId != null) {
                        DetailRow("Leg ID", cargo.legId.take(8).uppercase())
                    }
                    DetailRow("Local Version", record.version.toString())
                    if (record.changedAt != null) {
                        DetailRow("Updated At", record.changedAt)
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    val toAdvance = record
                    selectedRecord = null
                    confirmAdvanceRecord = toAdvance
                }) {
                    Text("Advance Status", fontWeight = FontWeight.Bold, color = PolarisColors.PolarBlue)
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

    // Advance Status Confirmation
    confirmAdvanceRecord?.let { record ->
        val cargo = RecordParser.parseCargo(record)
        PolarisConfirmationDialog(
            title = "Advance Cargo Status",
            message = "Progress status for ${cargo.trackingCode} (${cargo.status}) to the next operational phase? Changes will be recorded locally and synchronized when online.",
            confirmLabel = "Confirm Offline Update",
            onConfirm = {
                confirmAdvanceRecord = null
                scope.launch {
                    runCatching { repository.advance(record) }
                        .onSuccess { onMessage("Cargo status update saved locally for ${cargo.trackingCode}.") }
                        .onFailure { onMessage(it.message ?: "Could not advance cargo status.") }
                }
            },
            onDismiss = { confirmAdvanceRecord = null }
        )
    }
}

@Composable
fun DetailRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(text = label, fontSize = 12.sp, color = PolarisColors.TextMuted)
        Text(
            text = value,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = PolarisColors.TextPrimary,
            fontFamily = FontFamily.SansSerif
        )
    }
}
