package com.polaris.field.data.remote.dto

data class SyncOperationDto(
    val op_id: String,
    val device_id: String,
    val performed_by: String,
    val local_sequence_number: Int,
    val target_entity_type: String,
    val target_entity_id: String,
    val operation_type: String,
    val payload: Any,
    val base_version: Int? = null,
    val local_timestamp: String? = null
)

data class SyncChangesDto(val changes: List<SyncChangeDto>, val cursor: Long)
data class SyncChangeDto(
    val cursor: Long,
    val entity_type: String,
    val entity_id: String,
    val entity_version: Int,
    val deleted: Boolean,
    val record: Map<String, Any?>,
    val changed_at: String
)
data class RegisterDeviceDto(
    val device_id: String,
    val device_type: String = "station-pwa",
    val assigned_station_id: String,
    val app_version: String = "1.0.0"
)

data class ResolveConflictDto(
    val resolution: String
)

data class AuditLogDto(
    val log_id: String,
    val entity_type: String,
    val entity_id: String,
    val action: String,
    val old_value: Any?,
    val new_value: Any?,
    val actor: String?,
    val timestamp_utc: String
)
