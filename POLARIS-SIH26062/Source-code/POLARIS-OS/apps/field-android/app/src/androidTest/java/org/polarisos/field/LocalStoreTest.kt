package org.polarisos.field

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.polarisos.field.data.CachedRecord
import org.polarisos.field.data.FieldDatabase
import org.polarisos.field.data.PendingOperation
import org.polarisos.field.data.SyncMetadata
import java.time.Instant

@RunWith(AndroidJUnit4::class)
class LocalStoreTest {
    private lateinit var context: Context
    private lateinit var db: FieldDatabase
    private val fileName = "polaris-field-test.db"

    @Before fun open() {
        context = ApplicationProvider.getApplicationContext()
        context.deleteDatabase(fileName)
        db = Room.databaseBuilder(context, FieldDatabase::class.java, fileName).build()
    }

    @After fun close() { db.close(); context.deleteDatabase(fileName) }

    @Test fun recordsAndPendingOperationsSurviveDatabaseRestart() = runBlocking {
        val dao = db.fieldDao()
        dao.putRecord(CachedRecord("incident", "local-id", "{\"description\":\"offline report\"}", 0))
        dao.putMetadata(SyncMetadata("next_sequence", "4"))
        dao.putOperation(PendingOperation("op-id", "device-id", "user-id", 4, "incident", "local-id", "create", "{\"severity\":\"high\"}", null, Instant.now().toString()))
        db.close()

        db = Room.databaseBuilder(context, FieldDatabase::class.java, fileName).build()
        assertNotNull(db.fieldDao().findRecord("incident", "local-id"))
        assertEquals(4, db.fieldDao().pendingOperations().single().sequence)
        assertEquals("4", db.fieldDao().value("next_sequence"))
    }
}
