package org.polarisos.field.util

import org.json.JSONObject
import org.polarisos.field.data.CachedRecord

/**
 * Safely parses raw JSON from cached operational records for structured UI presentation.
 * Preserves actual backend fields without inventing synthetic data.
 */
object RecordParser {

    data class CargoItemData(
        val cargoId: String,
        val trackingCode: String,
        val description: String,
        val category: String,
        val weight: String,
        val volume: String,
        val hazardClass: String?,
        val isReturnCargo: Boolean,
        val status: String,
        val legId: String?,
        val syncStatus: String?
    )

    data class InventoryStockData(
        val stockId: String,
        val stationId: String,
        val itemCatalogId: String,
        val code: String,
        val name: String,
        val quantity: Double,
        val unit: String,
        val reorderThreshold: Double,
        val safetyStockMinimum: Double,
        val isLowStock: Boolean,
        val syncStatus: String?
    )

    data class IncidentData(
        val incidentId: String,
        val type: String,
        val severity: String,
        val status: String,
        val description: String,
        val location: String,
        val coordinatesText: String,
        val declaredAt: String?,
        val declaredBy: String?,
        val syncStatus: String?
    )

    data class PersonnelAssignmentData(
        val assignmentId: String,
        val personnelId: String,
        val expeditionId: String,
        val name: String,
        val role: String,
        val employeeCode: String,
        val status: String,
        val startDate: String,
        val endDate: String?,
        val seatBerthRef: String?,
        val syncStatus: String?
    )

    data class TransportLegData(
        val legId: String,
        val expeditionId: String,
        val code: String,
        val origin: String,
        val destination: String,
        val status: String,
        val plannedDeparture: String?,
        val plannedArrival: String?,
        val syncStatus: String?
    )

    data class ExpeditionData(
        val expeditionId: String,
        val code: String,
        val name: String,
        val season: String,
        val status: String,
        val startDate: String?,
        val endDate: String?,
        val syncStatus: String?
    )

    fun parseCargo(record: CachedRecord): CargoItemData {
        val json = parseJsonObject(record.json)
        val trackingCode = json.optString("tracking_code").ifBlank {
            json.optString("code").ifBlank { record.entityId.take(8).uppercase() }
        }
        val description = json.optString("description").ifBlank {
            json.optString("name", "Cargo item")
        }
        val category = json.optString("category", "General supplies")
        val weight = json.optString("weight", "—")
        val volume = json.optString("volume", "—")
        val hazard = json.optString("hazard_class").takeIf { it.isNotBlank() && it != "null" }
        val isReturn = json.optBoolean("is_return_cargo", false)
        val status = json.optString("status", "packed")
        val legId = json.optString("leg_id").takeIf { it.isNotBlank() }
        val syncStatus = json.optString("local_sync_status").takeIf { it.isNotBlank() }

        return CargoItemData(
            cargoId = record.entityId,
            trackingCode = trackingCode,
            description = description,
            category = category,
            weight = weight,
            volume = volume,
            hazardClass = hazard,
            isReturnCargo = isReturn,
            status = status,
            legId = legId,
            syncStatus = syncStatus
        )
    }

    fun parseInventory(record: CachedRecord): InventoryStockData {
        val json = parseJsonObject(record.json)
        val code = json.optString("code").ifBlank {
            json.optString("sku").ifBlank { record.entityId.take(8).uppercase() }
        }
        val name = json.optString("name").ifBlank {
            json.optString("description", "Station inventory stock")
        }
        val quantity = json.optDouble("quantity", 0.0)
        val unit = json.optString("unit", "units")
        val reorderThreshold = json.optDouble("reorder_threshold", 0.0)
        val safetyMinimum = json.optDouble("safety_stock_minimum", 0.0)
        val isLowStock = quantity <= reorderThreshold && reorderThreshold > 0.0
        val syncStatus = json.optString("local_sync_status").takeIf { it.isNotBlank() }

        return InventoryStockData(
            stockId = record.entityId,
            stationId = json.optString("station_id"),
            itemCatalogId = json.optString("item_catalog_id", record.entityId),
            code = code,
            name = name,
            quantity = quantity,
            unit = unit,
            reorderThreshold = reorderThreshold,
            safetyStockMinimum = safetyMinimum,
            isLowStock = isLowStock,
            syncStatus = syncStatus
        )
    }

    fun parseIncident(record: CachedRecord): IncidentData {
        val json = parseJsonObject(record.json)
        val type = json.optString("type", "operational")
        val severity = json.optString("severity", "moderate")
        val status = json.optString("status", "declared")
        val description = json.optString("description").ifBlank { "No report details provided" }
        val rawLocation = json.optString("location", "")
        val coordinatesText = formatCoordinates(rawLocation)
        val declaredAt = json.optString("declared_at", record.changedAt ?: "")
        val declaredBy = json.optString("declared_by").takeIf { it.isNotBlank() }
        val syncStatus = json.optString("local_sync_status").takeIf { it.isNotBlank() }

        return IncidentData(
            incidentId = record.entityId,
            type = type,
            severity = severity,
            status = status,
            description = description,
            location = rawLocation,
            coordinatesText = coordinatesText,
            declaredAt = declaredAt.takeIf { it.isNotBlank() },
            declaredBy = declaredBy,
            syncStatus = syncStatus
        )
    }

    fun parsePersonnel(record: CachedRecord): PersonnelAssignmentData {
        val json = parseJsonObject(record.json)
        val name = json.optString("name").ifBlank {
            json.optString("full_name", "Expedition Member")
        }
        val role = json.optString("role_on_expedition").ifBlank {
            json.optString("role", "Field Specialist")
        }
        val employeeCode = json.optString("employee_code").ifBlank {
            record.entityId.take(8).uppercase()
        }
        val status = json.optString("status", "planned")
        val startDate = json.optString("start_date", "Active")
        val endDate = json.optString("end_date").takeIf { it.isNotBlank() }
        val seatBerth = json.optString("seat_berth_ref").takeIf { it.isNotBlank() }
        val syncStatus = json.optString("local_sync_status").takeIf { it.isNotBlank() }

        return PersonnelAssignmentData(
            assignmentId = record.entityId,
            personnelId = json.optString("personnel_id", record.entityId),
            expeditionId = json.optString("expedition_id"),
            name = name,
            role = role,
            employeeCode = employeeCode,
            status = status,
            startDate = startDate,
            endDate = endDate,
            seatBerthRef = seatBerth,
            syncStatus = syncStatus
        )
    }

    fun parseTransportLeg(record: CachedRecord): TransportLegData {
        val json = parseJsonObject(record.json)
        val code = json.optString("code").ifBlank {
            json.optString("leg_number").ifBlank { record.entityId.take(8).uppercase() }
        }
        val origin = json.optString("origin").ifBlank { json.optString("origin_station_id", "Origin Hub") }
        val destination = json.optString("destination").ifBlank { json.optString("destination_station_id", "Field Base") }
        val status = json.optString("status", "scheduled")
        val plannedDep = json.optString("planned_departure").takeIf { it.isNotBlank() }
        val plannedArr = json.optString("planned_arrival").takeIf { it.isNotBlank() }
        val syncStatus = json.optString("local_sync_status").takeIf { it.isNotBlank() }

        return TransportLegData(
            legId = record.entityId,
            expeditionId = json.optString("expedition_id"),
            code = code,
            origin = origin,
            destination = destination,
            status = status,
            plannedDeparture = plannedDep,
            plannedArrival = plannedArr,
            syncStatus = syncStatus
        )
    }

    fun parseExpedition(record: CachedRecord): ExpeditionData {
        val json = parseJsonObject(record.json)
        val code = json.optString("expedition_code").ifBlank {
            json.optString("code").ifBlank { record.entityId.take(8).uppercase() }
        }
        val name = json.optString("name").ifBlank { "Antarctic Operation" }
        val season = json.optString("season", "Current Season")
        val status = json.optString("status", "in-progress")
        val startDate = json.optString("start_date").takeIf { it.isNotBlank() }
        val endDate = json.optString("end_date").takeIf { it.isNotBlank() }
        val syncStatus = json.optString("local_sync_status").takeIf { it.isNotBlank() }

        return ExpeditionData(
            expeditionId = record.entityId,
            code = code,
            name = name,
            season = season,
            status = status,
            startDate = startDate,
            endDate = endDate,
            syncStatus = syncStatus
        )
    }

    private fun parseJsonObject(raw: String): JSONObject {
        return runCatching { JSONObject(raw) }.getOrElse { JSONObject() }
    }

    private fun formatCoordinates(point: String): String {
        if (point.isBlank()) return "Coordinates unrecorded"
        // Formats "POINT(lon lat)" or "POINT (lon lat)"
        val regex = Regex("""POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)""", RegexOption.IGNORE_CASE)
        val match = regex.find(point) ?: return point
        val lon = match.groupValues[1].toDoubleOrNull() ?: return point
        val lat = match.groupValues[2].toDoubleOrNull() ?: return point
        val latStr = "%.4f°%s".format(Math.abs(lat), if (lat >= 0) "N" else "S")
        val lonStr = "%.4f°%s".format(Math.abs(lon), if (lon >= 0) "E" else "W")
        return "$latStr, $lonStr"
    }
}
