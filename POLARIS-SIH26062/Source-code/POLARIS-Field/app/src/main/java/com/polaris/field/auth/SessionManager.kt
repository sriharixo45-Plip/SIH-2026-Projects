package com.polaris.field.auth

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import java.util.UUID

val Context.sessionDataStore: DataStore<Preferences> by preferencesDataStore(name = "polaris_session")

class SessionManager(private val context: Context) {

    companion object {
        private val KEY_ACCESS_TOKEN = stringPreferencesKey("access_token")
        private val KEY_REFRESH_TOKEN = stringPreferencesKey("refresh_token")
        private val KEY_USER_ID = stringPreferencesKey("user_id")
        private val KEY_EMPLOYEE_CODE = stringPreferencesKey("employee_code")
        private val KEY_FULL_NAME = stringPreferencesKey("full_name")
        private val KEY_ROLE = stringPreferencesKey("role")
        private val KEY_STATION_CODE = stringPreferencesKey("station_code")
        private val KEY_STATION_ID = stringPreferencesKey("station_id")
        private val KEY_DEVICE_ID = stringPreferencesKey("device_id")
        private val KEY_SYNC_CURSOR = stringPreferencesKey("sync_cursor")
        private val KEY_ACTIVE_SYNC_USER = stringPreferencesKey("active_sync_user")
        private val KEY_IS_DARK_MODE = booleanPreferencesKey("is_dark_mode")
        private val KEY_API_BASE_URL = stringPreferencesKey("api_base_url")
    }

    val accessTokenFlow: Flow<String?> = context.sessionDataStore.data.map { prefs ->
        prefs[KEY_ACCESS_TOKEN]
    }

    val isDarkModeFlow: Flow<Boolean> = context.sessionDataStore.data.map { prefs ->
        prefs[KEY_IS_DARK_MODE] ?: true
    }

    val apiBaseUrlFlow: Flow<String> = context.sessionDataStore.data.map { prefs ->
        prefs[KEY_API_BASE_URL] ?: com.polaris.field.BuildConfig.POLARIS_API_BASE_URL
    }

    suspend fun getApiBaseUrl(): String = apiBaseUrlFlow.first()

    suspend fun setApiBaseUrl(url: String) {
        context.sessionDataStore.edit { prefs -> prefs[KEY_API_BASE_URL] = url }
    }

    val sessionUserFlow: Flow<SessionUser?> = context.sessionDataStore.data.map { prefs ->
        val uid = prefs[KEY_USER_ID] ?: return@map null
        val code = prefs[KEY_EMPLOYEE_CODE] ?: "BRH-DEMO-001"
        val name = prefs[KEY_FULL_NAME] ?: "Field Officer"
        val role = prefs[KEY_ROLE] ?: "Station Logistics Officer"
        val stCode = prefs[KEY_STATION_CODE] ?: "BRH"
        val stId = prefs[KEY_STATION_ID]

        SessionUser(
            userId = uid,
            employeeCode = code,
            fullName = name,
            role = role,
            stationCode = stCode,
            stationId = stId
        )
    }

    suspend fun setDarkMode(isDark: Boolean) {
        context.sessionDataStore.edit { prefs ->
            prefs[KEY_IS_DARK_MODE] = isDark
        }
    }

    suspend fun saveSession(
        accessToken: String,
        refreshToken: String,
        userId: String,
        employeeCode: String,
        fullName: String,
        role: String,
        stationCode: String,
        stationId: String?
    ) {
        context.sessionDataStore.edit { prefs ->
            prefs[KEY_ACCESS_TOKEN] = accessToken
            prefs[KEY_REFRESH_TOKEN] = refreshToken
            prefs[KEY_USER_ID] = userId
            prefs[KEY_EMPLOYEE_CODE] = employeeCode
            prefs[KEY_FULL_NAME] = fullName
            prefs[KEY_ROLE] = role
            prefs[KEY_STATION_CODE] = stationCode
            if (stationId != null) {
                prefs[KEY_STATION_ID] = stationId
            }
        }
    }

    suspend fun getAccessToken(): String? {
        val prefs = context.sessionDataStore.data.first()
        return prefs[KEY_ACCESS_TOKEN]
    }

    suspend fun getRefreshToken(): String? {
        val prefs = context.sessionDataStore.data.first()
        return prefs[KEY_REFRESH_TOKEN]
    }

    suspend fun getDeviceId(userId: String? = null): String {
        val key = userId?.takeIf { it.isNotBlank() }?.let { stringPreferencesKey("device_id_$it") } ?: KEY_DEVICE_ID
        var id: String? = null
        context.sessionDataStore.edit { prefs ->
            id = prefs[key]
            if (id.isNullOrBlank()) {
                id = UUID.randomUUID().toString()
                prefs[key] = id!!
            }
        }
        return id!!
    }

    suspend fun getSyncCursor(userId: String? = null): Long {
        val key = userId?.takeIf { it.isNotBlank() }?.let { stringPreferencesKey("sync_cursor_$it") } ?: KEY_SYNC_CURSOR
        return context.sessionDataStore.data.first()[key]?.toLongOrNull() ?: 0L
    }

    suspend fun saveSyncCursor(cursor: Long, userId: String? = null) {
        val key = userId?.takeIf { it.isNotBlank() }?.let { stringPreferencesKey("sync_cursor_$it") } ?: KEY_SYNC_CURSOR
        context.sessionDataStore.edit { it[key] = cursor.toString() }
    }

    suspend fun getActiveSyncUserId(): String? = context.sessionDataStore.data.first()[KEY_ACTIVE_SYNC_USER]

    suspend fun setActiveSyncUserId(userId: String) {
        context.sessionDataStore.edit { it[KEY_ACTIVE_SYNC_USER] = userId }
    }

    suspend fun clearSession() {
        context.sessionDataStore.edit { prefs ->
            val persistentValues = prefs.asMap().filterKeys {
                it.name == KEY_DEVICE_ID.name || it.name.startsWith("device_id_") ||
                        it.name == KEY_SYNC_CURSOR.name || it.name.startsWith("sync_cursor_") || it.name == KEY_ACTIVE_SYNC_USER.name ||
                        it.name == KEY_IS_DARK_MODE.name || it.name == KEY_API_BASE_URL.name
            }
            prefs.clear()
            persistentValues.forEach { (key, value) ->
                @Suppress("UNCHECKED_CAST")
                when (value) {
                    is String -> prefs[key as Preferences.Key<String>] = value
                    is Boolean -> prefs[key as Preferences.Key<Boolean>] = value
                }
            }
        }
    }
}

data class SessionUser(
    val userId: String,
    val employeeCode: String,
    val fullName: String,
    val role: String,
    val stationCode: String,
    val stationId: String?
)
