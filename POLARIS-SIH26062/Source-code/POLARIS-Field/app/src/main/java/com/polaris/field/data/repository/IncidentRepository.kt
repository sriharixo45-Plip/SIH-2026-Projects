package com.polaris.field.data.repository

import com.polaris.field.data.local.dao.IncidentDao
import com.polaris.field.data.local.entity.IncidentEntity
import com.polaris.field.data.remote.api.PolarisApiService
import kotlinx.coroutines.flow.Flow
import com.polaris.field.sync.SyncManager
import java.util.UUID

class IncidentRepository(
    private val apiService: PolarisApiService,
    private val incidentDao: IncidentDao,
    private val syncManager: SyncManager
) {
    val incidentsFlow: Flow<List<IncidentEntity>> = incidentDao.getAllIncidentsFlow()

    suspend fun createIncident(type: String, severity: String, description: String, declaredBy: String, stationId: String?): Result<Unit> {
        val incidentId = UUID.randomUUID().toString()
        val now = System.currentTimeMillis()
        val incident = IncidentEntity(
            incidentId = incidentId,
            stationId = stationId,
            legId = null,
            type = type,
            declaredAt = now.toString(),
            declaredBy = declaredBy,
            severity = severity,
            status = "declared",
            description = description,
            syncVersion = 0,
            lastUpdated = now
        )
        return try {
            val body = mapOf(
                "incident_id" to incidentId,
                "station_id" to stationId,
                "type" to type,
                "severity" to severity,
                "declared_by" to declaredBy,
                "description" to description
            )
            syncManager.enqueueOperation("incident", incidentId, "create", body, declaredBy, 0) {
                incidentDao.insertIncidents(listOf(incident))
            }
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
