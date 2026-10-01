package org.polarisos.field

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Divider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import org.json.JSONObject
import org.polarisos.field.data.CachedRecord
import org.polarisos.field.data.FieldRepository
import org.polarisos.field.data.LocalConflict

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val repository = (application as PolarisFieldApp).repository
        setContent { MaterialTheme { FieldRoot(repository) } }
    }
}

@Composable
private fun FieldRoot(repository: FieldRepository) {
    var signedIn by remember { mutableStateOf(repository.session.signedIn) }
    var page by remember { mutableStateOf("Dashboard") }
    var message by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        if (!signedIn) LoginScreen(repository, busy, message, onLogin = { endpoint, identity, password ->
            scope.launch {
                busy = true; message = ""
                try { repository.login(endpoint, identity, password); signedIn = true; message = "Signed in. Synchronization will run when a connection is available." }
                catch (error: Exception) { message = error.message ?: "Unable to sign in. Check the backend address and connection." }
                finally { busy = false }
            }
        }) else {
            Scaffold(bottomBar = {
                Row(Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 6.dp), horizontalArrangement = Arrangement.SpaceEvenly) {
                    listOf("Dashboard", "Records", "Incident", "Sync", "Settings").forEach { item ->
                        TextButton(onClick = { page = item }) { Text(if (page == item) "• $item" else item) }
                    }
                }
            }) { padding ->
                Column(Modifier.fillMaxSize().padding(padding).padding(horizontal = 16.dp, vertical = 10.dp)) {
                    Text("POLARIS FIELD", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                    Text("${repository.session.stationCode ?: "Station"} · ${repository.session.userName ?: "Field user"}", style = MaterialTheme.typography.bodyMedium)
                    if (message.isNotBlank()) Text(message, color = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(vertical = 6.dp))
                    when (page) {
                        "Dashboard" -> DashboardScreen(repository) { page = it }
                        "Records" -> RecordsScreen(repository, onMessage = { message = it })
                        "Incident" -> IncidentScreen(repository, onMessage = { message = it })
                        "Sync" -> SyncScreen(repository, onMessage = { message = it })
                        else -> SettingsScreen(repository, onLogout = {
                            scope.launch { runCatching { org.polarisos.field.data.FieldApiFactory(repository.session).create().logout() }; repository.session.clear(); signedIn = false; page = "Dashboard" }
                        }, onMessage = { message = it })
                    }
                }
            }
        }
    }
}

@Composable
private fun LoginScreen(repository: FieldRepository, busy: Boolean, message: String, onLogin: (String, String, String) -> Unit) {
    var endpoint by remember { mutableStateOf(repository.session.endpoint) }
    var identity by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    Column(Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.Center) {
        Text("POLARIS Field", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        Text("Sign in while connected once. Previously synchronized records remain available offline.", modifier = Modifier.padding(top = 8.dp, bottom = 18.dp))
        OutlinedTextField(endpoint, { endpoint = it }, Modifier.fillMaxWidth(), label = { Text("Backend URL (https://host[:port]/)") }, singleLine = true)
        Spacer(Modifier.height(10.dp))
        OutlinedTextField(identity, { identity = it }, Modifier.fillMaxWidth(), label = { Text("Email or employee ID") }, singleLine = true)
        Spacer(Modifier.height(10.dp))
        OutlinedTextField(password, { password = it }, Modifier.fillMaxWidth(), label = { Text("Password") }, singleLine = true)
        if (message.isNotBlank()) Text(message, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(vertical = 10.dp))
        Spacer(Modifier.height(12.dp))
        Button(onClick = { onLogin(endpoint, identity, password) }, enabled = !busy && endpoint.isNotBlank() && identity.isNotBlank() && password.isNotBlank(), modifier = Modifier.fillMaxWidth()) { Text(if (busy) "Signing in…" else "Sign in and synchronize") }
    }
}

@Composable
private fun DashboardScreen(repository: FieldRepository, navigate: (String) -> Unit) {
    val records by repository.observeRecords(null).collectAsState(initial = emptyList())
    val pending by repository.database.fieldDao().observePendingCount().collectAsState(initial = 0)
    Column(Modifier.fillMaxSize().padding(top = 18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Station operations", style = MaterialTheme.typography.titleLarge)
        Text("${records.size} cached records · $pending operations waiting to sync")
        Text("This workspace is stored on this device. Changes queue locally and upload when connectivity returns.")
        listOf("Expeditions", "Cargo", "Inventory", "Personnel", "Transport legs").forEach { type -> OutlinedButton(onClick = { navigate("Records") }, modifier = Modifier.fillMaxWidth()) { Text("Open $type") } }
        Button(onClick = { navigate("Incident") }, modifier = Modifier.fillMaxWidth()) { Text("Report incident") }
    }
}

private val recordTypes = listOf("All records", "expedition", "transport_leg", "cargo_item", "inventory_stock", "personnel_assignment", "incident", "approval")

@Composable
private fun RecordsScreen(repository: FieldRepository, onMessage: (String) -> Unit) {
    val scope = rememberCoroutineScope()
    var type by remember { mutableStateOf<String?>(null) }
    var showTypes by remember { mutableStateOf(false) }
    var selected by remember { mutableStateOf<CachedRecord?>(null) }
    val records by repository.observeRecords(type).collectAsState(initial = emptyList())
    Column(Modifier.fillMaxSize()) {
        Text("Operational records", style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(top = 14.dp, bottom = 8.dp))
        OutlinedButton(onClick = { showTypes = true }) { Text(type ?: "All records") }
        androidx.compose.material3.DropdownMenu(expanded = showTypes, onDismissRequest = { showTypes = false }) {
            recordTypes.forEach { option -> androidx.compose.material3.DropdownMenuItem(text = { Text(option) }, onClick = { type = option.takeUnless { it == "All records" }; showTypes = false }) }
        }
        if (records.isEmpty()) Text("No cached records yet. Connect and synchronize from the Sync tab.", modifier = Modifier.padding(16.dp))
        LazyColumn(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(records, key = { "${it.entityType}:${it.entityId}" }) { record -> RecordCard(record) { selected = record } }
        }
    }
    selected?.let { record ->
        AlertDialog(onDismissRequest = { selected = null }, title = { Text("Record action") }, text = { Text("Queue a supported field update for ${record.entityType.replace('_', ' ')}? This will be saved locally first and synchronized later.") }, confirmButton = {
            TextButton(onClick = { selected = null; scope.launch { runCatching { repository.advance(record) }.onSuccess { onMessage("Update saved locally.") }.onFailure { onMessage(it.message ?: "Unable to queue update") } } }) { Text("Save offline update") }
        }, dismissButton = { TextButton(onClick = { selected = null }) { Text("Cancel") } })
    }
}

@Composable
private fun RecordCard(record: CachedRecord, onAction: () -> Unit) {
    val data = remember(record.json) { runCatching { JSONObject(record.json) }.getOrElse { JSONObject() } }
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(data.optString("code", data.optString("tracking_code", record.entityId.take(8))), fontWeight = FontWeight.SemiBold)
            Text(record.entityType.replace('_', ' ').replaceFirstChar { it.uppercase() })
            val status = data.optString("status")
            if (status.isNotBlank()) Text("Status: $status")
            if (record.entityType == "inventory_stock") Text("Quantity: ${data.optString("quantity", "not available")}")
            Button(onClick = onAction, modifier = Modifier.fillMaxWidth()) { Text("Queue field update") }
        }
    }
}

@Composable
private fun IncidentScreen(repository: FieldRepository, onMessage: (String) -> Unit) {
    var type by remember { mutableStateOf("safety") }
    var severity by remember { mutableStateOf("moderate") }
    var details by remember { mutableStateOf("") }
    var latitude by remember { mutableStateOf("") }
    var longitude by remember { mutableStateOf("") }
    var saving by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    Column(Modifier.fillMaxSize().padding(top = 16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("Emergency / incident report", style = MaterialTheme.typography.titleLarge)
        Text("Reports are written to the local queue before any network request.")
        OutlinedTextField(type, { type = it }, Modifier.fillMaxWidth(), label = { Text("Incident type") })
        OutlinedTextField(severity, { severity = it }, Modifier.fillMaxWidth(), label = { Text("Severity: low, moderate, high, critical") })
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(latitude, { latitude = it }, Modifier.weight(1f), label = { Text("Latitude °S") }, singleLine = true)
            OutlinedTextField(longitude, { longitude = it }, Modifier.weight(1f), label = { Text("Longitude °E/W") }, singleLine = true)
        }
        OutlinedTextField(details, { details = it }, Modifier.fillMaxWidth(), label = { Text("What happened?") }, minLines = 3)
        Text("Enter the current incident coordinates. The device does not substitute a fixed station location.", style = MaterialTheme.typography.bodySmall)
        Button(enabled = !saving && details.isNotBlank(), onClick = {
            scope.launch { saving = true; runCatching { repository.createIncident(type.trim(), severity.trim(), details.trim(), latitude.trim(), longitude.trim()) }.onSuccess { details = ""; latitude = ""; longitude = ""; onMessage("Incident saved on this device; sync is queued.") }.onFailure { onMessage(it.message ?: "Could not save incident") }; saving = false }
        }, modifier = Modifier.fillMaxWidth()) { Text(if (saving) "Saving…" else "Save incident offline") }
    }
}

@Composable
private fun SyncScreen(repository: FieldRepository, onMessage: (String) -> Unit) {
    val pending by repository.database.fieldDao().observePendingCount().collectAsState(initial = 0)
    val operations by repository.database.fieldDao().observeOperations().collectAsState(initial = emptyList())
    val conflicts by repository.observeConflicts().collectAsState(initial = emptyList())
    val scope = rememberCoroutineScope()
    Column(Modifier.fillMaxSize().padding(top = 12.dp)) {
        Text("Synchronization", style = MaterialTheme.typography.titleLarge)
        Text("${if (pending == 0) "Queue clear" else "$pending operations queued"} · ${conflicts.size} unresolved conflicts", modifier = Modifier.padding(vertical = 8.dp))
        Button(onClick = { repository.requestSync(); onMessage("Sync queued. It will run when a network connection is available.") }, modifier = Modifier.fillMaxWidth()) { Text("Synchronize now") }
        if (conflicts.isNotEmpty()) Text("Conflicts", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 14.dp))
        LazyColumn(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(conflicts, key = { it.conflictId }) { conflict -> ConflictCard(conflict, onResolve = { acceptIncoming ->
                scope.launch { runCatching { repository.resolveConflict(conflict, acceptIncoming) }.onSuccess { onMessage(if (acceptIncoming) "Incoming value queued again against the latest server version." else "Server value kept.") }.onFailure { onMessage(it.message ?: "Unable to resolve conflict") } }
            }) }
            if (conflicts.isEmpty()) items(operations.filter { it.status != "synced" }, key = { it.opId }) { operation ->
                Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(10.dp)) { Text("${operation.entityType} · ${operation.status}", fontWeight = FontWeight.SemiBold); Text(operation.lastError ?: "Sequence ${operation.sequence}") } }
            }
        }
    }
}

@Composable
private fun ConflictCard(conflict: LocalConflict, onResolve: (Boolean) -> Unit) {
    var details by remember { mutableStateOf(false) }
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Text("${conflict.entityType} · ${conflict.entityId.take(8)}", fontWeight = FontWeight.Bold)
            Text(conflict.reason)
            Text("Recorded: ${conflict.occurredAt}")
            TextButton(onClick = { details = !details }) { Text(if (details) "Hide values" else "Inspect values") }
            if (details) { Text("Incoming: ${conflict.incomingValue.take(240)}"); Text("Server: ${conflict.serverValue?.take(240) ?: "Unavailable"}") }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = { onResolve(false) }, enabled = conflict.serverValue != null) { Text("Keep server") }
                Button(onClick = { onResolve(true) }) { Text("Accept incoming") }
            }
        }
    }
}

@Composable
private fun SettingsScreen(repository: FieldRepository, onLogout: () -> Unit, onMessage: (String) -> Unit) {
    var endpoint by remember { mutableStateOf(repository.session.endpoint) }
    Column(Modifier.fillMaxSize().padding(top = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Device settings", style = MaterialTheme.typography.titleLarge)
        Text("Device ID: ${repository.session.deviceId}")
        OutlinedTextField(endpoint, { endpoint = it }, Modifier.fillMaxWidth(), label = { Text("Backend URL") })
        Button(onClick = { runCatching { repository.session.endpoint = endpoint }.onSuccess { onMessage("Backend address saved.") }.onFailure { onMessage(it.message ?: "Invalid backend URL") } }, modifier = Modifier.fillMaxWidth()) { Text("Save backend address") }
        Text("Debug builds accept HTTP for a trusted demo LAN. Release builds require HTTPS.")
        Divider()
        OutlinedButton(onClick = onLogout, modifier = Modifier.fillMaxWidth()) { Text("Sign out") }
        Text("Cached operational data and queued operations stay on this device after sign out.")
    }
}
