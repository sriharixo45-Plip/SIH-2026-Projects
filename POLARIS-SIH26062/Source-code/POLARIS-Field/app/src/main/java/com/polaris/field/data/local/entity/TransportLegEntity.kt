package com.polaris.field.data.local.entity


import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "transport_legs")
data class TransportLegEntity(
    @PrimaryKey val legId: String,
    val code: String,
    val expeditionId: String,
    val transportResourceId: String,
    val mode: String,
    val origin: String,
    val destination: String,
    val plannedDeparture: String,
    val plannedArrival: String,
    val status: String,
    val syncVersion: Int,
    val lastUpdated: Long
)



