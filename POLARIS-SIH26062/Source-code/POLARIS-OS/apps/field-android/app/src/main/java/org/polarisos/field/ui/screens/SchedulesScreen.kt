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
import org.polarisos.field.ui.theme.PolarisCodeTypography
import org.polarisos.field.ui.theme.PolarisColors
import org.polarisos.field.ui.theme.PolarisDimens
import org.polarisos.field.util.RecordParser

@Composable
fun SchedulesScreen(
    repository: FieldRepository,
    onMessage: (String) -> Unit
) {
    val records by repository.observeRecords("expedition").collectAsState(initial = emptyList())
    val scope = rememberCoroutineScope()

    var selectedRecord by remember { mutableStateOf<CachedRecord?>(null) }
    var confirmAdvanceRecord by remember { mutableStateOf<CachedRecord?>(null) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(PolarisColors.PolarBg)
            .padding(horizontal = PolarisDimens.space4)
    ) {
        Spacer(modifier = Modifier.height(PolarisDimens.space2))

        PolarisSectionHeader(
            title = "Expedition Operations & Schedules",
            count = records.size
        )

        if (records.isEmpty()) {
            PolarisEmptyState(
                title = "No Expedition Schedules Cached",
                description = "Synchronize with POLARIS HQ to download current season expedition missions and schedule timelines.",
                icon = { PolarisIcons.ScheduleCalendar(size = 40.dp, color = PolarisColors.TextFaint) }
            )
        } else {
            LazyColumn(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(records, key = { it.entityId }) { record ->
                    val exp = RecordParser.parseExpedition(record)
                    val metadata = mutableListOf("Season: ${exp.season}")
                    if (exp.startDate != null) metadata.add("Start: ${exp.startDate}")
                    if (exp.endDate != null) metadata.add("End: ${exp.endDate}")
                    if (exp.syncStatus != null) metadata.add("Sync: ${exp.syncStatus.uppercase()}")

                    PolarisListItem(
                        code = exp.code,
                        title = exp.name,
                        statusText = exp.status,
                        subtitle = "Expedition ID: ${exp.expeditionId.take(8).uppercase()}",
                        metadataList = metadata,
                        actionLabel = if (exp.status != "in-progress") "Set In-Progress" else null,
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
        val exp = RecordParser.parseExpedition(record)
        AlertDialog(
            onDismissRequest = { selectedRecord = null },
            title = {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = exp.code,
                        style = PolarisCodeTypography.codeLarge,
                        fontWeight = FontWeight.Bold,
                        color = PolarisColors.TextPrimary
                    )
                    PolarisStatusChip(text = exp.status)
                }
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        text = exp.name,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PolarisColors.TextPrimary
                    )
                    HorizontalDivider(color = PolarisColors.LineSubtle)

                    DetailRow("Season", exp.season)
                    DetailRow("Operational Status", exp.status.uppercase())
                    if (exp.startDate != null) DetailRow("Start Date", exp.startDate)
                    if (exp.endDate != null) DetailRow("End Date", exp.endDate)
                    DetailRow("Expedition ID", exp.expeditionId.take(8).uppercase())
                    DetailRow("Local Version", record.version.toString())
                }
            },
            confirmButton = {
                TextButton(onClick = { selectedRecord = null }) {
                    Text("Close", color = PolarisColors.PolarBlue, fontWeight = FontWeight.Bold)
                }
            },
            shape = RoundedCornerShape(PolarisDimens.radiusLg),
            containerColor = PolarisColors.PolarSurface
        )
    }

    // Advance Confirmation
    confirmAdvanceRecord?.let { record ->
        val exp = RecordParser.parseExpedition(record)
        PolarisConfirmationDialog(
            title = "Set Expedition In-Progress",
            message = "Update expedition ${exp.code} status to 'in-progress'? This update will queue locally.",
            confirmLabel = "Confirm Status",
            onConfirm = {
                confirmAdvanceRecord = null
                scope.launch {
                    runCatching { repository.advance(record) }
                        .onSuccess { onMessage("Expedition ${exp.code} status set to in-progress offline.") }
                        .onFailure { onMessage(it.message ?: "Could not update expedition.") }
                }
            },
            onDismiss = { confirmAdvanceRecord = null }
        )
    }
}
