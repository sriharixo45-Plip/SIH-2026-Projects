package com.polaris.field.data.local.dao


import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.polaris.field.data.local.entity.ApprovalEntity
import kotlinx.coroutines.flow.Flow


@Dao
interface ApprovalDao {
    @Query("SELECT * FROM approvals ORDER BY lastUpdated DESC")
    fun getAllApprovalsFlow(): Flow<List<ApprovalEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertApprovals(approvals: List<ApprovalEntity>)

    @Query("DELETE FROM approvals WHERE approvalId = :approvalId")
    suspend fun deleteApproval(approvalId: String)

    @Query("SELECT * FROM approvals WHERE approvalId = :approvalId LIMIT 1")
    suspend fun getApproval(approvalId: String): ApprovalEntity?

    @Query("DELETE FROM approvals")
    suspend fun deleteAllApprovals()

    @Query("UPDATE approvals SET decision = :decision, decidedBy = :decidedBy, decidedAt = :decidedAt WHERE approvalId = :approvalId")
    suspend fun updateApprovalDecision(approvalId: String, decision: String, decidedBy: String, decidedAt: String)

    @Query("UPDATE approvals SET decision = :decision, decidedBy = :decidedBy, decidedAt = :decidedAt, lastUpdated = :timestamp WHERE approvalId = :approvalId")
    suspend fun applyApprovalDecision(approvalId: String, decision: String, decidedBy: String, decidedAt: String, timestamp: Long)
}






