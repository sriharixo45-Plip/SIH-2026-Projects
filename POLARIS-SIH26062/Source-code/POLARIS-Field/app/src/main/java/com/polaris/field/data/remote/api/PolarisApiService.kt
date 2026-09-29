package com.polaris.field.data.remote.api

import com.polaris.field.data.remote.dto.*
import retrofit2.Response
import retrofit2.http.*

interface PolarisApiService {
    @GET("health/db")
    suspend fun checkHealth(): Response<Map<String, Any>>

    // Auth
    @POST("auth/login")
    suspend fun login(@Body body: LoginRequestDto): Response<LoginResponseDto>

    @POST("auth/refresh")
    suspend fun refreshToken(@Body body: RefreshTokenRequestDto): Response<RefreshTokenResponseDto>

    @GET("auth/me")
    suspend fun getMe(@Header("Authorization") authHeader: String): Response<UserDto>

    @POST("auth/logout")
    suspend fun logout(@Header("Authorization") authHeader: String): Response<Map<String, Any>>

    // Transport Legs / Shipments
    @GET("transport-legs")
    suspend fun getTransportLegs(): Response<List<Map<String, Any>>>

    @GET("transport-legs/{id}")
    suspend fun getTransportLeg(@Path("id") legId: String): Response<Map<String, Any>>

    // Cargo
    @GET("cargo-items")
    suspend fun getCargoItems(): Response<List<CargoItemDto>>

    @GET("cargo-items/{id}")
    suspend fun getCargoItem(@Path("id") cargoId: String): Response<CargoItemDto>

    @PATCH("cargo-items/{id}/status")
    suspend fun updateCargoStatus(
        @Path("id") cargoId: String,
        @Body body: UpdateCargoStatusDto
    ): Response<CargoItemDto>

    @GET("cargo-movement-events/{cargoId}")
    suspend fun getCargoMovementEvents(@Path("cargoId") cargoId: String): Response<List<CargoMovementEventDto>>

    // Audit Logs
    @GET("audit-logs")
    suspend fun getAuditLogs(
        @Query("entity_type") entityType: String? = null,
        @Query("entity_id") entityId: String? = null
    ): Response<List<AuditLogDto>>

    // Personnel & Assignments
    @GET("personnel")
    suspend fun getPersonnel(): Response<List<Map<String, Any>>>

    @GET("personnel-assignments")
    suspend fun getPersonnelAssignments(): Response<List<Map<String, Any>>>

    @POST("approvals")
    suspend fun createApproval(@Body body: Map<String, Any>): Response<Map<String, Any>>

    @GET("approvals")
    suspend fun getApprovals(): Response<List<Map<String, Any>>>

    @POST("approvals/{id}/decide")
    suspend fun decideApproval(
        @Path("id") approvalId: String,
        @Body body: Map<String, Any>
    ): Response<Map<String, Any>>

    // Inventory
    @GET("inventory-stocks")
    suspend fun getInventoryStocks(): Response<List<Map<String, Any>>>

    @POST("inventory-transactions")
    suspend fun createInventoryTransaction(@Body body: Map<String, Any>): Response<Map<String, Any>>

    // Incidents
    @GET("incidents")
    suspend fun getIncidents(): Response<List<Map<String, Any>>>

    @POST("incidents")
    suspend fun createIncident(@Body body: Map<String, Any>): Response<Map<String, Any>>

    // Sync Operations
    @POST("sync-operations")
    suspend fun pushSyncOperation(@Body body: SyncOperationDto): Response<Map<String, Any>>

    @POST("sync-devices/register")
    suspend fun registerSyncDevice(@Body body: RegisterDeviceDto): Response<Map<String, Any>>

    @GET("sync-operations/changes")
    suspend fun getSyncChanges(@Query("cursor") cursor: Long, @Query("device_id") deviceId: String): Response<SyncChangesDto>

    @PATCH("sync-conflicts/{id}/resolve")
    suspend fun resolveConflict(
        @Path("id") conflictId: String,
        @Body body: ResolveConflictDto
    ): Response<Map<String, Any>>

    // Weather
    @GET("weather-events")
    suspend fun getWeatherEvents(): Response<List<Map<String, Any>>>
}
