package com.polaris.field.sync

import android.content.Context
import androidx.room.withTransaction
import com.google.gson.Gson
import com.google.gson.JsonParser
import com.google.gson.reflect.TypeToken
import com.polaris.field.auth.SessionManager
import com.polaris.field.data.local.database.PolarisDatabase
import com.polaris.field.data.local.entity.*
import com.polaris.field.data.remote.api.PolarisApiService
import com.polaris.field.data.remote.dto.*
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import org.json.JSONObject
import java.util.UUID
import java.time.Instant

class SyncManager(
    private val context: Context,
    private val apiService: PolarisApiService,
    private val database: PolarisDatabase,
    private val sessionManager: SessionManager
) {
    private val syncDao = database.syncDao()
    private val gson = Gson()
    val pendingOperationsFlow: Flow<List<SyncOperationEntity>> = syncDao.getPendingOperationsFlow()
    val allOperationsFlow: Flow<List<SyncOperationEntity>> = syncDao.getAllOperationsFlow()
    val unresolvedConflictsFlow: Flow<List<SyncConflictEntity>> = syncDao.getUnresolvedConflictsFlow()

    suspend fun retryFailedOperations() {
        syncDao.retryFailedOperations()
        SyncScheduler.requestNow(context)
    }

    suspend fun clearLocalSyncLog() {
        syncDao.clearTerminalOperationHistory()
    }

    suspend fun ensureLocalScope(userId: String) {
        if (sessionManager.getActiveSyncUserId() == userId) return
        database.withTransaction {
            database.cargoDao().deleteAllMovementEvents()
            database.cargoDao().deleteAllCargo()
            database.transportLegDao().deleteAll()
            database.inventoryDao().deleteAllTransactions()
            database.inventoryDao().deleteAllStocks()
            database.incidentDao().deleteAllEvents()
            database.incidentDao().deleteAllIncidents()
            database.scheduleDao().deleteAllAssignments()
            database.scheduleDao().deleteAllPersonnel()
            database.approvalDao().deleteAllApprovals()
        }
        sessionManager.saveSyncCursor(0, userId)
        sessionManager.setActiveSyncUserId(userId)
    }

    suspend fun enqueueOperation(
        entityType: String,
        entityId: String,
        operationType: String,
        payload: Any,
        performedBy: String,
        baseVersion: Int? = null,
        localMutation: suspend () -> Unit
    ) {
        val now = System.currentTimeMillis()
        val opId = UUID.randomUUID().toString()
        val deviceId = sessionManager.getDeviceId(performedBy)
        val payloadJson = gson.toJson(payload)
        database.withTransaction {
            localMutation()
            syncDao.insertOperation(
                SyncOperationEntity(
                    opId = opId,
                    deviceId = deviceId,
                    performedBy = performedBy,
                    localSequenceNumber = syncDao.nextLocalSequence(),
                    targetEntityType = entityType,
                    targetEntityId = entityId,
                    operationType = operationType,
                    payloadJson = payloadJson,
                    baseVersion = baseVersion,
                    status = "PENDING",
                    timestamp = now
                )
            )
        }
        SyncScheduler.requestNow(context)
    }

    suspend fun processPendingOperations(): Result<Int> {
        try {
            val user = sessionManager.sessionUserFlow.first() ?: return Result.failure(IllegalStateException("Sign in before syncing."))
            val scopeId = "${user.userId}:${user.stationId.orEmpty()}"
            ensureLocalScope(scopeId)
            val deviceId = sessionManager.getDeviceId(user.userId)
            var registration = apiService.registerSyncDevice(
                RegisterDeviceDto(device_id = deviceId, assigned_station_id = user.stationId ?: return Result.failure(IllegalStateException("A station must be assigned before syncing.")))
            )
            if (registration.code() == 401 && refreshSession(user)) {
                registration = apiService.registerSyncDevice(RegisterDeviceDto(device_id = deviceId, assigned_station_id = user.stationId!!))
            }
            if (!registration.isSuccessful) return Result.failure(IllegalStateException("Device registration failed (${registration.code()})."))

            var processed = 0
            for (op in syncDao.getPendingOperations(user.userId)) {
                val payload = JsonParser().parse(op.payloadJson)
                val dto = SyncOperationDto(
                    op_id = op.opId,
                    device_id = op.deviceId,
                    performed_by = op.performedBy,
                    local_sequence_number = op.localSequenceNumber,
                    target_entity_type = op.targetEntityType,
                    target_entity_id = op.targetEntityId,
                    operation_type = op.operationType,
                    payload = payload,
                    base_version = op.baseVersion,
                    local_timestamp = Instant.ofEpochMilli(op.timestamp).toString()
                )
                try {
                    var response = apiService.pushSyncOperation(dto)
                    if (response.code() == 401 && refreshSession(user)) response = apiService.pushSyncOperation(dto)
                    if (response.isSuccessful) {
                        syncDao.updateOperationStatus(op.opId, "SYNCED")
                        processed++
                    } else if (response.code() == 409) {
                        val body = response.errorBody()?.string().orEmpty()
                        val parsed = runCatching { JSONObject(body) }.getOrNull()
                        val details = parsed?.optJSONObject("message") ?: parsed
                        val conflictId = details?.optString("conflict_id").orEmpty()
                        if (conflictId.isBlank()) {
                            syncDao.updateOperationFailure(op.opId, "FAILED", body.ifBlank { "Server reported a conflict without conflict details." }.take(2000), 409)
                        } else {
                            syncDao.updateOperationStatus(op.opId, "CONFLICT")
                            syncDao.insertConflict(
                                SyncConflictEntity(
                                conflictId = conflictId,
                                entityType = op.targetEntityType,
                                entityId = op.targetEntityId,
                                localValueJson = op.payloadJson,
                                serverValueJson = details?.optJSONObject("authoritative")?.toString() ?: body,
                                fieldName = "Concurrent server change",
                                resolution = null,
                                resolvedBy = null,
                                resolvedAt = null
                                )
                            )
                        }
                    } else if (response.code() in 400..499 && response.code() != 401 && response.code() != 429) {
                        val errorBody = response.errorBody()?.string().orEmpty()
                        syncDao.updateOperationFailure(op.opId, "FAILED", errorBody.ifBlank { "Server rejected the operation (HTTP ${response.code()})." }.take(2000), response.code())
                    } else {
                        syncDao.incrementRetryCount(op.opId)
                        return Result.failure(IllegalStateException("Sync upload failed (${response.code()})."))
                    }
                } catch (e: Exception) {
                    syncDao.incrementRetryCount(op.opId)
                    return Result.failure(e)
                }
            }
            pullChanges(scopeId, deviceId)
            return Result.success(processed)
        } catch (e: Exception) {
            return Result.failure(e)
        }
    }

    private suspend fun pullChanges(userId: String, deviceId: String) {
        var cursor = sessionManager.getSyncCursor(userId)
        do {
            val response = apiService.getSyncChanges(cursor, deviceId)
            if (!response.isSuccessful) throw IllegalStateException("Sync download failed (${response.code()}).")
            val batch = response.body() ?: throw IllegalStateException("Sync response was empty.")
            if (batch.changes.isNotEmpty()) {
                database.withTransaction { batch.changes.forEach { applyChange(it) } }
            }
            if (batch.cursor < cursor) throw IllegalStateException("Sync cursor moved backwards.")
            cursor = batch.cursor
            sessionManager.saveSyncCursor(cursor, userId)
        } while (response.body()?.changes?.size == 500)
    }

    private suspend fun refreshSession(user: com.polaris.field.auth.SessionUser): Boolean {
        val refreshToken = sessionManager.getRefreshToken() ?: return false
        return try {
            val response = apiService.refreshToken(RefreshTokenRequestDto(refresh_token = refreshToken))
            val body = response.body()
            if (!response.isSuccessful || body == null) return false
            sessionManager.saveSession(body.access_token, body.refresh_token, user.userId, user.employeeCode, user.fullName, user.role, user.stationCode, user.stationId)
            true
        } catch (_: Exception) { false }
    }

    private suspend fun applyChange(change: SyncChangeDto) {
        val r = change.record
        fun str(key: String) = r[key]?.toString().orEmpty()
        fun num(key: String) = (r[key] as? Number)?.toInt() ?: change.entity_version
        when (change.entity_type) {
            "cargo_item" -> if (change.deleted) database.cargoDao().deleteCargo(change.entity_id) else database.cargoDao().insertCargoItems(listOf(CargoItemEntity(
                cargoId = change.entity_id, trackingCode = str("tracking_code"), legId = str("leg_id"), description = str("description"), category = str("category"),
                weight = (r["weight"] as? Number)?.toDouble() ?: 0.0, volume = (r["volume"] as? Number)?.toDouble() ?: 0.0,
                hazardClass = (r["hazard_class"] as? Number)?.toInt(), isReturnCargo = r["is_return_cargo"] as? Boolean ?: false,
                status = str("status"), syncVersion = num("sync_version"), lastUpdated = System.currentTimeMillis()
            )))
            "transport_leg" -> if (change.deleted) database.transportLegDao().deleteLeg(change.entity_id) else database.transportLegDao().insertLegs(listOf(TransportLegEntity(
                legId = change.entity_id, code = str("code"), expeditionId = str("expedition_id"), transportResourceId = str("transport_resource_id"), mode = str("mode"), origin = str("origin"), destination = str("destination"),
                plannedDeparture = str("planned_departure"), plannedArrival = str("planned_arrival"), status = str("status"), syncVersion = num("sync_version"), lastUpdated = System.currentTimeMillis()
            )))
            "inventory_stock" -> if (change.deleted) database.inventoryDao().deleteStock(change.entity_id) else database.inventoryDao().insertStocks(listOf(InventoryStockEntity(
                stockId = change.entity_id, stationId = str("station_id"), itemCatalogId = str("item_catalog_id"), itemName = r["item_name"]?.toString() ?: database.inventoryDao().getStock(change.entity_id)?.itemName.orEmpty(), quantity = (r["quantity"] as? Number)?.toDouble() ?: 0.0,
                reorderThreshold = (r["reorder_threshold"] as? Number)?.toDouble() ?: 0.0, unit = str("unit"), syncVersion = num("sync_version"), lastUpdated = System.currentTimeMillis()
            )))
            "personnel_assignment" -> if (change.deleted) database.scheduleDao().deleteAssignment(change.entity_id) else database.scheduleDao().insertAssignments(listOf(PersonnelAssignmentEntity(
                assignmentId = change.entity_id, personnelId = str("personnel_id"), expeditionId = str("expedition_id"), stationId = r["station_id"]?.toString(), legId = r["leg_id"]?.toString(), seatBerthRef = r["seat_berth_ref"]?.toString(),
                status = str("status"), startDate = str("start_date"), endDate = r["end_date"]?.toString(), syncVersion = num("sync_version"), lastUpdated = System.currentTimeMillis()
            )))
            "incident" -> if (change.deleted) database.incidentDao().deleteIncident(change.entity_id) else database.incidentDao().insertIncidents(listOf(IncidentEntity(
                incidentId = change.entity_id, stationId = r["station_id"]?.toString(), legId = r["leg_id"]?.toString(), type = str("type"), declaredAt = str("declared_at"), declaredBy = str("declared_by"),
                severity = str("severity"), status = str("status"), description = r["description"]?.toString(), syncVersion = num("sync_version"), lastUpdated = System.currentTimeMillis()
            )))
            "approval" -> if (change.deleted) database.approvalDao().deleteApproval(change.entity_id) else database.approvalDao().insertApprovals(listOf(ApprovalEntity(
                approvalId = change.entity_id, entityType = str("entity_type"), entityId = str("entity_id"), requestedBy = str("requested_by"),
                decidedBy = r["decided_by"]?.toString(), decision = str("decision"), decidedAt = r["decided_at"]?.toString(), reason = r["reason"]?.toString(),
                syncVersion = num("sync_version"), lastUpdated = System.currentTimeMillis()
            )))
        }
    }

    suspend fun resolveConflict(conflictId: String, resolution: String, resolvedBy: String): Result<Unit> {
        return try {
            val conflict = syncDao.getUnresolvedConflictsFlow().first().firstOrNull { it.conflictId == conflictId }
            val serverResolution = when (resolution.uppercase()) {
                "KEEP_SERVER", "ACCEPTED_SERVER" -> "accepted_server"
                "KEEP_LOCAL", "ACCEPTED_INCOMING" -> "accepted_incoming"
                else -> return Result.failure(IllegalArgumentException("Unsupported conflict resolution: $resolution"))
            }
            val response = apiService.resolveConflict(conflictId, ResolveConflictDto(serverResolution))
            if (!response.isSuccessful) return Result.failure(IllegalStateException("Conflict resolution failed (${response.code()})."))
            database.withTransaction {
                if (serverResolution == "accepted_server" && conflict != null) {
                    val parsedValue = JsonParser().parse(conflict.serverValueJson)
                    val serverValue = parsedValue.takeIf { it.isJsonObject }?.asJsonObject
                    if (serverValue != null) {
                        val record: Map<String, Any?> = gson.fromJson(serverValue, object : TypeToken<Map<String, Any?>>() {}.type)
                        val version = (record["sync_version"] as? Number)?.toInt() ?: 0
                        applyChange(SyncChangeDto(0L, conflict.entityType, conflict.entityId, version, false, record, ""))
                    }
                }
                syncDao.resolveConflict(conflictId, serverResolution, resolvedBy, System.currentTimeMillis())
            }
            SyncScheduler.requestNow(context)
            Result.success(Unit)
        } catch (e: Exception) { Result.failure(e) }
    }
}
