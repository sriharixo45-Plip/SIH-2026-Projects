package com.polaris.field.data.local.entity


import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "inventory_stocks")
data class InventoryStockEntity(
    @PrimaryKey val stockId: String,
    val stationId: String,
    val itemCatalogId: String,
    val itemName: String,
    val quantity: Double,
    val reorderThreshold: Double,
    val unit: String,
    val syncVersion: Int = 0,
    val lastUpdated: Long
)

@Entity(tableName = "inventory_transactions")
data class InventoryTransactionEntity(
    @PrimaryKey val transactionId: String,
    val stockId: String,
    val transactionType: String,
    val quantityDelta: Double,
    val timestampUtc: String,
    val actor: String,
    val reason: String?,
    val lastUpdated: Long
)



