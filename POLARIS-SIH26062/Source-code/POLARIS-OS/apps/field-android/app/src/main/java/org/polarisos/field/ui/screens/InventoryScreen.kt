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
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import org.polarisos.field.data.CachedRecord
import org.polarisos.field.data.FieldRepository
import org.polarisos.field.ui.components.PolarisConfirmationDialog
import org.polarisos.field.ui.components.PolarisEmptyState
import org.polarisos.field.ui.components.PolarisIcons
import org.polarisos.field.ui.components.PolarisListItem
import org.polarisos.field.ui.components.PolarisMetricCard
import org.polarisos.field.ui.components.PolarisSectionHeader
import org.polarisos.field.ui.components.PolarisStatusChip
import org.polarisos.field.ui.components.PolarisStatusTone
import org.polarisos.field.ui.components.PolarisTextField
import org.polarisos.field.ui.theme.PolarisCodeTypography
import org.polarisos.field.ui.theme.PolarisColors
import org.polarisos.field.ui.theme.PolarisDimens
import org.polarisos.field.util.RecordParser

@Composable
fun InventoryScreen(
    repository: FieldRepository,
    onMessage: (String) -> Unit
) {
    val records by repository.observeRecords("inventory_stock").collectAsState(initial = emptyList())
    val scope = rememberCoroutineScope()

    var searchQuery by remember { mutableStateOf("") }
    var filterLowStockOnly by remember { mutableStateOf(false) }
    var selectedRecord by remember { mutableStateOf<CachedRecord?>(null) }
    var confirmConsumeRecord by remember { mutableStateOf<CachedRecord?>(null) }

    val lowStockCount = remember(records) {
        records.count { RecordParser.parseInventory(it).isLowStock }
    }

    val filteredRecords = remember(records, searchQuery, filterLowStockOnly) {
        records.filter { record ->
            val parsed = RecordParser.parseInventory(record)
            val matchesQuery = searchQuery.isBlank() ||
                    parsed.code.contains(searchQuery, ignoreCase = true) ||
                    parsed.name.contains(searchQuery, ignoreCase = true)

            val matchesFilter = !filterLowStockOnly || parsed.isLowStock
            matchesQuery && matchesFilter
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(PolarisColors.PolarBg)
            .padding(horizontal = PolarisDimens.space4)
    ) {
        Spacer(modifier = Modifier.height(PolarisDimens.space2))

        // Search Bar
        PolarisTextField(
            value = searchQuery,
            onValueChange = { searchQuery = it },
            label = "Search Station Inventory",
            placeholder = "Filter by stock code, catalog SKU, or item description…",
            leadingIcon = {
                Text("🔍", fontSize = 14.sp)
            },
            trailingIcon = if (searchQuery.isNotBlank()) {
                {
                    Text(
                        text = "CLEAR",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = PolarisColors.PolarBlue,
                        modifier = Modifier
                            .clickable { searchQuery = "" }
                            .padding(end = 8.dp)
                    )
                }
            } else null
        )

        Spacer(modifier = Modifier.height(PolarisDimens.space2))

        // Inventory Stock Summary Row
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            PolarisMetricCard(
                label = "Total Items",
                value = records.size.toString(),
                subtext = "Catalog entries",
                modifier = Modifier.weight(1f)
            )
            PolarisMetricCard(
                label = "Low Stock Alerts",
                value = lowStockCount.toString(),
                subtext = if (lowStockCount > 0) "Below threshold" else "All nominal",
                valueColor = if (lowStockCount > 0) PolarisColors.StatusCritical else PolarisColors.TextPrimary,
                modifier = Modifier.weight(1f),
                onClick = { filterLowStockOnly = !filterLowStockOnly }
            )
        }

        Spacer(modifier = Modifier.height(PolarisDimens.space2))

        // Filter Toggle Chips
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(PolarisDimens.radiusPill))
                    .background(if (!filterLowStockOnly) PolarisColors.PolarBlue else PolarisColors.PolarSurface)
                    .clickable { filterLowStockOnly = false }
                    .heightIn(min = PolarisDimens.minTouchTarget)
                    .padding(horizontal = 12.dp, vertical = 6.dp)
            ) {
                Text(
                    text = "ALL INVENTORY (${records.size})",
                    color = if (!filterLowStockOnly) Color.White else PolarisColors.TextSecondary,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold
                )
            }

            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(PolarisDimens.radiusPill))
                    .background(if (filterLowStockOnly) PolarisColors.StatusCritical else PolarisColors.PolarSurface)
                    .clickable { filterLowStockOnly = true }
                    .heightIn(min = PolarisDimens.minTouchTarget)
                    .padding(horizontal = 12.dp, vertical = 6.dp)
            ) {
                Text(
                    text = "CRITICAL / LOW STOCK ($lowStockCount)",
                    color = if (filterLowStockOnly) Color.White else PolarisColors.StatusCritical,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }

        Spacer(modifier = Modifier.height(PolarisDimens.space3))

        PolarisSectionHeader(
            title = if (filterLowStockOnly) "Critical & Low Stock Items" else "Station Inventory Stock",
            count = filteredRecords.size
        )

        if (filteredRecords.isEmpty()) {
            PolarisEmptyState(
                title = if (records.isEmpty()) "No Cached Inventory" else "No Matching Stock Items",
                description = if (records.isEmpty())
                    "Connect and synchronize with POLARIS HQ to load station storage and inventory levels."
                else "No stock records match the current filter criteria.",
                icon = { PolarisIcons.InventoryGrid(size = 40.dp, color = PolarisColors.TextFaint) }
            )
        } else {
            LazyColumn(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(filteredRecords, key = { it.entityId }) { record ->
                    val stock = RecordParser.parseInventory(record)
                    val statusText = if (stock.isLowStock) "LOW STOCK" else "NOMINAL"
                    val statusTone = if (stock.isLowStock) PolarisStatusTone.CRITICAL else PolarisStatusTone.NOMINAL

                    val metadata = mutableListOf(
                        "Available: ${stock.quantity} ${stock.unit}",
                        "Threshold: ${stock.reorderThreshold} ${stock.unit}"
                    )
                    if (stock.syncStatus != null) metadata.add("Sync: ${stock.syncStatus.uppercase()}")

                    PolarisListItem(
                        code = stock.code,
                        title = stock.name,
                        statusText = statusText,
                        statusTone = statusTone,
                        subtitle = "Stock ID: ${stock.stockId.take(8).uppercase()}",
                        metadataList = metadata,
                        actionLabel = "Record Consumption (-1)",
                        onActionClick = { confirmConsumeRecord = record },
                        onClick = { selectedRecord = record }
                    )
                }
                item {
                    Spacer(modifier = Modifier.height(16.dp))
                }
            }
        }
    }

    // Detail Dialog
    selectedRecord?.let { record ->
        val stock = RecordParser.parseInventory(record)
        AlertDialog(
            onDismissRequest = { selectedRecord = null },
            title = {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = stock.code,
                        style = PolarisCodeTypography.codeLarge,
                        fontWeight = FontWeight.Bold,
                        color = PolarisColors.TextPrimary
                    )
                    PolarisStatusChip(
                        text = if (stock.isLowStock) "LOW STOCK" else "NOMINAL",
                        tone = if (stock.isLowStock) PolarisStatusTone.CRITICAL else PolarisStatusTone.NOMINAL
                    )
                }
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        text = stock.name,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PolarisColors.TextPrimary
                    )
                    HorizontalDivider(color = PolarisColors.LineSubtle)

                    DetailRow("Current Quantity", "${stock.quantity} ${stock.unit}")
                    DetailRow("Reorder Threshold", "${stock.reorderThreshold} ${stock.unit}")
                    DetailRow("Safety Stock Min", "${stock.safetyStockMinimum} ${stock.unit}")
                    DetailRow("Item Catalog ID", stock.itemCatalogId.take(8).uppercase())
                    DetailRow("Local Version", record.version.toString())
                    if (record.changedAt != null) {
                        DetailRow("Last Updated", record.changedAt)
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    val toConsume = record
                    selectedRecord = null
                    confirmConsumeRecord = toConsume
                }) {
                    Text("Record Consumption (-1)", fontWeight = FontWeight.Bold, color = PolarisColors.PolarBlue)
                }
            },
            dismissButton = {
                TextButton(onClick = { selectedRecord = null }) {
                    Text("Close", color = PolarisColors.TextMuted)
                }
            },
            shape = RoundedCornerShape(PolarisDimens.radiusLg),
            containerColor = PolarisColors.PolarSurface
        )
    }

    // Consume Confirmation
    confirmConsumeRecord?.let { record ->
        val stock = RecordParser.parseInventory(record)
        PolarisConfirmationDialog(
            title = "Record Field Consumption",
            message = "Deduct 1 ${stock.unit} from ${stock.name} (${stock.code})? This will update local quantity and queue a consumption transaction to synchronize when online.",
            confirmLabel = "Record Consumption",
            onConfirm = {
                confirmConsumeRecord = null
                scope.launch {
                    runCatching { repository.advance(record) }
                        .onSuccess { onMessage("Recorded 1 ${stock.unit} consumption for ${stock.name} locally.") }
                        .onFailure { onMessage(it.message ?: "Could not record inventory consumption.") }
                }
            },
            onDismiss = { confirmConsumeRecord = null }
        )
    }
}
