package com.polaris.field.ui.profile

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.polaris.field.auth.SessionUser
import com.polaris.field.data.remote.api.ApiClient
import com.polaris.field.ui.common.OperationalCard
import com.polaris.field.ui.common.SyntheticDataBanner
import com.polaris.field.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileSettingsScreens(
    user: SessionUser? = null,
    isDarkMode: Boolean = true,
    apiBaseUrl: String = com.polaris.field.BuildConfig.POLARIS_API_BASE_URL,
    onThemeToggle: (Boolean) -> Unit = {},
    onSaveApiBaseUrl: (String) -> Unit = {},
    onLogoutClick: () -> Unit = {}
) {
    var endpoint by remember(apiBaseUrl) { mutableStateOf(apiBaseUrl) }
    var endpointError by remember { mutableStateOf<String?>(null) }
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("OPERATIONS & SETTINGS", fontWeight = FontWeight.Bold, color = TextPrimaryCharcoal) },
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

            item {
                OperationalCard {
                    Text("AUTHENTICATED FIELD OPERATOR", style = MaterialTheme.typography.labelSmall, color = PolarBlueAccent, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(user?.fullName ?: "Active Session", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = TextPrimaryCharcoal)
                    Text("Employee Code: ${user?.employeeCode ?: "BRH-DEMO-001"}", style = MaterialTheme.typography.bodySmall, color = TextSecondaryMuted)
                    Text("Station Scope: ${user?.stationCode ?: "BRH"}", style = MaterialTheme.typography.bodySmall, color = TextSecondaryMuted)
                    Text("Role Scope: ${user?.role ?: "Station Logistics Officer"}", style = MaterialTheme.typography.bodySmall, color = TextSecondaryMuted)
                }
            }

            item {
                OperationalCard {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text("DARK MODE DISPLAY", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, color = TextPrimaryCharcoal)
                            Text("Toggle between Dark Navy and Light theme", style = MaterialTheme.typography.bodySmall, color = TextSecondaryMuted)
                        }
                        Switch(
                            checked = isDarkMode,
                            onCheckedChange = onThemeToggle,
                            colors = SwitchDefaults.colors(checkedThumbColor = PolarBlueAccent)
                        )
                    }
                }
            }

            item {
                OperationalCard {
                    Text("API & NETWORK CONFIGURATION", style = MaterialTheme.typography.labelSmall, color = TextSecondaryMuted, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(6.dp))
                    OutlinedTextField(
                        value = endpoint,
                        onValueChange = { endpoint = it; endpointError = null },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("Backend base URL") },
                        supportingText = { Text("Debug builds may use HTTP on a trusted demo network; deployed releases should use HTTPS.") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
                        singleLine = true
                    )
                    endpointError?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                    Button(onClick = {
                        val parsed = android.net.Uri.parse(endpoint.trim())
                        if (parsed.scheme !in setOf("http", "https") || parsed.host.isNullOrBlank() || parsed.userInfo != null || parsed.query != null || parsed.fragment != null) {
                            endpointError = "Enter a valid HTTP or HTTPS backend URL without credentials or query parameters."
                        } else {
                            val normalized = endpoint.trim().let { if (it.endsWith('/')) it else "$it/" }
                            endpoint = normalized
                            onSaveApiBaseUrl(normalized)
                            endpointError = null
                        }
                    }) { Text("Save backend URL") }
                }
            }

            item {
                Button(
                    onClick = onLogoutClick,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = SemanticRed, contentColor = EnterpriseSurface),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text("SIGN OUT & CLEAR SESSION", fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}
