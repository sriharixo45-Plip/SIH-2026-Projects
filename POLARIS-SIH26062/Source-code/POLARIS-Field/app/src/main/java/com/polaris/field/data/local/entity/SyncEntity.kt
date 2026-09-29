package com.polaris.field.data.local.entity


import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "sync_operations")
data class SyncOperationEntity(
    @PrimaryKey val opId: String,
    val deviceId: String,
    val performedBy: String,
    val localSequenceNumber: Int,
    val targetEntityType: String,
    val targetEntityId: String,
    val operationType: String,
    val payloadJson: String,
    val baseVersion: Int?,
    val status: String, // PENDING, SYNCED, FAILED, CONFLICT
    val timestamp: Long,
    val retryCount: Int = 0,
    val errorMessage: String? = null,
    val httpStatus: Int? = null
)

@Entity(tableName = "sync_conflicts")
data class SyncConflictEntity(
    @PrimaryKey val conflictId: String,
    val entityType: String,
    val entityId: String,
    val localValueJson: String,
    val serverValueJson: String,
    val fieldName: String,
    val resolution: String?, // KEEP_LOCAL, KEEP_SERVER, HQ_REVIEW
    val resolvedBy: String?,
    val resolvedAt: Long?
)



