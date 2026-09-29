package com.polaris.field.data.repository

import com.polaris.field.auth.SessionManager
import com.polaris.field.auth.SessionUser
import com.polaris.field.data.local.dao.UserDao
import com.polaris.field.data.local.entity.UserEntity
import com.polaris.field.data.remote.api.PolarisApiService
import com.polaris.field.data.remote.dto.LoginRequestDto
import com.polaris.field.data.remote.dto.RefreshTokenRequestDto
import kotlinx.coroutines.flow.Flow

class AuthRepository(
    private val apiService: PolarisApiService,
    private val userDao: UserDao,
    private val sessionManager: SessionManager
) {
    val currentSessionUser: Flow<SessionUser?> = sessionManager.sessionUserFlow

    suspend fun login(employeeCode: String, passwordText: String): Result<SessionUser> {
        return try {
            val response = apiService.login(LoginRequestDto(employee_code = employeeCode, password = passwordText))
            if (response.isSuccessful && response.body() != null) {
                val body = response.body()!!
                val u = body.user
                val role = u.role ?: "Station Logistics Officer"
                val stationCode = u.station_code ?: "BRH"

                sessionManager.saveSession(
                    accessToken = body.access_token,
                    refreshToken = body.refresh_token,
                    userId = u.user_id,
                    employeeCode = u.employee_code,
                    fullName = u.full_name,
                    role = role,
                    stationCode = stationCode,
                    stationId = u.station_id
                )

                val sessionUser = SessionUser(
                    userId = u.user_id,
                    employeeCode = u.employee_code,
                    fullName = u.full_name,
                    role = role,
                    stationCode = stationCode,
                    stationId = u.station_id
                )

                userDao.clearSessions()
                userDao.insertUser(
                    UserEntity(
                        userId = u.user_id,
                        employeeCode = u.employee_code,
                        fullName = u.full_name,
                        email = u.email,
                        role = role,
                        stationCode = stationCode,
                        stationId = u.station_id,
                        isCurrentSession = true,
                        lastUpdated = System.currentTimeMillis()
                    )
                )

                Result.success(sessionUser)
            } else {
                Result.failure(Exception("Authentication failed: Invalid credentials or inactive user (${response.code()})"))
            }
        } catch (e: Exception) {
            // Restore session ONLY if a previously authenticated valid session exists in Room/DataStore
            val cachedUser = userDao.getCurrentUser()
            if (cachedUser != null) {
                Result.success(
                    SessionUser(
                        userId = cachedUser.userId,
                        employeeCode = cachedUser.employeeCode,
                        fullName = cachedUser.fullName,
                        role = cachedUser.role,
                        stationCode = cachedUser.stationCode,
                        stationId = cachedUser.stationId
                    )
                )
            } else {
                Result.failure(Exception("Network error: Unable to connect to POLARIS API (${e.localizedMessage})"))
            }
        }
    }

    suspend fun getMe(): Result<SessionUser> {
        val token = sessionManager.getAccessToken() ?: return Result.failure(Exception("Unauthenticated"))
        return try {
            val response = apiService.getMe("Bearer $token")
            if (response.isSuccessful && response.body() != null) {
                val u = response.body()!!
                val role = u.role ?: "Station Logistics Officer"
                val stationCode = u.station_code ?: "BRH"

                val user = SessionUser(
                    userId = u.user_id,
                    employeeCode = u.employee_code,
                    fullName = u.full_name,
                    role = role,
                    stationCode = stationCode,
                    stationId = u.station_id
                )

                userDao.insertUser(
                    UserEntity(
                        userId = u.user_id,
                        employeeCode = u.employee_code,
                        fullName = u.full_name,
                        email = u.email,
                        role = role,
                        stationCode = stationCode,
                        stationId = u.station_id,
                        isCurrentSession = true,
                        lastUpdated = System.currentTimeMillis()
                    )
                )

                Result.success(user)
            } else {
                Result.failure(Exception("Session invalid or expired (${response.code()})"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun refreshToken(): Result<Unit> {
        val refreshToken = sessionManager.getRefreshToken() ?: return Result.failure(Exception("No refresh token"))
        return try {
            val response = apiService.refreshToken(RefreshTokenRequestDto(refresh_token = refreshToken))
            if (response.isSuccessful && response.body() != null) {
                val body = response.body()!!
                val currentUser = userDao.getCurrentUser()
                if (currentUser != null) {
                    sessionManager.saveSession(
                        accessToken = body.access_token,
                        refreshToken = body.refresh_token,
                        userId = currentUser.userId,
                        employeeCode = currentUser.employeeCode,
                        fullName = currentUser.fullName,
                        role = currentUser.role,
                        stationCode = currentUser.stationCode,
                        stationId = currentUser.stationId
                    )
                }
                Result.success(Unit)
            } else {
                Result.failure(Exception("Failed to refresh session"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun logout() {
        try {
            val token = sessionManager.getAccessToken()
            if (token != null) {
                apiService.logout("Bearer $token")
            }
        } catch (_: Exception) {}
        sessionManager.clearSession()
        userDao.clearSessions()
    }
}
