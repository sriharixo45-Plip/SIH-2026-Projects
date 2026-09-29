package com.polaris.field.data.local.dao


import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.polaris.field.data.local.entity.AuditLogEntity
import kotlinx.coroutines.flow.Flow


@Dao
interface AuditLogDao {
    @Query("SELECT * FROM audit_logs ORDER BY timestampUtc DESC")
    fun getAllLogsFlow(): Flow<List<AuditLogEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertLogs(logs: List<AuditLogEntity>)

    @Query("UPDATE audit_logs SET isRead = 1 WHERE logId = :logId")
    suspend fun markAsRead(logId: String)

    @Query("UPDATE audit_logs SET isRead = 1")
    suspend fun markAllAsRead()
}






