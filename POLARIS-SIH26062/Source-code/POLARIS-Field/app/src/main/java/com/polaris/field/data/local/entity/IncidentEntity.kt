package com.polaris.field.data.local.entity


import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "incidents")
data class IncidentEntity(
    @PrimaryKey val incidentId: String,
    val stationId: String?,
    val legId: String?,
    val type: String,
    val declaredAt: String,
    val declaredBy: String,
    val severity: String,
    val status: String,
    val description: String?,
    val syncVersion: Int,
    val lastUpdated: Long
)

@Entity(tableName = "incident_events")
data class IncidentEventEntity(
    @PrimaryKey val eventId: String,
    val incidentId: String,
    val eventType: String,
    val timestampUtc: String,
    val actor: String,
    val notes: String?,
    val lastUpdated: Long
)



