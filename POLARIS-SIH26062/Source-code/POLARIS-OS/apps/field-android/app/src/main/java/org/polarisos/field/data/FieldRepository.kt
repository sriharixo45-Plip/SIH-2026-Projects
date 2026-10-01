package org.polarisos.field.data

import android.content.Context
import androidx.room.withTransaction
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import kotlinx.coroutines.flow.Flow
import org.json.JSONArray
import org.json.JSONObject
import retrofit2.HttpException
import java.time.Instant
import java.util.UUID
import java.util.concurrent.TimeUnit

class FieldRepository(context: Context) {
    val session = SessionStore(context)
    val database = FieldDatabase.get(context)
    private val appContext = context.applicationContext

    fun observeRecords(type: String?): Flow<List<CachedRecord>> = database.fieldDao().observeRecords(type)
    fun observeConflicts(): Flow<List<LocalConflict>> = database.fieldDao().observeConflicts()

    suspend fun login(endpoint: String, identity: String, password: String): FieldUser {
        session.endpoint = endpoint
        val login = FieldApiFactory(session).create().login(LoginRequest(identity.trim(), password))
        require(!login.user.user_id.isNullOrBlank()) { "The server did not return an authenticated user." }
        session.save(login)
        require(!session.stationId.isNullOrBlank()) { "This account needs an active station assignment to use the field application." }
        startPeriodicSync()
        requestSync()
        return login.user
    }

    suspend fun saveEndpoint(endpoint: String) { session.endpoint = endpoint }

    suspend fun createIncident(type: String, severity: String, description: String, latitude: String, longitude: String) {
        val stationId = session.stationId ?: error("Sign in to an assigned station first.")
        val lat = latitude.toDoubleOrNull() ?: error("Enter the current latitude in decimal degrees.")
        val lon = longitude.toDoubleOrNull() ?: error("Enter the current longitude in decimal degrees.")
        require(lat in -90.0..-55.0 && lon in -180.0..180.0) { "Incident coordinates must be valid Antarctic latitude/longitude values." }
        val id = UUID.randomUUID().toString()
        val point = "POINT($lon $lat)"
        val payload = JSONObject().put("station_id", stationId).put("type", type).put("severity", severity).put("status", "declared").put("description", description).put("location", point).toString()
        val record = JSONObject(payload).put("incident_id", id).put("declared_by", session.userId).put("local_sync_status", "pending").toString()
        enqueue("incident", id, "create", payload, null, null, record)
    }

    suspend fun advance(record: CachedRecord) {
        val data = JSONObject(record.json)
        val payload = JSONObject()
        val opType: String
        when (record.entityType) {
            "cargo_item" -> {
                val current = data.optString("status")
                val next = mapOf("packed" to "in-transit", "in-transit" to "in-storage-at-station", "in-storage-at-station" to "delivered", "delivered" to "returned", "damaged" to "returned")[current]
                    ?: error("Cargo status $current has no supported next transition.")
                payload.put("status", next); opType = "status_change"
            }
            "transport_leg" -> {
                payload.put("status", if (data.optString("status") == "delayed") "in-transit" else "delayed"); opType = "status_change"
            }
            "expedition" -> { payload.put("status", "in-progress"); opType = "status_change" }
            "personnel_assignment" -> { payload.put("status", "in-transit"); opType = "status_change" }
            "inventory_stock" -> {
                payload.put("transaction_type", "consumption").put("quantity_delta", 1).put("transaction_id", UUID.randomUUID().toString()).put("reason", "Field use")
                opType = "update"
            }
            else -> error("This record type does not support field updates yet.")
        }
        val rollback = record.json
        if (record.entityType == "inventory_stock") data.put("quantity", data.optDouble("quantity") - 1.0)
        else data.put("status", payload.optString("status"))
        data.put("local_sync_status", "pending")
        enqueue(record.entityType, record.entityId, opType, payload.toString(), record.version, rollback, data.toString())
    }

    private suspend fun enqueue(type: String, entityId: String, operationType: String, payload: String, baseVersion: Int?, rollback: String?, optimistic: String) {
        val userId = session.userId ?: error("Sign in before recording a field operation.")
        val deviceId = session.deviceId
        database.withTransaction {
            val dao = database.fieldDao()
            val sequence = (dao.value("next_sequence")?.toIntOrNull() ?: 0) + 1
            dao.putMetadata(SyncMetadata("next_sequence", sequence.toString()))
            val previous = dao.findRecord(type, entityId)
            dao.putOperation(PendingOperation(UUID.randomUUID().toString(), deviceId, userId, sequence, type, entityId, operationType, payload, baseVersion, Instant.now().toString(), rollbackJson = rollback))
            dao.putRecord(CachedRecord(type, entityId, optimistic, previous?.version ?: 0, changedAt = Instant.now().toString()))
        }
        requestSync()
    }

    fun requestSync() {
        val constraints = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()
        val request = OneTimeWorkRequestBuilder<SyncWorker>().setConstraints(constraints).setBackoffCriteria(androidx.work.BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS).build()
        WorkManager.getInstance(appContext).enqueueUniqueWork("polaris-field-sync", ExistingWorkPolicy.APPEND_OR_REPLACE, request)
    }

    private fun startPeriodicSync() {
        val constraints = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()
        val request = PeriodicWorkRequestBuilder<SyncWorker>(6, TimeUnit.HOURS).setConstraints(constraints).build()
        WorkManager.getInstance(appContext).enqueueUniquePeriodicWork("polaris-field-periodic-sync", ExistingPeriodicWorkPolicy.KEEP, request)
    }

    suspend fun resolveConflict(conflict: LocalConflict, acceptIncoming: Boolean) {
        val dao = database.fieldDao()
        database.withTransaction {
            val cached = dao.findRecord(conflict.entityType, conflict.entityId)
            if (!acceptIncoming && conflict.serverValue != null) {
                dao.putRecord(CachedRecord(conflict.entityType, conflict.entityId, conflict.serverValue, cached?.version ?: 0))
            }
            val resolution = if (acceptIncoming) "accepted_incoming" else "accepted_server"
            dao.putConflict(conflict.copy(resolved = true, resolution = resolution))
        }
        requestSync()
    }
}

internal fun jsonObjectMap(json: String): Map<String, Any?> {
    fun value(any: Any?): Any? = when (any) {
        JSONObject.NULL -> null
        is JSONObject -> any.keys().asSequence().associateWith { value(any.get(it)) }
        is JSONArray -> (0 until any.length()).map { value(any.get(it)) }
        else -> any
    }
    return value(JSONObject(json)) as Map<String, Any?>
}
