package com.polaris.field.data.local.dao


import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.polaris.field.data.local.entity.InventoryStockEntity
import com.polaris.field.data.local.entity.InventoryTransactionEntity
import kotlinx.coroutines.flow.Flow


@Dao
interface InventoryDao {
    @Query("SELECT * FROM inventory_stocks ORDER BY itemName ASC")
    fun getAllStocksFlow(): Flow<List<InventoryStockEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertStocks(stocks: List<InventoryStockEntity>)

    @Query("SELECT * FROM inventory_stocks WHERE stockId = :stockId LIMIT 1")
    suspend fun getStock(stockId: String): InventoryStockEntity?

    @Query("UPDATE inventory_stocks SET quantity = :quantity, lastUpdated = :timestamp WHERE stockId = :stockId")
    suspend fun updateQuantity(stockId: String, quantity: Double, timestamp: Long)

    @Query("DELETE FROM inventory_stocks WHERE stockId = :stockId")
    suspend fun deleteStock(stockId: String)

    @Query("DELETE FROM inventory_stocks")
    suspend fun deleteAllStocks()

    @Query("DELETE FROM inventory_transactions")
    suspend fun deleteAllTransactions()

    @Query("SELECT * FROM inventory_transactions ORDER BY timestampUtc DESC")
    fun getAllTransactionsFlow(): Flow<List<InventoryTransactionEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTransactions(transactions: List<InventoryTransactionEntity>)
}






