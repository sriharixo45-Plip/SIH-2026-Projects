package com.polaris.field.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Inventory
import androidx.compose.material.icons.filled.LocalShipping
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.navigation.NavHostController
import androidx.navigation.compose.*
import com.polaris.field.ui.LoginStateError
import com.polaris.field.ui.MainViewModel
import com.polaris.field.ui.cargo.CargoScreen
import com.polaris.field.ui.home.HomeScreen
import com.polaris.field.ui.incidents.IncidentsScreen
import com.polaris.field.ui.inventory.InventoryScreen
import com.polaris.field.ui.login.LoginScreen
import com.polaris.field.ui.profile.ProfileSettingsScreens
import com.polaris.field.ui.schedule.ScheduleScreen
import com.polaris.field.ui.shift_swap.ShiftSwapScreen
import com.polaris.field.ui.shipment.ShipmentScreen
import com.polaris.field.ui.sync.SyncScreen
import com.polaris.field.ui.theme.*
import com.polaris.field.ui.updates.UpdatesScreen
import kotlinx.coroutines.launch

sealed class Screen(val route: String, val title: String) {
    object Login : Screen("login", "Login")
    object Home : Screen("home", "Home")
    object Cargo : Screen("cargo", "Cargo")
    object Inventory : Screen("inventory", "Inventory")
    object Incidents : Screen("incidents", "Incidents")
    object More : Screen("more", "More")
    object Transport : Screen("transport", "Transport")
    object Personnel : Screen("personnel", "Personnel")
    object ShiftSwap : Screen("shift_swap", "Shift Swap")
    object Updates : Screen("updates", "Updates")
    object Sync : Screen("sync", "Sync")
}

@Composable
fun PolarisNavGraph(
    viewModel: MainViewModel,
    navController: NavHostController = rememberNavController(),
    startDestination: String = Screen.Login.route
) {
    val currentBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = currentBackStackEntry?.destination?.route
    val coroutineScope = rememberCoroutineScope()

    val sessionUser by viewModel.sessionUser.collectAsState(initial = null)
    val isDarkMode by viewModel.isDarkModeFlow.collectAsState(initial = true)
    val apiBaseUrl by viewModel.apiBaseUrl.collectAsState(initial = com.polaris.field.BuildConfig.POLARIS_API_BASE_URL)
    val cargoList by viewModel.cargoItems.collectAsState(initial = emptyList())
    val cargoLookupMessage by viewModel.cargoLookupMessage.collectAsState()
    val legsList by viewModel.transportLegs.collectAsState(initial = emptyList())
    val stockList by viewModel.inventoryStocks.collectAsState(initial = emptyList())
    val assignmentsList by viewModel.assignments.collectAsState(initial = emptyList())
    val approvalsList by viewModel.approvals.collectAsState(initial = emptyList())
    val incidentsList by viewModel.incidents.collectAsState(initial = emptyList())
    val logsList by viewModel.auditLogs.collectAsState(initial = emptyList())
    val unresolvedConflictsList by viewModel.unresolvedConflicts.collectAsState(initial = emptyList())
    val pendingOperationsList by viewModel.pendingOperations.collectAsState(initial = emptyList())
    val syncOperationsList by viewModel.syncOperations.collectAsState(initial = emptyList())
    val deviceId by viewModel.deviceId.collectAsState()
    val loginState by viewModel.loginState.collectAsState()
    val actionMessage by viewModel.actionMessage.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    LaunchedEffect(actionMessage) {
        actionMessage?.let { snackbarHostState.showSnackbar(it); viewModel.clearActionMessage() }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        bottomBar = {
            if (currentRoute != Screen.Login.route) {
                NavigationBar(
                    containerColor = EnterpriseSurface,
                    contentColor = PolarBlueAccent
                ) {
                    NavigationBarItem(
                        selected = currentRoute == Screen.Home.route,
                        onClick = { navController.navigate(Screen.Home.route) },
                        icon = { Icon(Icons.Default.Home, contentDescription = "Home") },
                        label = { Text("Home", fontWeight = FontWeight.Bold) }
                    )
                    NavigationBarItem(
                        selected = currentRoute == Screen.Cargo.route,
                        onClick = { navController.navigate(Screen.Cargo.route) },
                        icon = { Icon(Icons.Default.LocalShipping, contentDescription = "Cargo") },
                        label = { Text("Cargo", fontWeight = FontWeight.Bold) }
                    )
                    NavigationBarItem(
                        selected = currentRoute == Screen.Inventory.route,
                        onClick = { navController.navigate(Screen.Inventory.route) },
                        icon = { Icon(Icons.Default.Inventory, contentDescription = "Inventory") },
                        label = { Text("Inventory", fontWeight = FontWeight.Bold) }
                    )
                    NavigationBarItem(
                        selected = currentRoute == Screen.Incidents.route,
                        onClick = { navController.navigate(Screen.Incidents.route) },
                        icon = { Icon(Icons.Default.Warning, contentDescription = "Incidents") },
                        label = { Text("Incidents", fontWeight = FontWeight.Bold) }
                    )
                    NavigationBarItem(
                        selected = currentRoute == Screen.More.route || currentRoute == Screen.Sync.route || currentRoute == Screen.Transport.route || currentRoute == Screen.Personnel.route,
                        onClick = { navController.navigate(Screen.More.route) },
                        icon = { Icon(Icons.Default.MoreHoriz, contentDescription = "More") },
                        label = { Text("More", fontWeight = FontWeight.Bold) }
                    )
                }
            }
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = startDestination,
            modifier = Modifier.padding(innerPadding)
        ) {
            composable(Screen.Login.route) {
                LoginScreen(
                    onLoginSuccess = { navController.navigate(Screen.Home.route) },
                    onLoginClick = { code, pwd ->
                        viewModel.login(code, pwd) {
                            navController.navigate(Screen.Home.route)
                        }
                    },
                    errorMessage = if (loginState is LoginStateError) (loginState as LoginStateError).message else null
                )
            }
            composable(Screen.Home.route) {
                HomeScreen(
                    stationName = sessionUser?.stationCode ?: "Bharati Station",
                    userName = sessionUser?.fullName ?: "A. Kumar",
                    userRole = sessionUser?.role ?: "Station Logistics Officer",
                    assignmentEndDate = assignmentsList.firstOrNull()?.endDate,
                    nextShipmentCode = legsList.firstOrNull()?.code,
                    nextShipmentEta = legsList.firstOrNull()?.plannedArrival,
                    cargoCount = cargoList.size,
                    unreadUpdatesCount = logsList.filter { !it.isRead }.size,
                    actionRequiredCount = unresolvedConflictsList.size,
                    lowStockCount = stockList.filter { (it.quantity) <= (it.reorderThreshold) }.size,
                    activeIncidentsCount = incidentsList.filter { it.status != "resolved" && it.status != "closed" }.size,
                    onShipmentClick = { navController.navigate(Screen.Transport.route) },
                    onUpdatesClick = { navController.navigate(Screen.Updates.route) },
                    onScheduleClick = { navController.navigate(Screen.Personnel.route) },
                    onInventoryClick = { navController.navigate(Screen.Inventory.route) },
                    onIncidentsClick = { navController.navigate(Screen.Incidents.route) },
                    onSyncClick = { navController.navigate(Screen.Sync.route) }
                )
            }
            composable(Screen.Cargo.route) {
                CargoScreen(
                    cargoItems = cargoList,
                    transportLegs = legsList,
                    lookupMessage = cargoLookupMessage,
                    onBarcodeScanned = viewModel::lookupCargoByBarcode,
                    onAddCargo = { tracking, desc, category, weight, volume, hazard, isReturn, leg ->
                        viewModel.addCargo(tracking, desc, category, weight, volume, hazard, isReturn, leg)
                    }
                )
            }
            composable(Screen.Inventory.route) {
                InventoryScreen(
                    stocks = stockList,
                    onRecordTransactionClick = viewModel::recordInventoryTransaction,
                    onSyncClick = viewModel::triggerSync
                )
            }
            composable(Screen.Incidents.route) {
                IncidentsScreen(
                    incidents = incidentsList,
                    onReportIncidentClick = viewModel::reportIncident
                )
            }
            composable(Screen.Transport.route) {
                ShipmentScreen(
                    shipmentCode = legsList.firstOrNull()?.code ?: "BRH-RES-03",
                    origin = legsList.firstOrNull()?.origin ?: "Cape Town Port",
                    destination = legsList.firstOrNull()?.destination ?: "Bharati Station",
                    eta = legsList.firstOrNull()?.plannedArrival ?: "20 OCT 2026",
                    status = legsList.firstOrNull()?.status ?: "CONFIRMED",
                    totalItems = cargoList.size,
                    onBackClick = { navController.popBackStack() }
                )
            }
            composable(Screen.Personnel.route) {
                ScheduleScreen(
                    assignments = assignmentsList,
                    approvals = approvalsList,
                    onSwapRequestClick = { navController.navigate(Screen.ShiftSwap.route) }
                )
            }
            composable(Screen.Updates.route) {
                UpdatesScreen(
                    auditLogs = logsList,
                    onMarkAllReadClick = {
                        coroutineScope.launch {
                            viewModel.updatesRepository.markAllAsRead()
                        }
                    }
                )
            }
            composable(Screen.ShiftSwap.route) {
                ShiftSwapScreen(
                    assignments = assignmentsList.filter { it.stationId == sessionUser?.stationId },
                    onSubmitSwap = { targetId, reason ->
                        viewModel.requestShiftSwap(targetId, reason)
                        navController.popBackStack()
                    },
                    onBackClick = { navController.popBackStack() }
                )
            }
            composable(Screen.Sync.route) {
                SyncScreen(
                    deviceId = deviceId,
                    pendingOperations = pendingOperationsList.size,
                    conflicts = unresolvedConflictsList,
                    operations = syncOperationsList,
                    onSync = viewModel::triggerSync,
                    onRetryFailed = viewModel::retryFailedSync,
                    onResolve = viewModel::resolveConflict,
                    onClearSyncLog = viewModel::clearLocalSyncLog
                )
            }
            composable(Screen.More.route) {
                ProfileSettingsScreens(
                    user = sessionUser,
                    isDarkMode = isDarkMode,
                    apiBaseUrl = apiBaseUrl,
                    onThemeToggle = { viewModel.setDarkMode(it) },
                    onSaveApiBaseUrl = viewModel::setApiBaseUrl,
                    onLogoutClick = {
                        viewModel.logout {
                            navController.navigate(Screen.Login.route)
                        }
                    }
                )
            }
        }
    }
}
