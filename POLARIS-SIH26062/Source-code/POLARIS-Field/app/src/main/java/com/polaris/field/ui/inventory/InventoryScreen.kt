package com.polaris.field.ui.inventory

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.polaris.field.data.local.entity.InventoryStockEntity
import com.polaris.field.ui.common.OperationalCard
import com.polaris.field.ui.common.StatusChip
import com.polaris.field.ui.common.SyntheticDataBanner
import com.polaris.field.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InventoryScreen(
    stocks: List<InventoryStockEntity> = emptyList(),
    onRecordTransactionClick: (String, String, Double, String) -> Unit = { _, _, _, _ -> },
    onSyncClick: () -> Unit = {}
) {
    var showTransactionDialog by remember { mutableStateOf(false) }
    var selectedStock by remember { mutableStateOf<InventoryStockEntity?>(null) }
    var txType by remember { mutableStateOf("Consume") }
    var txQuantity by remember { mutableStateOf("1") }
    var txReason by remember { mutableStateOf("") }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("STATION INVENTORY", fontWeight = FontWeight.Bold, color = TextPrimaryCharcoal) },
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

            if (stocks.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    OperationalCard {
                        Text("NO INVENTORY RECORDS", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Spacer(Modifier.height(6.dp))
                        Text("Inventory data has not been synchronized for this station.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Spacer(Modifier.height(12.dp))
                        Button(onClick = onSyncClick, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) { Text("SYNC") }
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(stocks) { stock ->
                        val status = when {
                            stock.quantity <= 0 -> "OUT OF STOCK"
                            stock.quantity <= stock.reorderThreshold / 2 -> "CRITICAL"
                            stock.quantity <= stock.reorderThreshold -> "LOW STOCK"
                            else -> "NORMAL"
                        }
                        OperationalCard {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = stock.itemName,
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = TextPrimaryCharcoal
                                )
                                StatusChip(status = status)
                            }
                            Spacer(modifier = Modifier.height(6.dp))
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column {
                                    Text("Available Quantity", style = MaterialTheme.typography.labelSmall, color = TextSecondaryMuted)
                                    Text(
                                        text = "${stock.quantity} ${stock.unit}",
                                        style = MaterialTheme.typography.titleSmall,
                                        fontWeight = FontWeight.Bold,
                                        color = if (stock.quantity <= stock.reorderThreshold) SemanticAmber else PolarBlueAccent
                                    )
                                }
                                Column(horizontalAlignment = Alignment.End) {
                                    Text("Safety Stock Threshold", style = MaterialTheme.typography.labelSmall, color = TextSecondaryMuted)
                                    Text(
                                        text = "${stock.reorderThreshold} ${stock.unit}",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = TextSecondaryMuted
                                    )
                                }
                            }
                            Spacer(modifier = Modifier.height(10.dp))
                            OutlinedButton(
                                onClick = {
                                    selectedStock = stock
                                    showTransactionDialog = true
                                },
                                modifier = Modifier.fillMaxWidth().height(36.dp),
                                shape = RoundedCornerShape(6.dp),
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = PolarBlueAccent)
                            ) {
                                Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("RECORD TRANSACTION", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }

        // Transaction Record Dialog
        if (showTransactionDialog && selectedStock != null) {
            AlertDialog(
                onDismissRequest = { showTransactionDialog = false },
                confirmButton = {
                    Button(
                        onClick = {
                            val qty = txQuantity.toDoubleOrNull() ?: 1.0
                            onRecordTransactionClick(selectedStock!!.stockId, txType, qty, txReason)
                            showTransactionDialog = false
                            txReason = ""
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = PolarBlueAccent)
                    ) {
                        Text("RECORD TO DATABASE", fontWeight = FontWeight.Bold)
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showTransactionDialog = false }) {
                        Text("CANCEL", color = TextSecondaryMuted)
                    }
                },
                title = {
                    Text("RECORD STOCK TRANSACTION", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text("Item: ${selectedStock?.itemName}", fontWeight = FontWeight.Bold, color = TextPrimaryCharcoal)
                        Text("Current Balance: ${selectedStock?.quantity} ${selectedStock?.unit}", style = MaterialTheme.typography.bodySmall)

                        OutlinedTextField(
                            value = txQuantity,
                            onValueChange = { txQuantity = it },
                            label = { Text("Quantity Delta") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true
                        )

                        OutlinedTextField(
                            value = txReason,
                            onValueChange = { txReason = it },
                            label = { Text("Log Reason / Note") },
                            placeholder = { Text("e.g. Consumed for Generator 2 maintenance") },
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                },
                containerColor = EnterpriseSurface
            )
        }
    }
}
