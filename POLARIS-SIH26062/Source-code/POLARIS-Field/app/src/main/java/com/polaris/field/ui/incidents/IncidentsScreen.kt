package com.polaris.field.ui.incidents

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.polaris.field.data.local.entity.IncidentEntity
import com.polaris.field.ui.common.OperationalCard
import com.polaris.field.ui.common.StatusChip
import com.polaris.field.ui.common.SyntheticDataBanner
import com.polaris.field.ui.common.formatFieldDateTime
import com.polaris.field.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun IncidentsScreen(
    incidents: List<IncidentEntity> = emptyList(),
    onReportIncidentClick: (String, String, String) -> Unit = { _, _, _ -> }
) {
    var showReportDialog by remember { mutableStateOf(false) }
    var incidentType by remember { mutableStateOf("Blizzard Disruption") }
    var incidentSeverity by remember { mutableStateOf("High") }
    var incidentDescription by remember { mutableStateOf("") }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("STATION INCIDENT LOG", fontWeight = FontWeight.Bold, color = TextPrimaryCharcoal) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = EnterpriseSurface)
            )
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { showReportDialog = true },
                containerColor = SemanticRed,
                contentColor = EnterpriseSurface
            ) {
                Icon(Icons.Default.Add, contentDescription = null)
                Spacer(modifier = Modifier.width(6.dp))
                Text("REPORT INCIDENT", fontWeight = FontWeight.Bold, fontSize = 12.sp)
            }
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

            if (incidents.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "No active operational incidents in station database.",
                        color = TextSecondaryMuted,
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(incidents) { item ->
                        OperationalCard(borderColor = if (item.status.equals("active", ignoreCase = true)) SemanticRed else EnterpriseBorder) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = item.type.uppercase(),
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = SemanticRed
                                )
                                StatusChip(status = item.status)
                            }
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                text = item.description ?: "No description provided",
                                style = MaterialTheme.typography.bodyMedium,
                                color = TextPrimaryCharcoal
                            )
                            Text("ID ${item.incidentId} · ${item.stationId ?: "Station unavailable"}", style = MaterialTheme.typography.labelSmall, color = TextSecondaryMuted)
                            Spacer(modifier = Modifier.height(8.dp))
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text("Severity: ${item.severity}", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, color = SemanticAmber)
                                Text(formatFieldDateTime(item.declaredAt), style = MaterialTheme.typography.labelSmall, color = TextSecondaryMuted)
                            }
                        }
                    }
                }
            }
        }

        if (showReportDialog) {
            AlertDialog(
                onDismissRequest = { showReportDialog = false },
                confirmButton = {
                    Button(
                        onClick = {
                            onReportIncidentClick(incidentType, incidentSeverity, incidentDescription)
                            showReportDialog = false
                            incidentDescription = ""
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = SemanticRed)
                    ) {
                        Text("REPORT INCIDENT", fontWeight = FontWeight.Bold)
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showReportDialog = false }) {
                        Text("CANCEL", color = TextSecondaryMuted)
                    }
                },
                title = {
                    Text("REPORT OPERATIONAL INCIDENT", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        OutlinedTextField(
                            value = incidentType,
                            onValueChange = { incidentType = it },
                            label = { Text("Incident Type") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true
                        )

                        OutlinedTextField(
                            value = incidentSeverity,
                            onValueChange = { incidentSeverity = it },
                            label = { Text("Severity (Low / Moderate / High / Critical)") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true
                        )

                        OutlinedTextField(
                            value = incidentDescription,
                            onValueChange = { incidentDescription = it },
                            label = { Text("Operational Impact Description") },
                            placeholder = { Text("e.g. Blizzard gust disrupting cargo unloading") },
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                },
                containerColor = EnterpriseSurface
            )
        }
    }
}
