package com.polaris.field.data.repository

import com.polaris.field.data.local.dao.InventoryDao
import com.polaris.field.data.local.entity.InventoryStockEntity
import com.polaris.field.data.local.entity.InventoryTransactionEntity
import com.polaris.field.data.remote.api.PolarisApiService
import kotlinx.coroutines.flow.Flow
import com.polaris.field.sync.SyncManager
import java.util.UUID

class InventoryRepository(
    private val apiService: PolarisApiService,
    private val inventoryDao: InventoryDao,
    private val syncManager: SyncManager
) {
    val stocksFlow: Flow<List<InventoryStockEntity>> = inventoryDao.getAllStocksFlow()
    val transactionsFlow: Flow<List<InventoryTransactionEntity>> = inventoryDao.getAllTransactionsFlow()

    suspend fun recordTransaction(stockId: String, type: String, quantity: Double, reason: String, actor: String): Result<Unit> {
        val stock = inventoryDao.getStock(stockId) ?: return Result.failure(IllegalArgumentException("Inventory stock was not found locally."))
        if (quantity <= 0.0) return Result.failure(IllegalArgumentException("Quantity must be greater than zero."))
        val kind = when (type.lowercase()) {
            "consume", "consumption" -> "consumption"
            "receipt" -> "receipt"
            "damage" -> "damage"
            "loss" -> "loss"
            "return" -> "return"
            else -> "adjustment"
        }
        val signed = if (kind in listOf("receipt", "return", "adjustment")) quantity else -quantity
        val updated = stock.quantity + signed
        if (updated < 0.0) return Result.failure(IllegalArgumentException("Inventory quantity cannot go negative."))
        val now = System.currentTimeMillis()
        val txId = UUID.randomUUID().toString()
        val payload = mapOf("transaction_id" to txId, "stock_id" to stockId, "transaction_type" to kind, "quantity_delta" to quantity, "actor" to actor, "reason" to reason)
        return try {
            syncManager.enqueueOperation("inventory_stock", stockId, "update", payload, actor, stock.syncVersion) {
                inventoryDao.updateQuantity(stockId, updated, now)
                inventoryDao.insertTransactions(listOf(InventoryTransactionEntity(txId, stockId, kind, signed, now.toString(), actor, reason, now)))
            }
            Result.success(Unit)
        } catch (e: Exception) { Result.failure(e) }
    }

    suspend fun refreshStocks(): Result<Unit> {
        return try {
            val response = apiService.getInventoryStocks()
            val body = response.body()
            if (response.isSuccessful && body != null) {
                val list = body.map { item ->
                    InventoryStockEntity(
                        stockId = item["stock_id"] as? String ?: "",
                        stationId = item["station_id"] as? String ?: "",
                        itemCatalogId = item["item_catalog_id"] as? String ?: "",
                        itemName = item["item_name"] as? String ?: "Inventory Item",
                        quantity = (item["quantity"] as? Number)?.toDouble() ?: 0.0,
                        reorderThreshold = (item["reorder_threshold"] as? Number)?.toDouble() ?: 0.0,
                        unit = item["unit"] as? String ?: "Units",
                        syncVersion = (item["sync_version"] as? Number)?.toInt() ?: 0,
                        lastUpdated = System.currentTimeMillis()
                    )
                }
                inventoryDao.insertStocks(list)
                Result.success(Unit)
            } else {
                Result.failure(Exception("Failed to fetch inventory stocks"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
