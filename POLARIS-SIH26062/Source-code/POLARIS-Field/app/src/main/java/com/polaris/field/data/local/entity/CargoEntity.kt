package com.polaris.field.data.local.entity


import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "cargo_items")
data class CargoItemEntity(
    @PrimaryKey val cargoId: String,
    val trackingCode: String,
    val legId: String,
    val description: String,
    val category: String,
    val weight: Double,
    val volume: Double,
    val hazardClass: Int?,
    val isReturnCargo: Boolean,
    val status: String,
    val syncVersion: Int,
    val lastUpdated: Long
)

@Entity(tableName = "cargo_movement_events")
data class CargoMovementEventEntity(
    @PrimaryKey val eventId: String,
    val cargoId: String,
    val legId: String?,
    val stationId: String?,
    val eventType: String,
    val timestampUtc: String,
    val actor: String,
    val reason: String?,
    val lastUpdated: Long
)



