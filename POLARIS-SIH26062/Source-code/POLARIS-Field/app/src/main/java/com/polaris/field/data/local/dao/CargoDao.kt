package com.polaris.field.data.local.dao


import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.polaris.field.data.local.entity.CargoItemEntity
import com.polaris.field.data.local.entity.CargoMovementEventEntity
import kotlinx.coroutines.flow.Flow


@Dao
interface CargoDao {
    @Query("SELECT * FROM cargo_items ORDER BY description ASC")
    fun getAllCargoFlow(): Flow<List<CargoItemEntity>>

    @Query("SELECT * FROM cargo_items WHERE legId = :legId")
    fun getCargoByLegFlow(legId: String): Flow<List<CargoItemEntity>>

    @Query("SELECT * FROM cargo_items WHERE cargoId = :cargoId OR trackingCode = :trackingCode LIMIT 1")
    suspend fun getCargoByIdOrBarcode(cargoId: String, trackingCode: String): CargoItemEntity?

    @Query("SELECT * FROM cargo_items WHERE lower(cargoId) = lower(:cargoId) OR lower(trackingCode) = lower(:trackingCode) LIMIT 1")
    suspend fun findDuplicate(cargoId: String, trackingCode: String): CargoItemEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertCargoItems(items: List<CargoItemEntity>)

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertCargo(item: CargoItemEntity)

    @Query("UPDATE cargo_items SET status = :status, lastUpdated = :timestamp WHERE cargoId = :cargoId")
    suspend fun updateCargoStatus(cargoId: String, status: String, timestamp: Long)

    @Query("DELETE FROM cargo_items WHERE cargoId = :cargoId")
    suspend fun deleteCargo(cargoId: String)

    @Query("DELETE FROM cargo_items")
    suspend fun deleteAllCargo()

    @Query("DELETE FROM cargo_movement_events")
    suspend fun deleteAllMovementEvents()

    @Query("SELECT * FROM cargo_movement_events WHERE cargoId = :cargoId ORDER BY timestampUtc DESC")
    fun getMovementEventsFlow(cargoId: String): Flow<List<CargoMovementEventEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertMovementEvents(events: List<CargoMovementEventEntity>)
}






