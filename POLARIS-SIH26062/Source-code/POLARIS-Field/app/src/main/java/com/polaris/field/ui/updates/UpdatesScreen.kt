package com.polaris.field.ui.updates

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.polaris.field.data.local.entity.AuditLogEntity
import com.polaris.field.ui.common.OperationalCard
import com.polaris.field.ui.common.StatusChip
import com.polaris.field.ui.common.SyntheticDataBanner
import com.polaris.field.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun UpdatesScreen(
    auditLogs: List<AuditLogEntity> = emptyList(),
    onMarkAllReadClick: () -> Unit = {}
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("HQ CHANGE FEED", fontWeight = FontWeight.Bold, color = TextPrimaryCharcoal) },
                actions = {
                    TextButton(onClick = onMarkAllReadClick) {
                        Text("MARK ALL READ", color = PolarBlueAccent, fontWeight = FontWeight.Bold)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = EnterpriseSurface)
            )
        },
        containerColor = EnterpriseBackground
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            SyntheticDataBanner()

            if (auditLogs.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "No HQ update events logged in station database.",
                        color = TextSecondaryMuted,
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(auditLogs) { item ->
                        OperationalCard {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(item.action, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = PolarBlueAccent)
                                if (!item.isRead) {
                                    StatusChip(status = "UNREAD")
                                }
                            }

                            Spacer(modifier = Modifier.height(4.dp))
                            Text("Entity: ${item.entityType} (${item.entityId})", style = MaterialTheme.typography.bodySmall, color = TextSecondaryMuted)

                            if (item.oldValue != null || item.newValue != null) {
                                Spacer(modifier = Modifier.height(6.dp))
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    if (item.oldValue != null) {
                                        Text(item.oldValue, style = MaterialTheme.typography.bodyMedium, color = SemanticRed, fontWeight = FontWeight.Bold)
                                        Text(" → ", style = MaterialTheme.typography.bodyLarge, color = TextPrimaryCharcoal, fontWeight = FontWeight.Bold)
                                    }
                                    if (item.newValue != null) {
                                        Text(item.newValue, style = MaterialTheme.typography.bodyMedium, color = SemanticGreen, fontWeight = FontWeight.Bold)
                                    }
                                }
                            }

                            Spacer(modifier = Modifier.height(6.dp))
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text("Changed by: ${item.changedBy}", style = MaterialTheme.typography.labelSmall, color = TextSecondaryMuted)
                                Text(item.timestampUtc, style = MaterialTheme.typography.labelSmall, color = TextSecondaryMuted)
                            }
                        }
                    }
                }
            }
        }
    }
}
