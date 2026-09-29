package com.polaris.field.data.local.dao


import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.polaris.field.data.local.entity.SyncConflictEntity
import com.polaris.field.data.local.entity.SyncOperationEntity
import kotlinx.coroutines.flow.Flow


@Dao
interface SyncDao {
    @Query("SELECT * FROM sync_operations WHERE status = 'PENDING' ORDER BY localSequenceNumber ASC")
    fun getPendingOperationsFlow(): Flow<List<SyncOperationEntity>>

    @Query("SELECT * FROM sync_operations ORDER BY timestamp DESC")
    fun getAllOperationsFlow(): Flow<List<SyncOperationEntity>>

    @Query("SELECT * FROM sync_operations WHERE status = 'PENDING' AND performedBy = :userId ORDER BY localSequenceNumber ASC")
    suspend fun getPendingOperations(userId: String): List<SyncOperationEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOperation(operation: SyncOperationEntity)

    @Query("SELECT COALESCE(MAX(localSequenceNumber), 0) + 1 FROM sync_operations")
    suspend fun nextLocalSequence(): Int

    @Query("UPDATE sync_operations SET status = :status, errorMessage = CASE WHEN :status = 'SYNCED' THEN NULL ELSE errorMessage END, httpStatus = CASE WHEN :status = 'SYNCED' THEN NULL ELSE httpStatus END WHERE opId = :opId")
    suspend fun updateOperationStatus(opId: String, status: String)

    @Query("UPDATE sync_operations SET status = :status, errorMessage = :errorMessage, httpStatus = :httpStatus WHERE opId = :opId")
    suspend fun updateOperationFailure(opId: String, status: String, errorMessage: String, httpStatus: Int?)

    @Query("DELETE FROM sync_operations WHERE status IN ('SYNCED', 'FAILED')")
    suspend fun clearTerminalOperationHistory()

    @Query("UPDATE sync_operations SET status = 'PENDING' WHERE status = 'FAILED'")
    suspend fun retryFailedOperations()

    @Query("UPDATE sync_operations SET retryCount = retryCount + 1 WHERE opId = :opId")
    suspend fun incrementRetryCount(opId: String)

    @Query("SELECT * FROM sync_operations WHERE targetEntityType = :entityType AND targetEntityId = :entityId AND status = 'CONFLICT' ORDER BY timestamp DESC LIMIT 1")
    suspend fun getConflictOperation(entityType: String, entityId: String): SyncOperationEntity?

    @Query("SELECT * FROM sync_conflicts WHERE resolution IS NULL")
    fun getUnresolvedConflictsFlow(): Flow<List<SyncConflictEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertConflict(conflict: SyncConflictEntity)

    @Query("UPDATE sync_conflicts SET resolution = :resolution, resolvedBy = :resolvedBy, resolvedAt = :resolvedAt WHERE conflictId = :conflictId")
    suspend fun resolveConflict(conflictId: String, resolution: String, resolvedBy: String, resolvedAt: Long)
}






