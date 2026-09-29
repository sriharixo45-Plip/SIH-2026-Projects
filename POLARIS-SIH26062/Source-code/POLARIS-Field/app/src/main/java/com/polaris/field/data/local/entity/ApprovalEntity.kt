package com.polaris.field.data.local.entity


import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "approvals")
data class ApprovalEntity(
    @PrimaryKey val approvalId: String,
    val entityType: String,
    val entityId: String,
    val requestedBy: String,
    val decidedBy: String?,
    val decision: String,
    val decidedAt: String?,
    val reason: String?,
    val syncVersion: Int = 0,
    val lastUpdated: Long
)



