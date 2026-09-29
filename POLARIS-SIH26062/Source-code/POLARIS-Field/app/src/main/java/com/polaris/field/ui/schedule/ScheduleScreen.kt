package com.polaris.field.ui.schedule

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.polaris.field.data.local.entity.ApprovalEntity
import com.polaris.field.data.local.entity.PersonnelAssignmentEntity
import com.polaris.field.ui.common.OperationalCard
import com.polaris.field.ui.common.StatusChip
import com.polaris.field.ui.common.SyntheticDataBanner
import com.polaris.field.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScheduleScreen(
    assignments: List<PersonnelAssignmentEntity> = emptyList(),
    approvals: List<ApprovalEntity> = emptyList(),
    onSwapRequestClick: () -> Unit = {}
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("STATION ROSTER & SHIFTS", fontWeight = FontWeight.Bold, color = TextPrimaryCharcoal) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = EnterpriseSurface)
            )
        },
        containerColor = EnterpriseBackground
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item { SyntheticDataBanner() }

            if (assignments.isEmpty()) {
                item {
                    OperationalCard {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("No shift assignments found in station database.", color = TextSecondaryMuted, style = MaterialTheme.typography.bodyMedium)
                            Spacer(modifier = Modifier.height(12.dp))
                            Button(
                                onClick = onSwapRequestClick,
                                modifier = Modifier.fillMaxWidth().height(44.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = PolarBlueAccent, contentColor = EnterpriseSurface),
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Text("REQUEST SHIFT SWAP", fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            } else {
                items(assignments) { assignment ->
                    OperationalCard {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("ASSIGNMENT: ${assignment.assignmentId}", style = MaterialTheme.typography.labelSmall, color = PolarBlueAccent, fontWeight = FontWeight.Bold)
                            StatusChip(status = assignment.status)
                        }
                        Spacer(modifier = Modifier.height(6.dp))
                        Text("Rotation Window: ${assignment.startDate} → ${assignment.endDate ?: "Ongoing"}", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = TextPrimaryCharcoal)
                        Spacer(modifier = Modifier.height(10.dp))
                        OutlinedButton(
                            onClick = onSwapRequestClick,
                            modifier = Modifier.fillMaxWidth().height(38.dp),
                            shape = RoundedCornerShape(6.dp),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = PolarBlueAccent)
                        ) {
                            Text("REQUEST SHIFT SWAP", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            if (approvals.isNotEmpty()) {
                item {
                    Text("PENDING SHIFT SWAP APPROVALS", style = MaterialTheme.typography.labelSmall, color = TextSecondaryMuted, fontWeight = FontWeight.Bold)
                }

                items(approvals) { app ->
                    OperationalCard {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("Approval ID: ${app.approvalId}", style = MaterialTheme.typography.labelSmall, color = TextSecondaryMuted)
                            StatusChip(status = app.decision)
                        }
                        Spacer(modifier = Modifier.height(4.dp))
                        Text("Requester: ${app.requestedBy}", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold, color = TextPrimaryCharcoal)
                        Text("Reason: ${app.reason ?: "No reason provided"}", style = MaterialTheme.typography.bodySmall, color = TextSecondaryMuted)
                    }
                }
            }
        }
    }
}
