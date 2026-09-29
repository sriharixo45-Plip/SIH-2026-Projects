package com.polaris.field.data.repository

import com.polaris.field.data.local.dao.TransportLegDao
import com.polaris.field.data.local.entity.TransportLegEntity
import com.polaris.field.data.remote.api.PolarisApiService
import kotlinx.coroutines.flow.Flow

class ShipmentRepository(
    private val apiService: PolarisApiService,
    private val transportLegDao: TransportLegDao
) {
    val transportLegsFlow: Flow<List<TransportLegEntity>> = transportLegDao.getAllLegsFlow()

    suspend fun refreshLegs(): Result<Unit> {
        return try {
            val response = apiService.getTransportLegs()
            if (response.isSuccessful && response.body() != null) {
                val legs = response.body()!!.map { item ->
                    TransportLegEntity(
                        legId = item["leg_id"] as? String ?: "",
                        code = item["code"] as? String ?: "",
                        expeditionId = item["expedition_id"] as? String ?: "",
                        transportResourceId = item["transport_resource_id"] as? String ?: "",
                        mode = item["mode"] as? String ?: "",
                        origin = item["origin"] as? String ?: "",
                        destination = item["destination"] as? String ?: "",
                        plannedDeparture = item["planned_departure"] as? String ?: "",
                        plannedArrival = item["planned_arrival"] as? String ?: "",
                        status = item["status"] as? String ?: "planned",
                        syncVersion = (item["sync_version"] as? Number)?.toInt() ?: 0,
                        lastUpdated = System.currentTimeMillis()
                    )
                }
                transportLegDao.insertLegs(legs)
                Result.success(Unit)
            } else {
                Result.failure(Exception("Failed to fetch transport legs"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
