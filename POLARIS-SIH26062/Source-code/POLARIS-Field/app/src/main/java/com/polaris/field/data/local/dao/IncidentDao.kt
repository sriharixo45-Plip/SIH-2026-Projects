package com.polaris.field.data.local.dao


import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.polaris.field.data.local.entity.IncidentEntity
import com.polaris.field.data.local.entity.IncidentEventEntity
import kotlinx.coroutines.flow.Flow


@Dao
interface IncidentDao {
    @Query("SELECT * FROM incidents ORDER BY declaredAt DESC")
    fun getAllIncidentsFlow(): Flow<List<IncidentEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertIncidents(incidents: List<IncidentEntity>)

    @Query("DELETE FROM incidents WHERE incidentId = :incidentId")
    suspend fun deleteIncident(incidentId: String)

    @Query("SELECT * FROM incidents WHERE incidentId = :incidentId LIMIT 1")
    suspend fun getIncident(incidentId: String): IncidentEntity?

    @Query("DELETE FROM incidents")
    suspend fun deleteAllIncidents()

    @Query("DELETE FROM incident_events")
    suspend fun deleteAllEvents()

    @Query("SELECT * FROM incident_events WHERE incidentId = :incidentId ORDER BY timestampUtc ASC")
    fun getEventsByIncidentFlow(incidentId: String): Flow<List<IncidentEventEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertEvents(events: List<IncidentEventEntity>)
}






