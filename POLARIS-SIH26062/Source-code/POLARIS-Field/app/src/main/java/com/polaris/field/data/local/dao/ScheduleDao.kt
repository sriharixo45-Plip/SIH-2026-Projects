package com.polaris.field.data.local.dao


import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.polaris.field.data.local.entity.PersonnelAssignmentEntity
import com.polaris.field.data.local.entity.PersonnelEntity
import kotlinx.coroutines.flow.Flow


@Dao
interface ScheduleDao {
    @Query("SELECT * FROM personnel ORDER BY name ASC")
    fun getAllPersonnelFlow(): Flow<List<PersonnelEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPersonnel(personnel: List<PersonnelEntity>)

    @Query("SELECT * FROM personnel_assignments ORDER BY startDate ASC")
    fun getAllAssignmentsFlow(): Flow<List<PersonnelAssignmentEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAssignments(assignments: List<PersonnelAssignmentEntity>)

    @Query("DELETE FROM personnel_assignments WHERE assignmentId = :assignmentId")
    suspend fun deleteAssignment(assignmentId: String)

    @Query("SELECT * FROM personnel_assignments WHERE assignmentId = :assignmentId LIMIT 1")
    suspend fun getAssignment(assignmentId: String): PersonnelAssignmentEntity?

    @Query("DELETE FROM personnel_assignments")
    suspend fun deleteAllAssignments()

    @Query("DELETE FROM personnel")
    suspend fun deleteAllPersonnel()
}






