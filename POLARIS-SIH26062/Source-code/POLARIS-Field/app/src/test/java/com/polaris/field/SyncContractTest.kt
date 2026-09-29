package com.polaris.field

import com.google.gson.Gson
import com.polaris.field.data.remote.dto.ResolveConflictDto
import com.polaris.field.data.remote.dto.SyncOperationDto
import com.google.gson.JsonParser
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SyncContractTest {
    private val gson = Gson()

    @Test
    fun syncOperationUsesApiFieldsAndIsoTimestamp() {
        val timestamp = "2026-09-28T10:15:30Z"
        val request = SyncOperationDto(
            op_id = "00000000-0000-4000-8000-000000000001",
            device_id = "00000000-0000-4000-8000-000000000002",
            performed_by = "00000000-0000-4000-8000-000000000003",
            local_sequence_number = 1,
            target_entity_type = "cargo_item",
            target_entity_id = "00000000-0000-4000-8000-000000000004",
            operation_type = "status_change",
            payload = mapOf("status" to "received"),
            base_version = 1,
            local_timestamp = timestamp
        )

        val json = JsonParser().parse(gson.toJson(request)).asJsonObject
        assertEquals(timestamp, json.get("local_timestamp").asString)
        assertFalse("Client must not control server operation status", json.has("status"))
    }

    @Test
    fun conflictResolutionUsesServerContractWithoutClientSuppliedActor() {
        val json = JsonParser().parse(gson.toJson(ResolveConflictDto("accepted_incoming"))).asJsonObject
        assertEquals("accepted_incoming", json.get("resolution").asString)
        assertTrue(json.has("resolution"))
        assertFalse("The server derives resolved_by from the authenticated token", json.has("resolved_by"))
    }
}
