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
import org.polarisos.field.data.FieldRepository
import org.polarisos.field.data.LocalConflict
import org.polarisos.field.data.PendingOperation
import org.polarisos.field.ui.components.PolarisCard
import org.polarisos.field.ui.components.PolarisEmptyState
import org.polarisos.field.ui.components.PolarisIcons
import org.polarisos.field.ui.components.PolarisMetricCard
import org.polarisos.field.ui.components.PolarisPrimaryButton
import org.polarisos.field.ui.components.PolarisSecondaryButton
import org.polarisos.field.ui.components.PolarisSectionHeader
import org.polarisos.field.ui.components.PolarisStatusChip
import org.polarisos.field.ui.components.PolarisStatusTone
import org.polarisos.field.ui.theme.PolarisCodeTypography
import org.polarisos.field.ui.theme.PolarisColors
import org.polarisos.field.ui.theme.PolarisDimens

@Composable
fun SyncScreen(
    repository: FieldRepository,
    isOnline: Boolean,
    onMessage: (String) -> Unit
) {
    val pendingCount by repository.database.fieldDao().observePendingCount().collectAsState(initial = 0)
    val operations by repository.database.fieldDao().observeOperations().collectAsState(initial = emptyList())
    val conflicts by repository.observeConflicts().collectAsState(initial = emptyList())
    val scope = rememberCoroutineScope()

    var isSyncRequested by remember { mutableStateOf(false) }

    val failedOpsCount = remember(operations) {
        operations.count { it.status == "rejected" || it.status == "conflicted" }
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(PolarisColors.PolarBg)
            .padding(horizontal = PolarisDimens.space4),
        verticalArrangement = Arrangement.spacedBy(PolarisDimens.space3)
    ) {
        item {
            Spacer(modifier = Modifier.height(PolarisDimens.space2))

            // Main Telemetry & Sync Status Banner Card
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
                            text = "OFFLINE SYNCHRONIZATION ENGINE",
                            color = PolarisColors.PolarCyan,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 1.sp
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = if (isOnline) "NETWORK CONNECTED" else "OFFLINE LOCAL QUEUE",
                            color = Color.White,
                            fontSize = 17.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "Station Device: ${repository.session.deviceId.take(8).uppercase()}",
                            color = PolarisColors.TextFaint,
                            fontSize = 11.sp,
                            fontFamily = FontFamily.Monospace
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
                                text = if (isOnline) "ONLINE" else "STANDBY",
                                color = if (isOnline) PolarisColors.StatusNominal else PolarisColors.TextFaint,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                // Manual Sync Trigger Button
                PolarisPrimaryButton(
                    text = if (isOnline) "Synchronize Now with Base Station" else "Queue Sync (Runs on Reconnect)",
                    onClick = {
                        isSyncRequested = true
                        repository.requestSync()
                        onMessage(
                            if (isOnline) "Synchronization worker triggered."
                            else "Sync queued. Changes will transmit when network connectivity is restored."
                        )
                    },
                    leadingIcon = { PolarisIcons.SyncArrows(size = 18.dp, color = Color.White) }
                )
            }
        }

        // Metrics Strip
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                PolarisMetricCard(
                    label = "Pending Queue",
                    value = pendingCount.toString(),
                    subtext = if (pendingCount == 0) "Queue nominal" else "Awaiting upload",
                    valueColor = if (pendingCount > 0) PolarisColors.StatusWarning else PolarisColors.TextPrimary,
                    modifier = Modifier.weight(1f)
                )
                PolarisMetricCard(
                    label = "Conflicts",
                    value = conflicts.size.toString(),
                    subtext = if (conflicts.isEmpty()) "Zero conflicts" else "Action required",
                    valueColor = if (conflicts.isNotEmpty()) PolarisColors.StatusCritical else PolarisColors.TextPrimary,
                    modifier = Modifier.weight(1f)
                )
                PolarisMetricCard(
                    label = "Rejected / Alert",
                    value = failedOpsCount.toString(),
                    subtext = if (failedOpsCount == 0) "Clean" else "Review log",
                    valueColor = if (failedOpsCount > 0) PolarisColors.StatusCritical else PolarisColors.TextPrimary,
                    modifier = Modifier.weight(1f)
                )
            }
        }

        // Unresolved Conflicts Section
        if (conflicts.isNotEmpty()) {
            item {
                PolarisSectionHeader(
                    title = "Unresolved Data Conflicts",
                    count = conflicts.size
                )
            }
            items(conflicts, key = { it.conflictId }) { conflict ->
                ConflictResolutionCard(
                    conflict = conflict,
                    onResolve = { acceptIncoming ->
                        scope.launch {
                            runCatching { repository.resolveConflict(conflict, acceptIncoming) }
                                .onSuccess {
                                    onMessage(
                                        if (acceptIncoming) "Accepted incoming field update; queued for server sync."
                                        else "Preserved authoritative server value."
                                    )
                                }
                                .onFailure { onMessage(it.message ?: "Unable to resolve conflict.") }
                        }
                    }
                )
            }
        }

        // Pending & Recent Sync Operations
        item {
            PolarisSectionHeader(
                title = "Local Sync Operation Queue",
                count = operations.size
            )
        }

        if (operations.isEmpty()) {
            item {
                PolarisEmptyState(
                    title = "Operation Queue Clean",
                    description = "All offline mutations and telemetry updates have synchronized with the server.",
                    icon = { PolarisIcons.SyncArrows(size = 40.dp, color = PolarisColors.TextFaint) }
                )
            }
        } else {
            items(operations, key = { it.opId }) { op ->
                OperationQueueCard(op)
            }
        }

        item {
            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}

@Composable
private fun ConflictResolutionCard(
    conflict: LocalConflict,
    onResolve: (Boolean) -> Unit
) {
    var showValues by remember { mutableStateOf(false) }

    PolarisCard(
        backgroundColor = PolarisColors.StatusCriticalBg,
        borderColor = PolarisColors.StatusCriticalBorder
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = "${conflict.entityType.replace('_', ' ').uppercase()} CONFLICT",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = PolarisColors.StatusCritical,
                    letterSpacing = 0.5.sp
                )
                Text(
                    text = "Entity ID: ${conflict.entityId.take(8).uppercase()}",
                    style = PolarisCodeTypography.codeMedium,
                    fontWeight = FontWeight.Bold,
                    color = PolarisColors.TextPrimary
                )
            }
            PolarisStatusChip(text = "CONFLICT", tone = PolarisStatusTone.CRITICAL)
        }

        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = conflict.reason,
            fontSize = 12.sp,
            color = PolarisColors.TextSecondary
        )
        Text(
            text = "Occurred: ${conflict.occurredAt}",
            fontSize = 11.sp,
            color = PolarisColors.TextMuted,
            fontFamily = FontFamily.Monospace
        )

        Spacer(modifier = Modifier.height(6.dp))
        TextButton(
            onClick = { showValues = !showValues },
            contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp)
        ) {
            Text(
                text = if (showValues) "▲ Hide Conflicting JSON" else "▼ Compare Incoming vs Server Data",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = PolarisColors.PolarBlue
            )
        }

        if (showValues) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(PolarisColors.PolarSurface, RoundedCornerShape(4.dp))
                    .padding(8.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text("INCOMING (FIELD):", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = PolarisColors.PolarBlue)
                Text(conflict.incomingValue.take(240), style = PolarisCodeTypography.codeSmall)
                HorizontalDivider(color = PolarisColors.LineSubtle)
                Text("SERVER (HQ AUTHORITATIVE):", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = PolarisColors.StatusCritical)
                Text(conflict.serverValue?.take(240) ?: "Unavailable on server", style = PolarisCodeTypography.codeSmall)
            }
        }

        Spacer(modifier = Modifier.height(8.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            PolarisSecondaryButton(
                text = "Keep Server Value",
                onClick = { onResolve(false) },
                enabled = conflict.serverValue != null,
                modifier = Modifier.weight(1f)
            )
            PolarisPrimaryButton(
                text = "Accept Incoming",
                onClick = { onResolve(true) },
                modifier = Modifier.weight(1f)
            )
        }
    }
}

@Composable
private fun OperationQueueCard(op: PendingOperation) {
    val tone = when (op.status) {
        "synced" -> PolarisStatusTone.NOMINAL
        "pending" -> PolarisStatusTone.WARNING
        "rejected", "conflicted" -> PolarisStatusTone.CRITICAL
        else -> PolarisStatusTone.MUTED
    }

    PolarisCard {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = "${op.operationType.uppercase()} • ${op.entityType.replace('_', ' ').uppercase()}",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = PolarisColors.TextPrimary
                )
                Text(
                    text = "ID: ${op.entityId.take(8).uppercase()} • Seq: #${op.sequence}",
                    style = PolarisCodeTypography.codeSmall,
                    color = PolarisColors.TextMuted
                )
            }
            PolarisStatusChip(text = op.status, tone = tone)
        }

        if (!op.lastError.isNullOrBlank()) {
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "Error: ${op.lastError}",
                fontSize = 11.sp,
                color = PolarisColors.StatusCritical,
                fontFamily = FontFamily.Monospace
            )
        }

        Spacer(modifier = Modifier.height(4.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = "Created: ${op.localTimestamp.take(19)}",
                fontSize = 10.sp,
                color = PolarisColors.TextFaint
            )
            Text(
                text = "Attempts: ${op.attempts}",
                fontSize = 10.sp,
                color = PolarisColors.TextFaint,
                fontFamily = FontFamily.Monospace
            )
        }
    }
}
