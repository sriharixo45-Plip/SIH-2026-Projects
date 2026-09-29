package com.polaris.field.domain.model

data class StationInfo(
    val stationId: String,
    val name: String,
    val code: String,
    val latitude: Double,
    val longitude: Double,
    val timezone: String
)

data class ShipmentDisplayModel(
    val code: String,
    val origin: String,
    val destination: String,
    val transportResource: String,
    val eta: String,
    val status: String,
    val cargoCount: Int,
    val mode: String
)

data class SyncStatusModel(
    val isOnline: Boolean,
    val pendingOperationsCount: Int,
    val conflictsCount: Int,
    val lastSyncFormatted: String
)
