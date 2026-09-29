package com.polaris.field.ui.cargo

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.polaris.field.data.local.entity.CargoItemEntity
import com.polaris.field.data.local.entity.TransportLegEntity
import com.polaris.field.ui.common.OperationalCard
import com.polaris.field.ui.common.StatusChip
import com.polaris.field.ui.common.SyntheticDataBanner
import com.polaris.field.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CargoScreen(
    cargoItems: List<CargoItemEntity> = emptyList(),
    transportLegs: List<TransportLegEntity> = emptyList(),
    lookupMessage: String? = null,
    onBarcodeScanned: (String) -> Unit = {},
    onCargoClick: (String) -> Unit = {},
    onAddCargo: (String, String, String, Double, Double, Int?, Boolean, String) -> Unit = { _, _, _, _, _, _, _, _ -> },
    onSync: () -> Unit = {}
) {
    var searchQuery by remember { mutableStateOf("") }
    var showScannerModal by remember { mutableStateOf(false) }
    var showForm by remember { mutableStateOf(false) }
    var tracking by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("") }
    var weight by remember { mutableStateOf("") }
    var volume by remember { mutableStateOf("") }
    var hazard by remember { mutableStateOf("") }
    var isReturn by remember { mutableStateOf(false) }
    var selectedLeg by remember { mutableStateOf<TransportLegEntity?>(null) }
    var legMenu by remember { mutableStateOf(false) }
    var formError by remember { mutableStateOf<String?>(null) }

    val filteredItems = cargoItems.filter {
        it.cargoId.contains(searchQuery, true) || it.trackingCode.contains(searchQuery, true) ||
            it.description.contains(searchQuery, true) || it.category.contains(searchQuery, true)
    }
    val legCodesById = transportLegs.associate { it.legId to it.code }

    Scaffold(
        topBar = { TopAppBar(title = { Text("CARGO MANIFEST", fontWeight = FontWeight.Bold) }) },
        containerColor = EnterpriseBackground
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            SyntheticDataBanner()
            Button(onClick = { showForm = true }, modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp)) {
                Icon(Icons.Default.Add, contentDescription = null)
                Spacer(Modifier.width(8.dp)); Text("ADD CARGO MANUALLY", fontWeight = FontWeight.Bold)
            }
            OutlinedButton(onClick = { showScannerModal = true }, modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp)) {
                Icon(Icons.Default.QrCodeScanner, contentDescription = "Scan cargo QR code")
                Spacer(Modifier.width(8.dp)); Text("SCAN CARGO", fontWeight = FontWeight.Bold)
            }
            lookupMessage?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium) }
            if (cargoItems.isEmpty()) {
                OperationalCard(Modifier.weight(1f)) {
                    Column(Modifier.fillMaxWidth().padding(vertical = 22.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Icon(Icons.Default.QrCodeScanner, null, tint = PolarBlueAccent, modifier = Modifier.size(36.dp))
                        Text("NO CARGO ITEMS", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Text("No cargo is currently assigned to this station.", style = MaterialTheme.typography.bodyMedium)
                        Text("Use an action above to add cargo or scan a manifest code.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            } else {
                OutlinedTextField(searchQuery, { searchQuery = it }, label = { Text("Search cargo") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                LazyColumn(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(filteredItems, key = { it.cargoId }) { item ->
                        OperationalCard(Modifier.clickable { onCargoClick(item.cargoId) }) {
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                Text(item.trackingCode, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = PolarBlueAccent)
                                StatusChip(item.status)
                            }
                            Text(item.description, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.SemiBold)
                            Text("${item.category} · ${item.weight} kg · ${item.volume} m³", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text("Leg ${legCodesById[item.legId] ?: item.legId}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            if (item.hazardClass != null) Text("HAZARD CLASS ${item.hazardClass}", color = SemanticRed, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelMedium)
                        }
                    }
                }
            }
        }
        if (showScannerModal) BarcodeScannerModal(onDismiss = { showScannerModal = false }, onBarcodeScanned = { code -> searchQuery = code; onBarcodeScanned(code); showScannerModal = false })
        if (showForm) {
            AlertDialog(
                onDismissRequest = { showForm = false },
                title = { Text("ADD CARGO", fontWeight = FontWeight.Bold) },
                text = {
                    Column(Modifier.fillMaxWidth().heightIn(max = 500.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Saved on this device and queued for synchronization.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        OutlinedTextField(tracking, { tracking = it; formError = null }, label = { Text("Tracking code *") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                        OutlinedTextField(description, { description = it; formError = null }, label = { Text("Description *") }, modifier = Modifier.fillMaxWidth())
                        OutlinedTextField(category, { category = it; formError = null }, label = { Text("Category *") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                        OutlinedTextField(weight, { weight = it; formError = null }, label = { Text("Weight (kg)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                        OutlinedTextField(volume, { volume = it; formError = null }, label = { Text("Volume (m³)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                        ExposedDropdownMenuBox(expanded = legMenu, onExpandedChange = { legMenu = it }) {
                            OutlinedTextField(selectedLeg?.code.orEmpty(), {}, readOnly = true, label = { Text("Transport leg *") }, trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(legMenu) }, modifier = Modifier.menuAnchor().fillMaxWidth())
                            ExposedDropdownMenu(expanded = legMenu, onDismissRequest = { legMenu = false }) {
                                transportLegs.forEach { leg -> DropdownMenuItem(text = { Text("${leg.code} · ${leg.destination}") }, onClick = { selectedLeg = leg; legMenu = false }) }
                            }
                        }
                        OutlinedTextField(hazard, { hazard = it; formError = null }, label = { Text("Hazard class (optional)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                        Row(verticalAlignment = Alignment.CenterVertically) { Checkbox(isReturn, { isReturn = it }); Text("Return cargo") }
                        formError?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
                    }
                },
                confirmButton = {
                    Button(onClick = {
                        val parsedWeight = weight.toDoubleOrNull()
                        val parsedVolume = volume.toDoubleOrNull()
                        val parsedHazard = hazard.takeIf { it.isNotBlank() }?.toIntOrNull()
                        formError = when {
                            tracking.trim().length < 3 -> "Enter a tracking code with at least 3 characters."
                            description.isBlank() -> "Description is required."
                            category.isBlank() -> "Category is required."
                            parsedWeight == null || parsedWeight <= 0 -> "Enter a valid weight greater than zero."
                            parsedVolume == null || parsedVolume <= 0 -> "Enter a valid volume greater than zero."
                            hazard.isNotBlank() && (parsedHazard == null || parsedHazard !in 1..9) -> "Hazard class must be between 1 and 9."
                            selectedLeg == null -> "Select a transport leg."
                            else -> null
                        }
                        if (formError == null) {
                            onAddCargo(tracking, description, category, parsedWeight!!, parsedVolume!!, parsedHazard, isReturn, selectedLeg!!.legId)
                            showForm = false
                            tracking = ""; description = ""; category = ""; weight = ""; volume = ""; hazard = ""; isReturn = false; selectedLeg = null
                        }
                    }, enabled = transportLegs.isNotEmpty()) { Text("ADD CARGO") }
                },
                dismissButton = { TextButton(onClick = { showForm = false }) { Text("CANCEL") } }
            )
        }
    }
}
