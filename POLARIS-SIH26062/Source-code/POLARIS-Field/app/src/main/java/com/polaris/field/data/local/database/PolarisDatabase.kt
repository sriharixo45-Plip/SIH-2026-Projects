package com.polaris.field.data.local.database


import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import com.polaris.field.data.local.dao.*
import com.polaris.field.data.local.entity.*

@Database(
    entities = [
        UserEntity::class,
        TransportLegEntity::class,
        CargoItemEntity::class,
        CargoMovementEventEntity::class,
        PersonnelEntity::class,
        PersonnelAssignmentEntity::class,
        ApprovalEntity::class,
        InventoryStockEntity::class,
        InventoryTransactionEntity::class,
        IncidentEntity::class,
        IncidentEventEntity::class,
        SyncOperationEntity::class,
        SyncConflictEntity::class,
        AuditLogEntity::class,
        WeatherEntity::class
    ],
    version = 5,
    exportSchema = false
)
abstract class PolarisDatabase : RoomDatabase() {
    abstract fun userDao(): UserDao
    abstract fun transportLegDao(): TransportLegDao
    abstract fun cargoDao(): CargoDao
    abstract fun scheduleDao(): ScheduleDao
    abstract fun approvalDao(): ApprovalDao
    abstract fun inventoryDao(): InventoryDao
    abstract fun incidentDao(): IncidentDao
    abstract fun syncDao(): SyncDao
    abstract fun auditLogDao(): AuditLogDao
    abstract fun weatherDao(): WeatherDao

    companion object {
        private val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE sync_operations ADD COLUMN retryCount INTEGER NOT NULL DEFAULT 0")
            }
        }
        private val MIGRATION_2_3 = object : Migration(2, 3) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE inventory_stocks ADD COLUMN syncVersion INTEGER NOT NULL DEFAULT 0")
            }
        }
        private val MIGRATION_3_4 = object : Migration(3, 4) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE approvals ADD COLUMN syncVersion INTEGER NOT NULL DEFAULT 0")
            }
        }
        private val MIGRATION_4_5 = object : Migration(4, 5) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE sync_operations ADD COLUMN errorMessage TEXT")
                db.execSQL("ALTER TABLE sync_operations ADD COLUMN httpStatus INTEGER")
            }
        }
        @Volatile
        private var INSTANCE: PolarisDatabase? = null

        fun getInstance(context: Context): PolarisDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    PolarisDatabase::class.java,
                    "polaris_field.db"
                ).addMigrations(MIGRATION_1_2, MIGRATION_2_3, MIGRATION_3_4, MIGRATION_4_5).build()
                INSTANCE = instance
                instance
            }
        }
    }
}


