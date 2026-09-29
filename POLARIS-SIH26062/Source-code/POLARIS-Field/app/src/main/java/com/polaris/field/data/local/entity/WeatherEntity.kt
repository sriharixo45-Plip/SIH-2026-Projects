package com.polaris.field.data.local.entity


import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "weather_events")
data class WeatherEntity(
    @PrimaryKey val eventId: String,
    val stationId: String,
    val stationName: String,
    val eventType: String,
    val severity: String,
    val temperatureC: Double,
    val windSpeedKts: Double,
    val visibilityKm: Double,
    val loggedAt: String,
    val loggedBy: String,
    val source: String, // LIVE, CACHED, STALE_OFFLINE
    val notes: String?,
    val isStale: Boolean,
    val lastUpdated: Long
)



