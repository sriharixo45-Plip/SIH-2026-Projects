package com.polaris.field.data.local.entity


import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "users")
data class UserEntity(
    @PrimaryKey val userId: String,
    val employeeCode: String,
    val fullName: String,
    val email: String,
    val role: String,
    val stationCode: String,
    val stationId: String?,
    val isCurrentSession: Boolean,
    val lastUpdated: Long
)



