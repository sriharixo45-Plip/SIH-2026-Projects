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
fun PersonnelScreen(
    repository: FieldRepository,
    onMessage: (String) -> Unit
) {
    val records by repository.observeRecords("personnel_assignment").collectAsState(initial = emptyList())
    val scope = rememberCoroutineScope()

    var searchQuery by remember { mutableStateOf("") }
    var selectedRecord by remember { mutableStateOf<CachedRecord?>(null) }
    var confirmAdvanceRecord by remember { mutableStateOf<CachedRecord?>(null) }

    val filteredRecords = remember(records, searchQuery) {
        records.filter { record ->
            val p = RecordParser.parsePersonnel(record)
            searchQuery.isBlank() ||
                    p.name.contains(searchQuery, ignoreCase = true) ||
                    p.role.contains(searchQuery, ignoreCase = true) ||
                    p.employeeCode.contains(searchQuery, ignoreCase = true)
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
            label = "Search Personnel Roster",
            placeholder = "Filter by member name, expedition role, or employee ID…",
            leadingIcon = { Text("🔍", fontSize = 14.sp) }
        )

        Spacer(modifier = Modifier.height(PolarisDimens.space3))

        PolarisSectionHeader(
            title = "Station & Expedition Personnel Assignments",
            count = filteredRecords.size
        )

        if (filteredRecords.isEmpty()) {
            PolarisEmptyState(
                title = if (records.isEmpty()) "No Cached Personnel Records" else "No Matching Personnel",
                description = if (records.isEmpty())
                    "Connect to the station LAN to synchronize personnel rosters and rotation schedules."
                else "No personnel matches '${searchQuery}'.",
                icon = { PolarisIcons.PersonnelBadge(size = 40.dp, color = PolarisColors.TextFaint) }
            )
        } else {
            LazyColumn(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(filteredRecords, key = { it.entityId }) { record ->
                    val p = RecordParser.parsePersonnel(record)
                    val metadata = mutableListOf("Role: ${p.role}")
                    if (p.seatBerthRef != null) metadata.add("Berth: ${p.seatBerthRef}")
                    metadata.add("Active: ${p.startDate}")
                    if (p.syncStatus != null) metadata.add("Sync: ${p.syncStatus.uppercase()}")

                    PolarisListItem(
                        code = p.employeeCode,
                        title = p.name,
                        statusText = p.status,
                        subtitle = "Assignment ID: ${p.assignmentId.take(8).uppercase()}",
                        metadataList = metadata,
                        actionLabel = "Update Status (In-Transit)",
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
        val p = RecordParser.parsePersonnel(record)
        AlertDialog(
            onDismissRequest = { selectedRecord = null },
            title = {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = p.name,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = PolarisColors.TextPrimary
                    )
                    PolarisStatusChip(text = p.status)
                }
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    DetailRow("Employee Code", p.employeeCode)
                    DetailRow("Role on Expedition", p.role)
                    DetailRow("Status", p.status.uppercase())
                    DetailRow("Start Date", p.startDate)
                    if (p.endDate != null) DetailRow("End Date", p.endDate)
                    if (p.seatBerthRef != null) DetailRow("Berth / Cabin", p.seatBerthRef)
                    DetailRow("Personnel ID", p.personnelId.take(8).uppercase())
                    DetailRow("Local Version", record.version.toString())
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    val toAdvance = record
                    selectedRecord = null
                    confirmAdvanceRecord = toAdvance
                }) {
                    Text("Update Status", fontWeight = FontWeight.Bold, color = PolarisColors.PolarBlue)
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
        val p = RecordParser.parsePersonnel(record)
        PolarisConfirmationDialog(
            title = "Update Personnel Status",
            message = "Update assignment status for ${p.name} (${p.employeeCode}) to 'in-transit'? This offline update will queue locally.",
            confirmLabel = "Confirm Update",
            onConfirm = {
                confirmAdvanceRecord = null
                scope.launch {
                    runCatching { repository.advance(record) }
                        .onSuccess { onMessage("Personnel status queued for ${p.name}.") }
                        .onFailure { onMessage(it.message ?: "Could not update status.") }
                }
            },
            onDismiss = { confirmAdvanceRecord = null }
        )
    }
}
