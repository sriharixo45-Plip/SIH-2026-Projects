package org.polarisos.field.data

import android.content.Context
import androidx.room.withTransaction
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import org.json.JSONObject
import retrofit2.HttpException
import java.io.IOException

class SyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val repository = (applicationContext as PolarisAppAccessor).fieldRepository()
        val session = repository.session
        if (!session.signedIn || session.endpoint.isBlank()) return Result.success()
        val api = try { FieldApiFactory(session).create() } catch (_: Exception) { return Result.failure() }
        return try {
            api.register(RegisterDeviceRequest(session.deviceId, assigned_station_id = session.stationId!!))
            uploadPending(repository, api)
            resolveServerConflicts(repository, api)
            downloadChanges(repository, api)
            Result.success()
        } catch (error: IOException) {
            Result.retry()
        } catch (error: HttpException) {
            if (error.code() >= 500 || error.code() == 429) Result.retry() else Result.failure()
        } catch (_: Exception) {
            Result.retry()
        }
    }

    private suspend fun resolveServerConflicts(repository: FieldRepository, api: FieldApi) {
        val dao = repository.database.fieldDao()
        for (conflict in dao.resolvedConflictsPendingAck()) {
            api.resolveConflict(conflict.conflictId, mapOf("resolution" to (conflict.resolution ?: "accepted_server")))
            dao.setOperationState(conflict.operationId, "rejected", "Resolved as ${conflict.resolution}")
            dao.markConflictAcknowledged(conflict.conflictId)
        }
    }

    private suspend fun uploadPending(repository: FieldRepository, api: FieldApi) {
        val db = repository.database
        val dao = db.fieldDao()
        for (operation in dao.pendingOperations()) {
            try {
                val reply = api.submit(SyncOperationRequest(operation.opId, operation.deviceId, operation.userId, operation.sequence, operation.entityType, operation.entityId, operation.operationType, jsonObjectMap(operation.payload), operation.baseVersion, operation.localTimestamp))
                val authoritative = reply["authoritative"]
                db.withTransaction {
                    if (authoritative is Map<*, *>) dao.putRecord(CachedRecord(operation.entityType, operation.entityId, JSONObject(authoritative).toString(), ((authoritative["sync_version"] as? Number)?.toInt() ?: 0), changedAt = null))
                    dao.setOperationState(operation.opId, "synced", null)
                }
            } catch (error: HttpException) {
                if (error.code() == 409) {
                    val response = JSONObject(error.response()?.errorBody()?.string().orEmpty())
                    val details = response.optJSONObject("message") ?: response
                    val server = details.optJSONObject("authoritative")?.toString()
                    val conflictId = details.optString("conflict_id").takeIf { it.isNotBlank() } ?: operation.opId
                    val cached = dao.findRecord(operation.entityType, operation.entityId)
                    db.withTransaction {
                        dao.putConflict(LocalConflict(conflictId, operation.opId, operation.entityType, operation.entityId, operation.payload, server, "The server record changed after this device last synchronized.", operation.localTimestamp))
                        dao.setOperationState(operation.opId, "conflicted", "Base version is stale")
                        if (server != null) dao.putRecord(CachedRecord(operation.entityType, operation.entityId, server, JSONObject(server).optInt("sync_version", cached?.version ?: 0)))
                    }
                } else if (error.code() in 400..499) {
                    db.withTransaction {
                        if (operation.rollbackJson != null) dao.putRecord(CachedRecord(operation.entityType, operation.entityId, operation.rollbackJson, operation.baseVersion ?: 0))
                        else dao.findRecord(operation.entityType, operation.entityId)?.let { rejected ->
                            val marker = runCatching { JSONObject(rejected.json).put("local_sync_status", "rejected").toString() }.getOrDefault(rejected.json)
                            dao.putRecord(rejected.copy(json = marker))
                        }
                        dao.setOperationState(operation.opId, "rejected", "Server rejected operation (${error.code()})")
                    }
                } else throw error
            } catch (error: IOException) {
                dao.setOperationState(operation.opId, "pending", error.message ?: "Network interruption")
                throw error
            }
        }
    }

    private suspend fun downloadChanges(repository: FieldRepository, api: FieldApi) {
        val db = repository.database
        val dao = db.fieldDao()
        var cursor = dao.value("change_cursor")?.toLongOrNull() ?: 0L
        repeat(20) {
            val page = api.changes(cursor, repository.session.deviceId)
            db.withTransaction {
                page.changes.forEach { change ->
                    val json = if (change.record == null) "{}" else JSONObject(change.record as Map<*, *>).toString()
                    dao.putRecord(CachedRecord(change.entity_type, change.entity_id, json, change.entity_version, change.deleted, change.changed_at))
                }
                dao.putMetadata(SyncMetadata("change_cursor", page.cursor.toString()))
            }
            if (page.changes.isEmpty() || page.cursor <= cursor) return
            cursor = page.cursor
            if (page.changes.size < 500) return
        }
    }
}

interface PolarisAppAccessor {
    fun fieldRepository(): FieldRepository
}
