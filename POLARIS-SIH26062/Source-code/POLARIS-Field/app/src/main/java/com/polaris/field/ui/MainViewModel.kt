package com.polaris.field.ui

import android.app.Application
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.polaris.field.auth.SessionManager
import com.polaris.field.auth.SessionUser
import com.polaris.field.data.local.database.PolarisDatabase
import com.polaris.field.data.local.entity.*
import com.polaris.field.data.remote.api.ApiClient
import com.polaris.field.data.repository.*
import com.polaris.field.sync.SyncManager
import com.polaris.field.sync.SyncScheduler
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

class MainViewModel(application: Application) : AndroidViewModel(application) {

    val database = PolarisDatabase.getInstance(application)
    val sessionManager = SessionManager(application)
    val apiService = ApiClient.getApiService(sessionManager)

    val syncManager = SyncManager(application, apiService, database, sessionManager)
    val authRepository = AuthRepository(apiService, database.userDao(), sessionManager)
    val shipmentRepository = ShipmentRepository(apiService, database.transportLegDao())
    val cargoRepository = CargoRepository(apiService, database.cargoDao(), syncManager)
    val scheduleRepository = ScheduleRepository(apiService, database.scheduleDao(), database.approvalDao(), syncManager)
    val inventoryRepository = InventoryRepository(apiService, database.inventoryDao(), syncManager)
    val incidentRepository = IncidentRepository(apiService, database.incidentDao(), syncManager)
    val updatesRepository = UpdatesRepository(apiService, database.auditLogDao())

    val sessionUser: FlowState<SessionUser?> = authRepository.currentSessionUser
    val isDarkModeFlow: Flow<Boolean> = sessionManager.isDarkModeFlow
    val apiBaseUrl: Flow<String> = sessionManager.apiBaseUrlFlow
    val transportLegs = shipmentRepository.transportLegsFlow
    val cargoItems = cargoRepository.allCargoFlow
    val assignments = scheduleRepository.assignmentsFlow
    val approvals = scheduleRepository.approvalsFlow
    val inventoryStocks = inventoryRepository.stocksFlow
    val incidents = incidentRepository.incidentsFlow
    val auditLogs = updatesRepository.auditLogsFlow
    val pendingOperations = syncManager.pendingOperationsFlow
    val syncOperations = syncManager.allOperationsFlow
    val unresolvedConflicts = syncManager.unresolvedConflictsFlow
    private val _deviceId = MutableStateFlow("")
    val deviceId: StateFlow<String> = _deviceId.asStateFlow()

    private val _loginState = MutableStateFlow<LoginUiState>(LoginStateIdle)
    val loginState: StateFlow<LoginUiState> = _loginState.asStateFlow()

    private val _actionMessage = MutableStateFlow<String?>(null)
    val actionMessage: StateFlow<String?> = _actionMessage.asStateFlow()

    init { viewModelScope.launch { _deviceId.value = sessionManager.getDeviceId(sessionManager.sessionUserFlow.first()?.userId) } }

    private val _cargoLookupMessage = MutableStateFlow<String?>(null)
    val cargoLookupMessage: StateFlow<String?> = _cargoLookupMessage.asStateFlow()

    fun setDarkMode(isDark: Boolean) {
        viewModelScope.launch {
            sessionManager.setDarkMode(isDark)
        }
    }

    fun setApiBaseUrl(url: String) {
        viewModelScope.launch { sessionManager.setApiBaseUrl(url) }
    }

    fun login(employeeCode: String, passwordText: String, onSuccess: () -> Unit) {
        viewModelScope.launch {
            _loginState.value = LoginStateLoading
            val result = authRepository.login(employeeCode, passwordText)
            result.fold(
                onSuccess = { user ->
                    syncManager.ensureLocalScope("${user.userId}:${user.stationId.orEmpty()}")
                    _deviceId.value = sessionManager.getDeviceId(user.userId)
                    _loginState.value = LoginStateSuccess(user)
                    SyncScheduler.requestNow(getApplication())
                    refreshAllData()
                    onSuccess()
                },
                onFailure = { error ->
                    _loginState.value = LoginStateError(error.localizedMessage ?: "Invalid credentials")
                }
            )
        }
    }

    fun logout(onSuccess: () -> Unit) {
        viewModelScope.launch {
            authRepository.logout()
            _loginState.value = LoginStateIdle
            onSuccess()
        }
    }

    fun refreshAllData() {
        viewModelScope.launch {
            shipmentRepository.refreshLegs()
            cargoRepository.refreshCargo()
            scheduleRepository.refreshAssignments()
            inventoryRepository.refreshStocks()
            updatesRepository.refreshAuditLogs()
        }
    }

    fun updateCargoStatus(cargoId: String, newStatus: String, reason: String? = null) {
        viewModelScope.launch {
            val user = sessionManager.sessionUserFlow.first() ?: return@launch
            cargoRepository.updateCargoStatus(cargoId, newStatus, user.userId, reason)
                .onSuccess { _actionMessage.value = "Cargo status updated to $newStatus" }
                .onFailure { _actionMessage.value = it.localizedMessage }
        }
    }

    fun lookupCargoByBarcode(barcode: String) {
        viewModelScope.launch {
            _cargoLookupMessage.value = null
            val localCargo = cargoRepository.getCargoByBarcode(barcode)
            if (localCargo != null) return@launch

            if (!hasInternetConnection()) {
                _cargoLookupMessage.value = "Cargo not available offline."
                return@launch
            }

            if (cargoRepository.findCargoByBarcodeOnline(barcode) == null) {
                _cargoLookupMessage.value = "Cargo not found in the online manifest."
            }
        }
    }

    fun addCargo(trackingCode: String, description: String, category: String, weight: Double, volume: Double, hazardClass: Int?, isReturnCargo: Boolean, legId: String) {
        viewModelScope.launch {
            val user = sessionManager.sessionUserFlow.first() ?: return@launch
            cargoRepository.createCargo(trackingCode, description, category, weight, volume, hazardClass, isReturnCargo, legId, user.userId)
                .onSuccess { _actionMessage.value = if (hasInternetConnection()) "CARGO ADDED · saved locally and queued to sync" else "SAVED OFFLINE · will synchronize when connectivity returns" }
                .onFailure { _actionMessage.value = it.message ?: "Cargo could not be added. Check the entered details." }
        }
    }

    private fun hasInternetConnection(): Boolean {
        val connectivityManager = getApplication<Application>()
            .getSystemService(ConnectivityManager::class.java) ?: return false
        val network = connectivityManager.activeNetwork ?: return false
        val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
                capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }

    fun recordInventoryTransaction(stockId: String, type: String, delta: Double, reason: String) {
        viewModelScope.launch {
            val user = sessionManager.sessionUserFlow.first() ?: return@launch
            inventoryRepository.recordTransaction(stockId, type, delta, reason, user.userId)
                .onSuccess { _actionMessage.value = "Inventory transaction recorded ($type $delta)" }
                .onFailure { _actionMessage.value = it.localizedMessage }
        }
    }

    fun reportIncident(type: String, severity: String, description: String) {
        viewModelScope.launch {
            val user = sessionManager.sessionUserFlow.first() ?: return@launch
            incidentRepository.createIncident(type, severity, description, user.userId, user.stationId)
                .onSuccess { _actionMessage.value = "Incident reported ($type)" }
                .onFailure { _actionMessage.value = it.localizedMessage }
        }
    }

    fun requestShiftSwap(targetId: String, reason: String) {
        viewModelScope.launch {
            val user = sessionManager.sessionUserFlow.first() ?: return@launch
            scheduleRepository.requestShiftSwap(user.userId, targetId, reason)
                .onSuccess { _actionMessage.value = "Shift swap request submitted" }
                .onFailure { _actionMessage.value = it.localizedMessage }
        }
    }

    fun resolveConflict(conflictId: String, resolution: String) {
        viewModelScope.launch {
            val user = sessionManager.sessionUserFlow.first() ?: return@launch
            syncManager.resolveConflict(conflictId, resolution, user.userId)
                .onSuccess { _actionMessage.value = "Sync conflict resolved ($resolution)" }
                .onFailure { _actionMessage.value = it.localizedMessage }
        }
    }

    fun clearActionMessage() {
        _actionMessage.value = null
    }

    fun triggerSync() { SyncScheduler.requestNow(getApplication()) }

    fun retryFailedSync() {
        viewModelScope.launch { syncManager.retryFailedOperations() }
    }

    fun clearLocalSyncLog() {
        viewModelScope.launch { syncManager.clearLocalSyncLog() }
    }
}

typealias FlowState<T> = Flow<T>

sealed interface LoginUiState
object LoginStateIdle : LoginUiState
object LoginStateLoading : LoginUiState
data class LoginStateSuccess(val user: SessionUser) : LoginUiState
data class LoginStateError(val message: String) : LoginUiState
