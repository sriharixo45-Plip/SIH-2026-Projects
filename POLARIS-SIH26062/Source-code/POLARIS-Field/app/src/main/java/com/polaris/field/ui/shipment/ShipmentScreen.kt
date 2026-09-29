package com.polaris.field.ui.shipment

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.polaris.field.ui.common.OperationalCard
import com.polaris.field.ui.common.StatusChip
import com.polaris.field.ui.common.SyntheticDataBanner
import com.polaris.field.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ShipmentScreen(
    shipmentCode: String = "BRH-RES-03",
    origin: String = "Cape Town Port (South Africa)",
    destination: String = "Bharati Station (Antarctica)",
    transportResource: String = "S.A. Agulhas II (Icebreaker Vessel)",
    eta: String = "20 OCT 2026",
    status: String = "CONFIRMED",
    totalItems: Int = 157,
    onBackClick: () -> Unit = {}
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("TRANSPORT LEG: $shipmentCode", fontWeight = FontWeight.Bold, color = TextPrimaryCharcoal) },
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
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("TRANSPORT LEG DETAILS", style = MaterialTheme.typography.labelSmall, color = TextSecondaryMuted)
                        StatusChip(status = status)
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(origin, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = TextPrimaryCharcoal)
                    Text("↓", style = MaterialTheme.typography.titleMedium, color = PolarBlueAccent)
                    Text(destination, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = TextPrimaryCharcoal)

                    Spacer(modifier = Modifier.height(12.dp))
                    HorizontalDivider(color = EnterpriseBorder)
                    Spacer(modifier = Modifier.height(12.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column {
                            Text("Vessel / Mode", style = MaterialTheme.typography.labelSmall, color = TextSecondaryMuted)
                            Text(transportResource, style = MaterialTheme.typography.bodyMedium, color = TextPrimaryCharcoal, fontWeight = FontWeight.Bold)
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text("ETA Date", style = MaterialTheme.typography.labelSmall, color = TextSecondaryMuted)
                            Text(eta, style = MaterialTheme.typography.bodyMedium, color = PolarBlueAccent, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            item {
                Text("CARGO MANIFEST CATEGORIES ($totalItems ITEMS)", style = MaterialTheme.typography.labelSmall, color = TextSecondaryMuted, fontWeight = FontWeight.Bold)
            }

            item {
                val categories = listOf(
                    Triple("Medical Supplies & Emergency Kits", "45 Kits", "IN TRANSIT"),
                    Triple("Technical Generator Parts", "28 Items", "IN TRANSIT"),
                    Triple("Arctic Grade Fuel Cells", "50 Drums", "IN TRANSIT"),
                    Triple("Scientific Research Instruments", "14 Units", "IN TRANSIT"),
                    Triple("Freeze-Dried Food Rations", "20 Pallets", "DELIVERED")
                )

                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    categories.forEach { (name, count, catStatus) ->
                        OperationalCard {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column {
                                    Text(name, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold, color = TextPrimaryCharcoal)
                                    Text(count, style = MaterialTheme.typography.bodySmall, color = TextSecondaryMuted)
                                }
                                StatusChip(status = catStatus)
                            }
                        }
                    }
                }
            }
        }
    }
}
