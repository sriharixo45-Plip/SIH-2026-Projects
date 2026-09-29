package com.polaris.field.data.local.entity


import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "personnel")
data class PersonnelEntity(
    @PrimaryKey val personId: String,
    val userId: String?,
    val employeeCode: String?,
    val name: String,
    val roleOnExpedition: String,
    val fitnessStatus: String,
    val assignedStationId: String?,
    val isSyntheticDemo: Boolean,
    val lastUpdated: Long
)

@Entity(tableName = "personnel_assignments")
data class PersonnelAssignmentEntity(
    @PrimaryKey val assignmentId: String,
    val personnelId: String,
    val expeditionId: String,
    val stationId: String?,
    val legId: String?,
    val seatBerthRef: String?,
    val status: String,
    val startDate: String,
    val endDate: String?,
    val syncVersion: Int,
    val lastUpdated: Long
)



