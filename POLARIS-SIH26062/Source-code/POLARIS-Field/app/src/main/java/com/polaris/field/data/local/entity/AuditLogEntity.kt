package com.polaris.field.data.local.entity


import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "audit_logs")
data class AuditLogEntity(
    @PrimaryKey val logId: String,
    val entityType: String,
    val entityId: String,
    val action: String,
    val oldValue: String?,
    val newValue: String?,
    val changedBy: String,
    val timestampUtc: String,
    val isRead: Boolean,
    val lastUpdated: Long
)



