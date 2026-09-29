package com.polaris.field.data.repository

import com.polaris.field.data.local.dao.CargoDao
import com.polaris.field.data.local.entity.CargoItemEntity
import com.polaris.field.data.local.entity.CargoMovementEventEntity
import com.polaris.field.data.remote.api.PolarisApiService
import com.polaris.field.data.remote.dto.CargoItemDto
import com.polaris.field.sync.SyncManager
import java.util.UUID
import java.util.Locale
import kotlinx.coroutines.flow.Flow

class CargoRepository(
    private val apiService: PolarisApiService,
    private val cargoDao: CargoDao,
    private val syncManager: SyncManager
) {
    val allCargoFlow: Flow<List<CargoItemEntity>> = cargoDao.getAllCargoFlow()

    suspend fun getCargoByBarcode(barcode: String): CargoItemEntity? {
        return cargoDao.getCargoByIdOrBarcode(barcode, barcode)
    }

    suspend fun createCargo(
        trackingCode: String,
        description: String,
        category: String,
        weight: Double,
        volume: Double,
        hazardClass: Int?,
        isReturnCargo: Boolean,
        legId: String,
        performedBy: String
    ): Result<CargoItemEntity> {
        val code = trackingCode.trim().uppercase(Locale.ROOT)
        val desc = description.trim()
        val kind = category.trim()
        if (!code.matches(Regex("[A-Z0-9][A-Z0-9_-]{2,39}"))) return Result.failure(IllegalArgumentException("Enter a valid tracking code (3–40 letters, numbers, hyphens or underscores)."))
        if (desc.isBlank()) return Result.failure(IllegalArgumentException("Description is required."))
        if (kind.isBlank()) return Result.failure(IllegalArgumentException("Category is required."))
        if (!weight.isFinite() || weight <= 0.0) return Result.failure(IllegalArgumentException("Weight must be greater than zero."))
        if (!volume.isFinite() || volume <= 0.0) return Result.failure(IllegalArgumentException("Volume must be greater than zero."))
        if (legId.isBlank()) return Result.failure(IllegalArgumentException("Select a valid transport leg."))
        if (hazardClass != null && hazardClass !in 1..9) return Result.failure(IllegalArgumentException("Hazard class must be between 1 and 9."))
        if (cargoDao.findDuplicate(code, code) != null) return Result.failure(IllegalArgumentException("This cargo ID or tracking code already exists."))

        val now = System.currentTimeMillis()
        val item = CargoItemEntity(UUID.randomUUID().toString(), code, legId, desc, kind, weight, volume, hazardClass, isReturnCargo, "PENDING", 0, now)
        val payload = mapOf(
            "cargo_id" to item.cargoId,
            "tracking_code" to item.trackingCode,
            "leg_id" to item.legId,
            "description" to item.description,
            "category" to item.category,
            "weight" to item.weight,
            "volume" to item.volume,
            "hazard_class" to item.hazardClass,
            "is_return_cargo" to item.isReturnCargo,
            "status" to "packed",
            "sync_version" to item.syncVersion
        )
        return try {
            syncManager.enqueueOperation("cargo_item", item.cargoId, "create", payload, performedBy, 0) {
                if (cargoDao.findDuplicate(code, code) != null) throw IllegalArgumentException("This cargo ID or tracking code already exists.")
                cargoDao.insertCargo(item)
            }
            Result.success(item)
        } catch (e: Exception) { Result.failure(e) }
    }

    suspend fun findCargoByBarcodeOnline(barcode: String): CargoItemEntity? {
        return try {
            val response = apiService.getCargoItems()
            if (!response.isSuccessful) return null

            val item = response.body()?.firstOrNull {
                it.tracking_code.equals(barcode, ignoreCase = true) ||
                        it.cargo_id.equals(barcode, ignoreCase = true)
            } ?: return null
            item.toEntity().also { cargoDao.insertCargoItems(listOf(it)) }
        } catch (_: Exception) {
            null
        }
    }

    suspend fun updateCargoStatus(cargoId: String, newStatus: String, actorId: String, reason: String? = null): Result<Unit> {
        val timestamp = System.currentTimeMillis()
        val cargo = cargoDao.getCargoByIdOrBarcode(cargoId, cargoId)
            ?: return Result.failure(IllegalArgumentException("Cargo was not found locally."))
        val payload = mapOf("status" to newStatus, "actor" to actorId, "reason" to reason)
        syncManager.enqueueOperation("cargo_item", cargoId, "status_change", payload, actorId, cargo.syncVersion) {
            cargoDao.updateCargoStatus(cargoId, newStatus, timestamp)
            cargoDao.insertMovementEvents(listOf(CargoMovementEventEntity(UUID.randomUUID().toString(), cargoId, cargo.legId, null, newStatus, timestamp.toString(), actorId, reason, timestamp)))
        }
        return Result.success(Unit)
    }

    suspend fun refreshCargo(): Result<Unit> {
        return try {
            val response = apiService.getCargoItems()
            if (response.isSuccessful && response.body() != null) {
                val items = response.body()!!.map(CargoItemDto::toEntity)
                cargoDao.insertCargoItems(items)
                Result.success(Unit)
            } else {
                Result.failure(Exception("Failed to fetch cargo items from API"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}

private fun CargoItemDto.toEntity() = CargoItemEntity(
    cargoId = cargo_id,
    trackingCode = tracking_code,
    legId = leg_id,
    description = description,
    category = category,
    weight = weight,
    volume = volume,
    hazardClass = hazard_class,
    isReturnCargo = is_return_cargo,
    status = status,
    syncVersion = sync_version,
    lastUpdated = System.currentTimeMillis()
)
