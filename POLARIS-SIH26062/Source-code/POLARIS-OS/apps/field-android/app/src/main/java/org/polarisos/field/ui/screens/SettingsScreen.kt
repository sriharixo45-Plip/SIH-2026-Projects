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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.polarisos.field.data.FieldRepository
import org.polarisos.field.ui.components.PolarisCard
import org.polarisos.field.ui.components.PolarisConfirmationDialog
import org.polarisos.field.ui.components.PolarisDangerButton
import org.polarisos.field.ui.components.PolarisPrimaryButton
import org.polarisos.field.ui.components.PolarisSectionHeader
import org.polarisos.field.ui.components.PolarisTextField
import org.polarisos.field.ui.theme.PolarisColors
import org.polarisos.field.ui.theme.PolarisDimens

@Composable
fun SettingsScreen(
    repository: FieldRepository,
    onLogout: () -> Unit,
    onMessage: (String) -> Unit
) {
    var endpoint by remember { mutableStateOf(repository.session.endpoint) }
    var showLogoutDialog by remember { mutableStateOf(false) }

    val records by repository.observeRecords(null).collectAsState(initial = emptyList())
    val pending by repository.database.fieldDao().observePendingCount().collectAsState(initial = 0)
    val conflicts by repository.observeConflicts().collectAsState(initial = emptyList())

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(PolarisColors.PolarBg)
            .padding(horizontal = PolarisDimens.space4),
        verticalArrangement = Arrangement.spacedBy(PolarisDimens.space3)
    ) {
        item {
            Spacer(modifier = Modifier.height(PolarisDimens.space2))

            // Operator Profile Section
            PolarisSectionHeader(title = "Authenticated Operator Profile")
            PolarisCard {
                DetailRow("Operator Name", repository.session.userName ?: "Unassigned")
                DetailRow("Station Base", repository.session.stationCode ?: "Not Assigned")
                DetailRow("Station ID", repository.session.stationId?.take(8)?.uppercase() ?: "—")
                DetailRow("User ID", repository.session.userId?.take(8)?.uppercase() ?: "—")
                DetailRow("Session Token", if (repository.session.accessToken != null) "Active (Encrypted)" else "None")
            }
        }

        // Backend Connection Configuration
        item {
            PolarisSectionHeader(title = "HQ Backend Server Configuration")
            PolarisCard {
                Text(
                    text = "Configure the base station API server endpoint. Debug builds permit HTTP for local field LAN; production operations require HTTPS.",
                    fontSize = 12.sp,
                    color = PolarisColors.TextMuted,
                    lineHeight = 16.sp
                )
                Spacer(modifier = Modifier.height(8.dp))

                PolarisTextField(
                    value = endpoint,
                    onValueChange = { endpoint = it },
                    label = "Backend URL",
                    placeholder = "https://host:port/"
                )

                Spacer(modifier = Modifier.height(10.dp))
                PolarisPrimaryButton(
                    text = "Save Server Address",
                    onClick = {
                        runCatching { repository.session.endpoint = endpoint }
                            .onSuccess { onMessage("Backend address saved successfully.") }
                            .onFailure { onMessage(it.message ?: "Invalid backend URL") }
                    }
                )
            }
        }

        // Device Diagnostics & Storage
        item {
            PolarisSectionHeader(title = "Terminal Diagnostics & Storage")
            PolarisCard {
                DetailRow("Device Hardware ID", repository.session.deviceId)
                DetailRow("Local Database", "Room SQLite (v1 encrypted)")
                DetailRow("Cached Records", "${records.size} entries")
                DetailRow("Pending Operations", "$pending queued")
                DetailRow("Unresolved Conflicts", "${conflicts.size} active")
                DetailRow("App Version", "POLARIS Field v1.0.0")
            }
        }

        // Account Sign Out
        item {
            PolarisSectionHeader(title = "Terminal Session Management")
            PolarisCard {
                Text(
                    text = "Cached operational records and queued offline operations are retained on this device after sign out.",
                    fontSize = 12.sp,
                    color = PolarisColors.TextMuted,
                    lineHeight = 16.sp
                )
                Spacer(modifier = Modifier.height(10.dp))
                PolarisDangerButton(
                    text = "Sign Out Operator Session",
                    onClick = { showLogoutDialog = true }
                )
            }
        }

        item {
            Spacer(modifier = Modifier.height(24.dp))
        }
    }

    if (showLogoutDialog) {
        PolarisConfirmationDialog(
            title = "Sign Out Operator?",
            message = "Are you sure you want to sign out? Your queued operations and local station cache will remain stored on this device.",
            confirmLabel = "Sign Out",
            isDestructive = true,
            onConfirm = {
                showLogoutDialog = false
                onLogout()
            },
            onDismiss = { showLogoutDialog = false }
        )
    }
}
