package com.polaris.field.data.repository

import com.polaris.field.data.local.dao.AuditLogDao
import com.polaris.field.data.local.entity.AuditLogEntity
import com.polaris.field.data.remote.api.PolarisApiService
import kotlinx.coroutines.flow.Flow

class UpdatesRepository(
    private val apiService: PolarisApiService,
    private val auditLogDao: AuditLogDao
) {
    val auditLogsFlow: Flow<List<AuditLogEntity>> = auditLogDao.getAllLogsFlow()

    suspend fun refreshAuditLogs(): Result<Unit> {
        return try {
            val response = apiService.getAuditLogs()
            if (response.isSuccessful && response.body() != null) {
                val logs = response.body()!!.map { dto ->
                    AuditLogEntity(
                        logId = dto.log_id,
                        entityType = dto.entity_type,
                        entityId = dto.entity_id,
                        action = dto.action,
                        oldValue = dto.old_value?.toString(),
                        newValue = dto.new_value?.toString(),
                        changedBy = dto.actor ?: "HQ Logistics Officer",
                        timestampUtc = dto.timestamp_utc,
                        isRead = false,
                        lastUpdated = System.currentTimeMillis()
                    )
                }
                auditLogDao.insertLogs(logs)
                Result.success(Unit)
            } else {
                Result.failure(Exception("Failed to fetch audit logs from API"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun markAllAsRead() {
        auditLogDao.markAllAsRead()
    }
}
