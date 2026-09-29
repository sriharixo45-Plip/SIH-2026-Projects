package com.polaris.field.data.local.dao


import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.polaris.field.data.local.entity.TransportLegEntity
import kotlinx.coroutines.flow.Flow


@Dao
interface TransportLegDao {
    @Query("SELECT * FROM transport_legs ORDER BY plannedDeparture ASC")
    fun getAllLegsFlow(): Flow<List<TransportLegEntity>>

    @Query("SELECT * FROM transport_legs WHERE legId = :legId LIMIT 1")
    suspend fun getLegById(legId: String): TransportLegEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertLegs(legs: List<TransportLegEntity>)

    @Query("DELETE FROM transport_legs")
    suspend fun deleteAll()

    @Query("DELETE FROM transport_legs WHERE legId = :legId")
    suspend fun deleteLeg(legId: String)
}






