package org.polarisos.field

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.polarisos.field.data.FieldApiFactory
import org.polarisos.field.data.FieldRepository
import org.polarisos.field.ui.components.PolarisBottomBar
import org.polarisos.field.ui.components.PolarisOfflineBanner
import org.polarisos.field.ui.components.PolarisTopBar
import org.polarisos.field.ui.screens.CargoScreen
import org.polarisos.field.ui.screens.DashboardScreen
import org.polarisos.field.ui.screens.IncidentScreen
import org.polarisos.field.ui.screens.InventoryScreen
import org.polarisos.field.ui.screens.LoginScreen
import org.polarisos.field.ui.screens.PersonnelScreen
import org.polarisos.field.ui.screens.RecordsScreen
import org.polarisos.field.ui.screens.SchedulesScreen
import org.polarisos.field.ui.screens.SettingsScreen
import org.polarisos.field.ui.screens.ShipmentsScreen
import org.polarisos.field.ui.screens.SyncScreen
import org.polarisos.field.ui.theme.PolarisColors
import org.polarisos.field.ui.theme.PolarisDimens
import org.polarisos.field.ui.theme.PolarisTheme
import org.polarisos.field.util.NetworkMonitor

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val repository = (application as PolarisFieldApp).repository
        val networkMonitor = NetworkMonitor(this)

        setContent {
            PolarisTheme {
                FieldRoot(repository = repository, networkMonitor = networkMonitor)
            }
        }
    }
}

@Composable
private fun FieldRoot(
    repository: FieldRepository,
    networkMonitor: NetworkMonitor
) {
    var signedIn by remember { mutableStateOf(repository.session.signedIn) }
    var page by remember { mutableStateOf("Dashboard") }
    var message by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    // Real Network Connectivity observation
    val isOnline by networkMonitor.isOnline.collectAsState(initial = networkMonitor.checkCurrentConnectivity())

    // Pending operation count & active incident count for badges
    val pendingCount by repository.database.fieldDao().observePendingCount().collectAsState(initial = 0)
    val incidents by repository.observeRecords("incident").collectAsState(initial = emptyList())
    val activeIncidentsCount = remember(incidents) {
        incidents.count {
            !it.json.contains("\"status\":\"resolved\"", ignoreCase = true)
        }
    }

    // Auto-dismiss transient status messages after 5 seconds
    LaunchedEffect(message) {
        if (message.isNotBlank()) {
            delay(5000)
            message = ""
        }
    }

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = PolarisColors.PolarBg
    ) {
        if (!signedIn) {
            LoginScreen(
                repository = repository,
                busy = busy,
                message = message,
                isOnline = isOnline,
                onLogin = { endpoint, identity, password ->
                    scope.launch {
                        busy = true
                        message = ""
                        try {
                            repository.login(endpoint, identity, password)
                            signedIn = true
                            page = "Dashboard"
                            message = "Signed in. Station database synchronization active."
                        } catch (error: Exception) {
                            message = error.message ?: "Unable to sign in. Check the backend address and connection."
                        } finally {
                            busy = false
                        }
                    }
                }
            )
        } else {
            val isSubScreen = page in listOf("Personnel", "Shipments", "Schedules", "Records", "Settings")

            Scaffold(
                topBar = {
                    PolarisTopBar(
                        stationCode = repository.session.stationCode,
                        userName = repository.session.userName,
                        isOnline = isOnline,
                        pendingCount = pendingCount,
                        title = when (page) {
                            "Dashboard" -> "POLARIS FIELD"
                            "Cargo" -> "CARGO MANIFEST"
                            "Inventory" -> "STATION STOCK"
                            "Incident" -> "INCIDENT OPS"
                            "Personnel" -> "PERSONNEL"
                            "Shipments" -> "TRANSPORT LEGS"
                            "Schedules" -> "EXPEDITIONS"
                            "Records" -> "OPERATIONAL DATA"
                            "Sync" -> "SYNC CENTER"
                            "Settings" -> "SETTINGS"
                            else -> "POLARIS FIELD"
                        },
                        showBackButton = isSubScreen,
                        onBackClick = { page = "Dashboard" },
                        onSyncClick = { page = "Sync" },
                        onSettingsClick = { page = "Settings" }
                    )
                },
                bottomBar = {
                    PolarisBottomBar(
                        currentRoute = page,
                        onNavigate = { page = it },
                        pendingSyncCount = pendingCount,
                        activeIncidentsCount = activeIncidentsCount
                    )
                }
            ) { padding ->
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding)
                ) {
                    Column(modifier = Modifier.fillMaxSize()) {
                        // Persistent unobtrusive offline/sync indicator banner
                        PolarisOfflineBanner(
                            isOnline = isOnline,
                            pendingCount = pendingCount
                        )

                        // Main Content View
                        Box(modifier = Modifier.weight(1f)) {
                            when (page) {
                                "Dashboard" -> DashboardScreen(
                                    repository = repository,
                                    isOnline = isOnline,
                                    onNavigate = { page = it }
                                )
                                "Cargo" -> CargoScreen(
                                    repository = repository,
                                    onMessage = { message = it }
                                )
                                "Inventory" -> InventoryScreen(
                                    repository = repository,
                                    onMessage = { message = it }
                                )
                                "Incident" -> IncidentScreen(
                                    repository = repository,
                                    onMessage = { message = it }
                                )
                                "Personnel" -> PersonnelScreen(
                                    repository = repository,
                                    onMessage = { message = it }
                                )
                                "Shipments" -> ShipmentsScreen(
                                    repository = repository,
                                    onMessage = { message = it }
                                )
                                "Schedules" -> SchedulesScreen(
                                    repository = repository,
                                    onMessage = { message = it }
                                )
                                "Records" -> RecordsScreen(
                                    repository = repository,
                                    onMessage = { message = it }
                                )
                                "Sync" -> SyncScreen(
                                    repository = repository,
                                    isOnline = isOnline,
                                    onMessage = { message = it }
                                )
                                "Settings" -> SettingsScreen(
                                    repository = repository,
                                    onLogout = {
                                        scope.launch {
                                            runCatching { FieldApiFactory(repository.session).create().logout() }
                                            repository.session.clear()
                                            signedIn = false
                                            page = "Dashboard"
                                            message = "Signed out. Station cache preserved on device."
                                        }
                                    },
                                    onMessage = { message = it }
                                )
                                else -> DashboardScreen(
                                    repository = repository,
                                    isOnline = isOnline,
                                    onNavigate = { page = it }
                                )
                            }
                        }
                    }

                    // Floating Notification Banner
                    AnimatedVisibility(
                        visible = message.isNotBlank(),
                        enter = slideInVertically(initialOffsetY = { -it }) + fadeIn(),
                        exit = slideOutVertically(targetOffsetY = { -it }) + fadeOut(),
                        modifier = Modifier
                            .align(Alignment.TopCenter)
                            .padding(top = 8.dp, start = 16.dp, end = 16.dp)
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(PolarisDimens.radiusSm))
                                .background(PolarisColors.Navy900)
                                .border(1.dp, PolarisColors.PolarBlueLight, RoundedCornerShape(PolarisDimens.radiusSm))
                                .clickable { message = "" }
                                .padding(horizontal = 14.dp, vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("ℹ", color = PolarisColors.PolarCyan, fontSize = 14.sp)
                            Spacer(modifier = Modifier.width(10.dp))
                            Text(
                                text = message,
                                color = Color.White,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Medium,
                                modifier = Modifier.weight(1f)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "✕",
                                color = PolarisColors.TextFaint,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }
        }
    }
}
