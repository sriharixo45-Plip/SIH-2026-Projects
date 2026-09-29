package com.polaris.field.data.repository

import com.polaris.field.data.local.dao.ApprovalDao
import com.polaris.field.data.local.dao.ScheduleDao
import com.polaris.field.data.local.entity.ApprovalEntity
import com.polaris.field.data.local.entity.PersonnelAssignmentEntity
import com.polaris.field.data.local.entity.PersonnelEntity
import com.polaris.field.data.remote.api.PolarisApiService
import kotlinx.coroutines.flow.Flow
import retrofit2.Response
import com.polaris.field.sync.SyncManager
import java.util.UUID

class ScheduleRepository(
    private val apiService: PolarisApiService,
    private val scheduleDao: ScheduleDao,
    private val approvalDao: ApprovalDao,
    private val syncManager: SyncManager
) {
    val personnelFlow: Flow<List<PersonnelEntity>> = scheduleDao.getAllPersonnelFlow()
    val assignmentsFlow: Flow<List<PersonnelAssignmentEntity>> = scheduleDao.getAllAssignmentsFlow()
    val approvalsFlow: Flow<List<ApprovalEntity>> = approvalDao.getAllApprovalsFlow()

    suspend fun requestShiftSwap(requesterId: String, targetId: String, reason: String): Result<Unit> {
        val approvalId = UUID.randomUUID().toString()
        val approval = ApprovalEntity(
            approvalId = approvalId,
            entityType = "PersonnelAssignment",
            entityId = targetId,
            requestedBy = requesterId,
            decidedBy = null,
            decision = "pending",
            decidedAt = null,
            reason = reason,
            lastUpdated = System.currentTimeMillis()
        )
        return try {
            val body = mapOf(
                "approval_id" to approvalId,
                "entity_type" to "PersonnelAssignment",
                "entity_id" to targetId,
                "requested_by" to requesterId,
                "reason" to reason
            )
            syncManager.enqueueOperation("approval", approvalId, "create", body, requesterId, 0) {
                approvalDao.insertApprovals(listOf(approval))
            }
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun decideApproval(approvalId: String, decision: String, decidedBy: String, reason: String? = null): Result<Unit> {
        val approval = approvalDao.getApproval(approvalId) ?: return Result.failure(IllegalArgumentException("Approval was not found locally."))
        if (decision !in listOf("approved", "rejected")) return Result.failure(IllegalArgumentException("Approval decision is invalid."))
        val timestamp = System.currentTimeMillis()
        return try {
            val body = mapOf(
                "decision" to decision,
                "reason" to (reason ?: "Decision submitted by Station Leader")
            )
            syncManager.enqueueOperation("approval", approvalId, "update", body, decidedBy, approval.syncVersion) {
                approvalDao.applyApprovalDecision(approvalId, decision, decidedBy, timestamp.toString(), timestamp)
            }
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun refreshAssignments(): Result<Unit> {
        return try {
            val response: Response<List<Map<String, Any>>> = apiService.getPersonnelAssignments()
            val bodyList = response.body()
            if (response.isSuccessful && bodyList != null) {
                val list = bodyList.map { item ->
                    PersonnelAssignmentEntity(
                        assignmentId = item["assignment_id"] as? String ?: "",
                        personnelId = item["personnel_id"] as? String ?: "",
                        expeditionId = item["expedition_id"] as? String ?: "",
                        stationId = item["station_id"] as? String,
                        legId = item["leg_id"] as? String,
                        seatBerthRef = item["seat_berth_ref"] as? String,
                        status = item["status"] as? String ?: "proposed",
                        startDate = item["start_date"] as? String ?: "",
                        endDate = item["end_date"] as? String,
                        syncVersion = (item["sync_version"] as? Number)?.toInt() ?: 0,
                        lastUpdated = System.currentTimeMillis()
                    )
                }
                scheduleDao.insertAssignments(list)
                Result.success(Unit)
            } else {
                Result.failure(Exception("Failed to fetch assignments from API"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
