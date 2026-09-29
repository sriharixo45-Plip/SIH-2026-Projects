package com.polaris.field.data.remote.dto

data class CargoItemDto(
    val cargo_id: String,
    val tracking_code: String,
    val leg_id: String,
    val description: String,
    val category: String,
    val weight: Double,
    val volume: Double,
    val hazard_class: Int?,
    val is_return_cargo: Boolean = false,
    val status: String,
    val sync_version: Int = 0
)

data class UpdateCargoStatusDto(
    val status: String,
    val actor: String,
    val reason: String? = null
)

data class CargoMovementEventDto(
    val event_id: String,
    val cargo_id: String,
    val leg_id: String?,
    val station_id: String?,
    val event_type: String,
    val timestamp_utc: String,
    val actor: String,
    val reason: String?
)
