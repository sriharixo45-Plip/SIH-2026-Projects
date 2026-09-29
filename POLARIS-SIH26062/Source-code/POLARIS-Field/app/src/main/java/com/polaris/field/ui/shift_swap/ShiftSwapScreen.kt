package com.polaris.field.ui.shift_swap

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.polaris.field.ui.common.OperationalCard
import com.polaris.field.ui.common.SyntheticDataBanner
import com.polaris.field.ui.theme.*
import com.polaris.field.data.local.entity.PersonnelAssignmentEntity

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ShiftSwapScreen(
    assignments: List<PersonnelAssignmentEntity> = emptyList(),
    onSubmitSwap: (String, String) -> Unit = { _, _ -> },
    onBackClick: () -> Unit = {}
) {
    var selectedTargetId by remember(assignments) { mutableStateOf(assignments.firstOrNull()?.assignmentId.orEmpty()) }
    var targetMenuExpanded by remember { mutableStateOf(false) }
    var swapReason by remember { mutableStateOf("") }
    var isSubmitted by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("REQUEST SHIFT SWAP", fontWeight = FontWeight.Bold, color = TextPrimaryCharcoal) },
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

            OperationalCard {
                Text("CURRENT ASSIGNED SHIFT", style = MaterialTheme.typography.labelSmall, color = TextSecondaryMuted)
                Text("Today 16:00 — 00:00 UTC", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = TextPrimaryCharcoal)

                Spacer(modifier = Modifier.height(12.dp))

                Box {
                    OutlinedButton(onClick = { targetMenuExpanded = true }, enabled = assignments.isNotEmpty(), modifier = Modifier.fillMaxWidth()) {
                        Text(assignments.firstOrNull { it.assignmentId == selectedTargetId }?.let { "Assignment ${it.assignmentId}" } ?: "No assignments cached")
                    }
                    DropdownMenu(expanded = targetMenuExpanded, onDismissRequest = { targetMenuExpanded = false }) {
                        assignments.forEach { assignment ->
                            DropdownMenuItem(text = { Text("Assignment ${assignment.assignmentId}") }, onClick = {
                                selectedTargetId = assignment.assignmentId
                                targetMenuExpanded = false
                            })
                        }
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                OutlinedTextField(
                    value = swapReason,
                    onValueChange = { swapReason = it },
                    label = { Text("Reason for Swap Request") },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = EnterpriseSurface,
                        unfocusedContainerColor = EnterpriseSurface,
                        focusedBorderColor = PolarBlueAccent,
                        unfocusedBorderColor = EnterpriseBorder
                    )
                )

                if (isSubmitted) {
                    Spacer(modifier = Modifier.height(10.dp))
                    Text(
                        text = "✓ Shift Swap Request submitted to Station Leader for Approval",
                        color = SemanticGreen,
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.Bold
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))

                Button(
                    onClick = {
                        onSubmitSwap(selectedTargetId, swapReason)
                        isSubmitted = true
                    },
                    modifier = Modifier.fillMaxWidth().height(48.dp),
                    enabled = selectedTargetId.isNotBlank() && swapReason.isNotBlank(),
                    colors = ButtonDefaults.buttonColors(containerColor = PolarBlueAccent, contentColor = EnterpriseSurface),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text("SUBMIT FOR APPROVAL", fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}
