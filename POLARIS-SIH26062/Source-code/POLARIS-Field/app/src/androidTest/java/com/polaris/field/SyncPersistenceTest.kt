package com.polaris.field

import androidx.room.Room
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.polaris.field.data.local.database.PolarisDatabase
import com.polaris.field.data.local.entity.SyncConflictEntity
import com.polaris.field.data.local.entity.SyncOperationEntity
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class SyncPersistenceTest {
    @Test
    fun pendingOperationAndConflictSurviveDatabaseReopen() = runBlocking {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val dbName = "sync-persistence-test.db"
        context.deleteDatabase(dbName)

        fun openDatabase(): PolarisDatabase = Room.databaseBuilder(
            context,
            PolarisDatabase::class.java,
            dbName
        ).addMigrations(
            migration(1, 2), migration(2, 3), migration(3, 4)
        ).build()

        val operation = SyncOperationEntity(
            opId = "offline-operation-1",
            deviceId = "device-1",
            performedBy = "operator-1",
            localSequenceNumber = 1,
            targetEntityType = "cargo_item",
            targetEntityId = "cargo-1",
            operationType = "status_change",
            payloadJson = """{"status":"received"}""",
            baseVersion = 4,
            status = "PENDING",
            timestamp = 1_800_000_000_000L
        )

        var database = openDatabase()
        database.syncDao().insertOperation(operation)
        database.syncDao().insertConflict(
            SyncConflictEntity("conflict-1", "cargo_item", "cargo-1", "{}", "{}", "status", null, null, null)
        )
        database.close()

        database = openDatabase()
        assertEquals(listOf(operation), database.syncDao().getPendingOperations("operator-1"))
        assertEquals("conflict-1", database.syncDao().getUnresolvedConflictsFlow().first().single().conflictId)
        database.close()
        context.deleteDatabase(dbName)
        Unit
    }

    private fun migration(from: Int, to: Int) = object : androidx.room.migration.Migration(from, to) {
        override fun migrate(db: androidx.sqlite.db.SupportSQLiteDatabase) {
            when (from to to) {
                1 to 2 -> db.execSQL("ALTER TABLE sync_operations ADD COLUMN retryCount INTEGER NOT NULL DEFAULT 0")
                2 to 3 -> db.execSQL("ALTER TABLE inventory_stocks ADD COLUMN syncVersion INTEGER NOT NULL DEFAULT 0")
                3 to 4 -> db.execSQL("ALTER TABLE approvals ADD COLUMN syncVersion INTEGER NOT NULL DEFAULT 0")
            }
        }
    }
}
