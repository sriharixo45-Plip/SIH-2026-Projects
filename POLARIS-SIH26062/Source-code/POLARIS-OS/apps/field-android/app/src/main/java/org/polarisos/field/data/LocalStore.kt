package org.polarisos.field.data

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.withTransaction
import kotlinx.coroutines.flow.Flow

@Entity(tableName = "cached_records", primaryKeys = ["entityType", "entityId"])
data class CachedRecord(
    val entityType: String,
    val entityId: String,
    val json: String,
    val version: Int,
    val deleted: Boolean = false,
    val changedAt: String? = null,
)

@Entity(tableName = "pending_operations")
data class PendingOperation(
    @PrimaryKey val opId: String,
    val deviceId: String,
    val userId: String,
    val sequence: Int,
    val entityType: String,
    val entityId: String,
    val operationType: String,
    val payload: String,
    val baseVersion: Int?,
    val localTimestamp: String,
    val rollbackJson: String? = null,
    val status: String = "pending",
    val attempts: Int = 0,
    val lastError: String? = null,
)

@Entity(tableName = "sync_conflicts")
data class LocalConflict(
    @PrimaryKey val conflictId: String,
    val operationId: String,
    val entityType: String,
    val entityId: String,
    val incomingValue: String,
    val serverValue: String?,
    val reason: String,
    val occurredAt: String,
    val resolved: Boolean = false,
    val resolution: String? = null,
    val serverAcknowledged: Boolean = false,
)

@Entity(tableName = "sync_metadata")
data class SyncMetadata(@PrimaryKey val name: String, val value: String)

@Dao
interface FieldDao {
    @Query("SELECT * FROM cached_records WHERE deleted = 0 AND (:type IS NULL OR entityType = :type) ORDER BY changedAt DESC")
    fun observeRecords(type: String?): Flow<List<CachedRecord>>

    @Query("SELECT * FROM cached_records WHERE entityType = :type AND entityId = :id LIMIT 1")
    suspend fun findRecord(type: String, id: String): CachedRecord?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun putRecord(record: CachedRecord)

    @Query("SELECT * FROM pending_operations WHERE status = 'pending' ORDER BY sequence ASC")
    suspend fun pendingOperations(): List<PendingOperation>

    @Query("SELECT COUNT(*) FROM pending_operations WHERE status = 'pending'")
    fun observePendingCount(): Flow<Int>

    @Query("SELECT * FROM pending_operations ORDER BY sequence DESC LIMIT 100")
    fun observeOperations(): Flow<List<PendingOperation>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun putOperation(operation: PendingOperation)

    @Query("UPDATE pending_operations SET status = :status, attempts = attempts + 1, lastError = :error WHERE opId = :id")
    suspend fun setOperationState(id: String, status: String, error: String?)

    @Query("SELECT * FROM pending_operations WHERE opId = :id LIMIT 1")
    suspend fun operation(id: String): PendingOperation?

    @Query("SELECT * FROM sync_conflicts WHERE resolved = 0 ORDER BY occurredAt DESC")
    fun observeConflicts(): Flow<List<LocalConflict>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun putConflict(conflict: LocalConflict)

    @Query("UPDATE sync_conflicts SET resolved = 1 WHERE conflictId = :id")
    suspend fun markConflictResolved(id: String)

    @Query("SELECT * FROM sync_conflicts WHERE resolved = 1 AND serverAcknowledged = 0")
    suspend fun resolvedConflictsPendingAck(): List<LocalConflict>

    @Query("UPDATE sync_conflicts SET serverAcknowledged = 1 WHERE conflictId = :id")
    suspend fun markConflictAcknowledged(id: String)

    @Query("SELECT value FROM sync_metadata WHERE name = :name LIMIT 1")
    suspend fun value(name: String): String?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun putMetadata(value: SyncMetadata)
}

@Database(entities = [CachedRecord::class, PendingOperation::class, LocalConflict::class, SyncMetadata::class], version = 1, exportSchema = true)
abstract class FieldDatabase : RoomDatabase() {
    abstract fun fieldDao(): FieldDao

    companion object {
        @Volatile private var instance: FieldDatabase? = null
        fun get(context: Context): FieldDatabase = instance ?: synchronized(this) {
            instance ?: Room.databaseBuilder(context.applicationContext, FieldDatabase::class.java, "polaris-field.db").build().also { instance = it }
        }
    }
}

suspend fun FieldDatabase.nextSequence(): Int = withTransaction {
    val dao = fieldDao()
    val next = (dao.value("next_sequence")?.toIntOrNull() ?: 0) + 1
    dao.putMetadata(SyncMetadata("next_sequence", next.toString()))
    next
}
