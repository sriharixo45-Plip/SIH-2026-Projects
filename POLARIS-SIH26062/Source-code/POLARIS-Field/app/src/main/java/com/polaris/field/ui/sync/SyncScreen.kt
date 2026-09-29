package com.polaris.field.ui.sync

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.polaris.field.ui.common.OperationalCard
import com.polaris.field.ui.theme.*
import com.polaris.field.data.local.entity.SyncConflictEntity
import com.polaris.field.data.local.entity.SyncOperationEntity

@Composable
fun SyncScreen(
    deviceId: String,
    pendingOperations: Int,
    conflicts: List<SyncConflictEntity>,
    operations: List<SyncOperationEntity> = emptyList(),
    onSync: () -> Unit,
    onRetryFailed: () -> Unit = {},
    onResolve: (String, String) -> Unit,
    onClearSyncLog: () -> Unit = {}
) {
    val failed = operations.filter { it.status == "FAILED" }
    val syncedCount = operations.count { it.status == "SYNCED" }
    var showClearConfirmation by remember { mutableStateOf(false) }
    var selectedFailure by remember { mutableStateOf<SyncOperationEntity?>(null) }

    if (showClearConfirmation) {
        AlertDialog(
            onDismissRequest = { showClearConfirmation = false },
            title = { Text("Clear local sync log?") },
            text = { Text("This removes completed and failed synchronization history from this device. Server records and unsynchronized field data are not deleted.") },
            confirmButton = { TextButton(onClick = { onClearSyncLog(); showClearConfirmation = false }) { Text("CLEAR") } },
            dismissButton = { TextButton(onClick = { showClearConfirmation = false }) { Text("CANCEL") } }
        )
    }
    selectedFailure?.let { operation ->
        AlertDialog(
            onDismissRequest = { selectedFailure = null },
            title = { Text("Sync failure details") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("Operation ID: ${operation.opId}")
                    Text("Target: ${operation.targetEntityType} · ${operation.targetEntityId}")
                    Text("Error: ${operation.errorMessage ?: "Details were not recorded for this earlier failure."}")
                    Text("HTTP status: ${operation.httpStatus?.toString() ?: "Unavailable"}")
                    Text("Retry state: ${operation.retryCount} retries recorded; status ${operation.status}")
                }
            },
            confirmButton = { TextButton(onClick = { selectedFailure = null }) { Text("CLOSE") } }
        )
    }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("SYNC STATUS", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = TextPrimaryCharcoal)
        OperationalCard {
            Text(if (pendingOperations > 0) "PENDING SYNC" else "READY", style = MaterialTheme.typography.labelSmall, color = if (pendingOperations > 0) SemanticAmber else SemanticGreen, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(6.dp))
            Text("DEVICE", style = MaterialTheme.typography.labelSmall, color = TextSecondaryMuted)
            Text(deviceId.ifBlank { "Preparing device identity…" }, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold, color = TextPrimaryCharcoal)
            Spacer(Modifier.height(12.dp))
            StatusCount("Pending", pendingOperations, if (pendingOperations > 0) SemanticAmber else TextPrimaryCharcoal)
            StatusCount("Synced", syncedCount, TextPrimaryCharcoal)
            StatusCount("Failed", failed.size, if (failed.isNotEmpty()) SemanticRed else TextPrimaryCharcoal)
            StatusCount("Conflicts", conflicts.size, if (conflicts.isNotEmpty()) SemanticRed else TextPrimaryCharcoal)
            Spacer(Modifier.height(12.dp))
            Button(onClick = onSync, enabled = deviceId.isNotBlank(), modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) { Text("SYNC NOW") }
            if (failed.isNotEmpty()) OutlinedButton(onClick = onRetryFailed, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) { Text("RETRY FAILED (${failed.size})") }
        }
        if (failed.isNotEmpty()) OperationalCard {
            Text("SYNC ATTENTION", color = SemanticRed, fontWeight = FontWeight.Bold)
            Text("${failed.size} operation${if (failed.size == 1) "" else "s"} could not be synchronized.", color = SemanticRed)
            failed.forEach { operation ->
                TextButton(onClick = { selectedFailure = operation }, contentPadding = PaddingValues(horizontal = 0.dp)) {
                    Text("View ${operation.targetEntityType} failure details", color = SemanticRed)
                }
            }
        }
        conflicts.forEach { conflict ->
            OperationalCard {
                Text("CONFLICT · ${conflict.entityType}", style = MaterialTheme.typography.labelSmall, color = SemanticRed)
                Text(conflict.entityId, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold, color = TextPrimaryCharcoal)
                Text("Local change and authoritative server state are both retained for review.", style = MaterialTheme.typography.bodySmall, color = TextSecondaryMuted)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    TextButton(onClick = { onResolve(conflict.conflictId, "accepted_server") }) { Text("KEEP SERVER") }
                    TextButton(onClick = { onResolve(conflict.conflictId, "accepted_incoming") }) { Text("KEEP LOCAL") }
                }
            }
        }
        Text("SYNC LOG", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = TextPrimaryCharcoal)
        OperationalCard {
            Text("Completed and failed operation history stored on this device.", style = MaterialTheme.typography.bodySmall, color = TextSecondaryMuted)
            OutlinedButton(onClick = { showClearConfirmation = true }, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) { Text("CLEAR LOCAL SYNC LOG") }
        }
        Text("Changes are saved on this device first and upload when a network is available.", style = MaterialTheme.typography.bodySmall, color = TextSecondaryMuted)
    }
}

@Composable
private fun StatusCount(label: String, count: Int, color: androidx.compose.ui.graphics.Color) {
    Row(Modifier.fillMaxWidth().padding(vertical = 3.dp), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, color = color, fontWeight = if (label == "Failed" && count > 0) FontWeight.Bold else FontWeight.Normal)
        Text(count.toString(), color = color, fontWeight = FontWeight.Bold)
    }
}
