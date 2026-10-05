package org.polarisos.field.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
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
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import org.polarisos.field.data.CachedRecord
import org.polarisos.field.data.FieldRepository
import org.polarisos.field.ui.components.PolarisCard
import org.polarisos.field.ui.components.PolarisEmptyState
import org.polarisos.field.ui.components.PolarisErrorBanner
import org.polarisos.field.ui.components.PolarisIcons
import org.polarisos.field.ui.components.PolarisListItem
import org.polarisos.field.ui.components.PolarisDangerButton
import org.polarisos.field.ui.components.PolarisSectionHeader
import org.polarisos.field.ui.components.PolarisStatusChip
import org.polarisos.field.ui.components.PolarisStatusTone
import org.polarisos.field.ui.components.PolarisTextField
import org.polarisos.field.ui.theme.PolarisCodeTypography
import org.polarisos.field.ui.theme.PolarisColors
import org.polarisos.field.ui.theme.PolarisDimens
import org.polarisos.field.util.RecordParser

@Composable
fun IncidentScreen(
    repository: FieldRepository,
    onMessage: (String) -> Unit
) {
    val records by repository.observeRecords("incident").collectAsState(initial = emptyList())
    val scope = rememberCoroutineScope()

    var activeTab by remember { mutableStateOf("List") } // "List" or "Report"
    var selectedRecord by remember { mutableStateOf<CachedRecord?>(null) }

    // Report Form States
    var incidentType by remember { mutableStateOf("safety") }
    var severity by remember { mutableStateOf("moderate") }
    var details by remember { mutableStateOf("") }
    var latitude by remember { mutableStateOf("-70.67") } // Example Antarctic station latitude
    var longitude by remember { mutableStateOf("-8.28") } // Example Antarctic station longitude
    var saving by remember { mutableStateOf(false) }
    var formError by remember { mutableStateOf("") }

    val incidentTypes = listOf("safety", "equipment", "environmental", "medical", "logistics")
    val severities = listOf("low", "moderate", "high", "critical")

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(PolarisColors.PolarBg)
            .padding(horizontal = PolarisDimens.space4)
    ) {
        Spacer(modifier = Modifier.height(PolarisDimens.space2))

        // Tab Selector Row
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(PolarisDimens.radiusSm))
                .background(PolarisColors.PolarSurface)
                .padding(4.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Box(
                modifier = Modifier
                    .weight(1f)
                    .heightIn(min = PolarisDimens.minTouchTarget)
                    .clip(RoundedCornerShape(PolarisDimens.radiusXs))
                    .background(if (activeTab == "List") PolarisColors.Navy900 else Color.Transparent)
                    .clickable { activeTab = "List" }
                    .padding(vertical = 8.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "ACTIVE INCIDENTS (${records.size})",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (activeTab == "List") Color.White else PolarisColors.TextMuted
                )
            }

            Box(
                modifier = Modifier
                    .weight(1f)
                    .heightIn(min = PolarisDimens.minTouchTarget)
                    .clip(RoundedCornerShape(PolarisDimens.radiusXs))
                    .background(if (activeTab == "Report") PolarisColors.StatusCritical else Color.Transparent)
                    .clickable { activeTab = "Report" }
                    .padding(vertical = 8.dp),
                contentAlignment = Alignment.Center
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    PolarisIcons.AlertTriangle(
                        size = 14.dp,
                        color = if (activeTab == "Report") Color.White else PolarisColors.StatusCritical
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "+ DECLARE INCIDENT",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (activeTab == "Report") Color.White else PolarisColors.StatusCritical
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(PolarisDimens.space3))

        if (activeTab == "List") {
            PolarisSectionHeader(
                title = "Logged Incidents & Emergency Declarations",
                count = records.size
            )

            if (records.isEmpty()) {
                PolarisEmptyState(
                    title = "No Incidents Declared",
                    description = "Station operations are currently nominal. If a safety, medical, equipment, or environmental emergency occurs, tap '+ DECLARE INCIDENT'.",
                    actionLabel = "Declare Incident",
                    onAction = { activeTab = "Report" },
                    icon = { PolarisIcons.AlertTriangle(size = 40.dp, color = PolarisColors.TextFaint) }
                )
            } else {
                LazyColumn(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(records, key = { it.entityId }) { record ->
                        val incident = RecordParser.parseIncident(record)
                        val tone = when (incident.severity.lowercase()) {
                            "critical" -> PolarisStatusTone.CRITICAL
                            "high" -> PolarisStatusTone.CRITICAL
                            "moderate" -> PolarisStatusTone.WARNING
                            else -> PolarisStatusTone.NOMINAL
                        }

                        val metadata = mutableListOf(
                            "Severity: ${incident.severity.uppercase()}",
                            incident.coordinatesText
                        )
                        if (incident.declaredAt != null) metadata.add("Time: ${incident.declaredAt}")
                        if (incident.syncStatus != null) metadata.add("Sync: ${incident.syncStatus.uppercase()}")

                        PolarisListItem(
                            code = incident.type.uppercase(),
                            title = incident.description,
                            statusText = incident.status,
                            statusTone = tone,
                            subtitle = "Incident ID: ${incident.incidentId.take(8).uppercase()}",
                            metadataList = metadata,
                            onClick = { selectedRecord = record }
                        )
                    }
                    item {
                        Spacer(modifier = Modifier.height(16.dp))
                    }
                }
            }
        } else {
            // Report Incident Form
            Column(
                modifier = Modifier
                    .weight(1f)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                PolarisCard(
                    backgroundColor = PolarisColors.StatusCriticalBg,
                    borderColor = PolarisColors.StatusCriticalBorder
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        PolarisIcons.AlertTriangle(size = 18.dp, color = PolarisColors.StatusCritical)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "EMERGENCY DECLARATION PROTOCOL",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = PolarisColors.StatusCritical,
                            letterSpacing = 0.5.sp
                        )
                    }
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Incident reports write immediately to the local encrypted queue. Once connectivity is established, this alert broadcasts to POLARIS HQ with emergency priority.",
                        fontSize = 12.sp,
                        color = PolarisColors.TextPrimary,
                        lineHeight = 17.sp
                    )
                }

                // Incident Type Picker
                Column {
                    Text(
                        text = "INCIDENT TYPE",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = PolarisColors.TextMuted,
                        letterSpacing = 0.5.sp
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        incidentTypes.forEach { type ->
                            val isSel = incidentType == type
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .clip(RoundedCornerShape(PolarisDimens.radiusXs))
                                    .background(if (isSel) PolarisColors.Navy900 else PolarisColors.PolarSurface)
                                    .clickable { incidentType = type }
                                    .heightIn(min = PolarisDimens.minTouchTarget)
                                    .padding(vertical = 8.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = type.uppercase(),
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (isSel) Color.White else PolarisColors.TextSecondary
                                )
                            }
                        }
                    }
                }

                // Severity Picker
                Column {
                    Text(
                        text = "SEVERITY LEVEL",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = PolarisColors.TextMuted,
                        letterSpacing = 0.5.sp
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        severities.forEach { s ->
                            val isSel = severity == s
                            val selColor = when (s) {
                                "critical" -> PolarisColors.StatusCritical
                                "high" -> Color(0xFFEA580C)
                                "moderate" -> PolarisColors.StatusWarning
                                else -> PolarisColors.StatusNominal
                            }
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .clip(RoundedCornerShape(PolarisDimens.radiusXs))
                                    .background(if (isSel) selColor else PolarisColors.PolarSurface)
                                    .clickable { severity = s }
                                    .heightIn(min = PolarisDimens.minTouchTarget)
                                    .padding(vertical = 8.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = s.uppercase(),
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (isSel) Color.White else PolarisColors.TextSecondary
                                )
                            }
                        }
                    }
                }

                // Geographic Coordinates
                Text(
                    text = "CURRENT COORDINATES (Antarctic Range: -90° to -55°)",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = PolarisColors.TextMuted,
                    letterSpacing = 0.5.sp
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    PolarisTextField(
                        value = latitude,
                        onValueChange = { latitude = it },
                        label = "Latitude (°S, e.g. -70.67)",
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.weight(1f)
                    )
                    PolarisTextField(
                        value = longitude,
                        onValueChange = { longitude = it },
                        label = "Longitude (°E/W, e.g. -8.28)",
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.weight(1f)
                    )
                }

                // Incident Details
                PolarisTextField(
                    value = details,
                    onValueChange = { details = it },
                    label = "Operational Incident Description",
                    placeholder = "Describe personnel involved, equipment status, environmental conditions, and immediate hazards…",
                    singleLine = false,
                    minLines = 4
                )

                if (formError.isNotBlank()) {
                    PolarisErrorBanner(message = formError)
                }

                PolarisDangerButton(
                    text = if (saving) "RECORDING INCIDENT" else "DECLARE INCIDENT",
                    onClick = {
                        formError = ""
                        val lat = latitude.toDoubleOrNull()
                        val lon = longitude.toDoubleOrNull()
                        if (lat == null || lon == null) {
                            formError = "Enter valid decimal coordinates for latitude and longitude."
                            return@PolarisDangerButton
                        }
                        if (lat !in -90.0..-55.0 || lon !in -180.0..180.0) {
                            formError = "Latitude must be between -90.0 and -55.0 (Antarctic sector)."
                            return@PolarisDangerButton
                        }
                        if (details.isBlank()) {
                            formError = "Please describe the incident details."
                            return@PolarisDangerButton
                        }

                        scope.launch {
                            saving = true
                            runCatching {
                                repository.createIncident(
                                    type = incidentType.trim(),
                                    severity = severity.trim(),
                                    description = details.trim(),
                                    latitude = latitude.trim(),
                                    longitude = longitude.trim()
                                )
                            }.onSuccess {
                                details = ""
                                formError = ""
                                onMessage("Incident declared and stored in local queue; sync scheduled.")
                                activeTab = "List"
                            }.onFailure {
                                formError = it.message ?: "Failed to write incident to local queue."
                            }
                            saving = false
                        }
                    },
                    enabled = !saving && details.isNotBlank(),
                    loading = saving,
                )

                Spacer(modifier = Modifier.height(24.dp))
            }
        }
    }

    // Incident Detail Dialog
    selectedRecord?.let { record ->
        val incident = RecordParser.parseIncident(record)
        AlertDialog(
            onDismissRequest = { selectedRecord = null },
            title = {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = incident.type.uppercase(),
                        style = PolarisCodeTypography.codeLarge,
                        fontWeight = FontWeight.Bold,
                        color = PolarisColors.TextPrimary
                    )
                    PolarisStatusChip(text = incident.severity)
                }
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        text = incident.description,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Medium,
                        color = PolarisColors.TextPrimary
                    )
                    HorizontalDivider(color = PolarisColors.LineSubtle)

                    DetailRow("Severity", incident.severity.uppercase())
                    DetailRow("Status", incident.status.uppercase())
                    DetailRow("Coordinates", incident.coordinatesText)
                    if (incident.declaredAt != null) {
                        DetailRow("Declared At", incident.declaredAt)
                    }
                    if (incident.declaredBy != null) {
                        DetailRow("Declared By", incident.declaredBy.take(8).uppercase())
                    }
                    DetailRow("Incident ID", incident.incidentId.take(8).uppercase())
                    DetailRow("Local Version", record.version.toString())
                }
            },
            confirmButton = {
                TextButton(onClick = { selectedRecord = null }) {
                    Text("Close", fontWeight = FontWeight.Bold, color = PolarisColors.PolarBlue)
                }
            },
            shape = RoundedCornerShape(PolarisDimens.radiusLg),
            containerColor = PolarisColors.PolarSurface
        )
    }
}
