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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
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
import org.json.JSONObject
import org.polarisos.field.data.CachedRecord
import org.polarisos.field.data.FieldRepository
import org.polarisos.field.ui.components.PolarisEmptyState
import org.polarisos.field.ui.components.PolarisListItem
import org.polarisos.field.ui.components.PolarisSectionHeader
import org.polarisos.field.ui.components.PolarisStatusChip
import org.polarisos.field.ui.components.PolarisTextField
import org.polarisos.field.ui.theme.PolarisCodeTypography
import org.polarisos.field.ui.theme.PolarisColors
import org.polarisos.field.ui.theme.PolarisDimens

private val recordTypes = listOf(
    "All records",
    "cargo_item",
    "inventory_stock",
    "incident",
    "transport_leg",
    "personnel_assignment",
    "expedition",
    "approval"
)

@Composable
fun RecordsScreen(
    repository: FieldRepository,
    onMessage: (String) -> Unit
) {
    val scope = rememberCoroutineScope()
    var selectedType by remember { mutableStateOf<String?>(null) }
    var searchQuery by remember { mutableStateOf("") }
    var selectedRecord by remember { mutableStateOf<CachedRecord?>(null) }
    var confirmAdvanceRecord by remember { mutableStateOf<CachedRecord?>(null) }

    val records by repository.observeRecords(selectedType).collectAsState(initial = emptyList())

    val filteredRecords = remember(records, searchQuery) {
        records.filter { record ->
            searchQuery.isBlank() ||
                    record.entityId.contains(searchQuery, ignoreCase = true) ||
                    record.entityType.contains(searchQuery, ignoreCase = true) ||
                    record.json.contains(searchQuery, ignoreCase = true)
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
            label = "Search Operational Database",
            placeholder = "Filter by entity ID, type, or payload fields…",
            leadingIcon = { Text("🔍", fontSize = 14.sp) }
        )

        Spacer(modifier = Modifier.height(PolarisDimens.space2))

        // Entity Type Chips Row
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            recordTypes.forEach { type ->
                val isSelected = (type == "All records" && selectedType == null) || (selectedType == type)
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(PolarisDimens.radiusPill))
                        .background(if (isSelected) PolarisColors.PolarBlue else PolarisColors.PolarSurface)
                        .clickable {
                            selectedType = if (type == "All records") null else type
                        }
                        .padding(horizontal = 12.dp, vertical = 6.dp)
                ) {
                    Text(
                        text = type.replace('_', ' ').uppercase(),
                        color = if (isSelected) Color.White else PolarisColors.TextSecondary,
                        fontSize = 11.sp,
                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(PolarisDimens.space3))

        PolarisSectionHeader(
            title = "${selectedType?.replace('_', ' ')?.uppercase() ?: "ALL"} DATABASE RECORDS",
            count = filteredRecords.size
        )

        if (filteredRecords.isEmpty()) {
            PolarisEmptyState(
                title = "No Operational Records Found",
                description = "Synchronize terminal to fetch cached operational records from POLARIS HQ."
            )
        } else {
            LazyColumn(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(filteredRecords, key = { "${it.entityType}:${it.entityId}" }) { record ->
                    val data = remember(record.json) { runCatching { JSONObject(record.json) }.getOrElse { JSONObject() } }
                    val code = data.optString("code", data.optString("tracking_code", record.entityId.take(8).uppercase()))
                    val title = data.optString("description", data.optString("name", record.entityType.replace('_', ' ').replaceFirstChar { it.uppercase() }))
                    val status = data.optString("status", "CACHED")

                    val metadata = mutableListOf("Type: ${record.entityType.replace('_', ' ').uppercase()}")
                    if (record.entityType == "inventory_stock") {
                        metadata.add("Qty: ${data.optString("quantity", "—")}")
                    }
                    metadata.add("Ver: ${record.version}")
                    val localSync = data.optString("local_sync_status")
                    if (localSync.isNotBlank()) metadata.add("Sync: ${localSync.uppercase()}")

                    PolarisListItem(
                        code = code,
                        title = title,
                        statusText = status,
                        metadataList = metadata,
                        actionLabel = "Queue Offline Update",
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
        val data = remember(record.json) { runCatching { JSONObject(record.json) }.getOrElse { JSONObject() } }
        AlertDialog(
            onDismissRequest = { selectedRecord = null },
            title = {
                Text(
                    text = "${record.entityType.replace('_', ' ').uppercase()} DETAILS",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = PolarisColors.TextPrimary
                )
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    DetailRow("Entity Type", record.entityType)
                    DetailRow("Entity ID", record.entityId)
                    DetailRow("Version", record.version.toString())
                    if (record.changedAt != null) DetailRow("Updated At", record.changedAt)
                    HorizontalDivider(color = PolarisColors.LineSubtle)
                    Text("Payload JSON:", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = PolarisColors.TextMuted)
                    Text(
                        text = record.json.take(400),
                        style = PolarisCodeTypography.codeSmall,
                        modifier = Modifier
                            .background(PolarisColors.PolarSurfaceAlt, RoundedCornerShape(4.dp))
                            .padding(8.dp)
                    )
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    val toAdvance = record
                    selectedRecord = null
                    confirmAdvanceRecord = toAdvance
                }) {
                    Text("Queue Offline Update", fontWeight = FontWeight.Bold, color = PolarisColors.PolarBlue)
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

    // Confirmation Dialog
    confirmAdvanceRecord?.let { record ->
        AlertDialog(
            onDismissRequest = { confirmAdvanceRecord = null },
            title = {
                Text(
                    text = "Record Action",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = PolarisColors.TextPrimary
                )
            },
            text = {
                Text(
                    text = "Queue a supported field update for ${record.entityType.replace('_', ' ')}? This will be saved locally first and synchronized later.",
                    fontSize = 13.sp,
                    color = PolarisColors.TextSecondary
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    confirmAdvanceRecord = null
                    scope.launch {
                        runCatching { repository.advance(record) }
                            .onSuccess { onMessage("Update saved locally.") }
                            .onFailure { onMessage(it.message ?: "Unable to queue update") }
                    }
                }) {
                    Text("Save Offline Update", fontWeight = FontWeight.Bold, color = PolarisColors.PolarBlue)
                }
            },
            dismissButton = {
                TextButton(onClick = { confirmAdvanceRecord = null }) {
                    Text("Cancel", color = PolarisColors.TextMuted)
                }
            },
            shape = RoundedCornerShape(PolarisDimens.radiusLg),
            containerColor = PolarisColors.PolarSurface
        )
    }
}
