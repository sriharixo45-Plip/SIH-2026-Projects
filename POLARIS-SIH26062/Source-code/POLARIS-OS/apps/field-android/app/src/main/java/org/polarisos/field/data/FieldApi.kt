package org.polarisos.field.data

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import okhttp3.Authenticator
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.Route
import okhttp3.MediaType.Companion.toMediaType
import org.json.JSONObject
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Query
import java.net.URL
import java.util.concurrent.TimeUnit

data class LoginRequest(val identity: String, val password: String)
data class FieldUser(val user_id: String, val employee_code: String?, val full_name: String?, val station_id: String?, val station_code: String?, val role: String?)
data class LoginResponse(val access_token: String, val refresh_token: String, val user: FieldUser)
data class TokenResponse(val access_token: String, val refresh_token: String)
data class RegisterDeviceRequest(val device_id: String, val device_type: String = "station-pwa", val assigned_station_id: String, val app_version: String = "1.0.0")
data class SyncOperationRequest(val op_id: String, val device_id: String, val performed_by: String, val local_sequence_number: Int, val target_entity_type: String, val target_entity_id: String, val operation_type: String, val payload: Map<String, Any?>, val base_version: Int?, val local_timestamp: String)
data class ApiChange(val cursor: Long, val entity_type: String, val entity_id: String, val entity_version: Int, val deleted: Boolean, val record: Any?, val changed_at: String?)
data class ChangeResponse(val changes: List<ApiChange>, val cursor: Long)

interface FieldApi {
    @POST("auth/login") suspend fun login(@Body body: LoginRequest): LoginResponse
    @POST("auth/logout") suspend fun logout(): Map<String, String>
    @POST("sync-devices/register") suspend fun register(@Body body: RegisterDeviceRequest): Map<String, Any?>
    @POST("sync-operations") suspend fun submit(@Body body: SyncOperationRequest): Map<String, Any?>
    @GET("sync-operations/changes") suspend fun changes(@Query("cursor") cursor: Long, @Query("device_id") deviceId: String): ChangeResponse
    @retrofit2.http.PATCH("sync-conflicts/{id}/resolve") suspend fun resolveConflict(@retrofit2.http.Path("id") id: String, @Body body: Map<String, String>): Map<String, Any?>
}

class SessionStore(context: Context) {
    private val key = MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build()
    private val prefs = EncryptedSharedPreferences.create(context, "polaris-field-session", key, EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV, EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM)
    var endpoint: String
        get() = prefs.getString("endpoint", "") ?: ""
        set(value) { prefs.edit().putString("endpoint", normalizeBaseUrl(value)).apply() }
    var accessToken: String?
        get() = prefs.getString("access_token", null)
        set(value) { prefs.edit().putString("access_token", value).apply() }
    var refreshToken: String?
        get() = prefs.getString("refresh_token", null)
        set(value) { prefs.edit().putString("refresh_token", value).apply() }
    var userId: String?
        get() = prefs.getString("user_id", null)
        set(value) { prefs.edit().putString("user_id", value).apply() }
    var userName: String?
        get() = prefs.getString("user_name", null)
        set(value) { prefs.edit().putString("user_name", value).apply() }
    var stationId: String?
        get() = prefs.getString("station_id", null)
        set(value) { prefs.edit().putString("station_id", value).apply() }
    var stationCode: String?
        get() = prefs.getString("station_code", null)
        set(value) { prefs.edit().putString("station_code", value).apply() }
    val deviceId: String
        get() = prefs.getString("device_id", null) ?: java.util.UUID.randomUUID().toString().also { prefs.edit().putString("device_id", it).apply() }
    val signedIn: Boolean get() = accessToken != null && userId != null && stationId != null
    fun save(login: LoginResponse) {
        accessToken = login.access_token; refreshToken = login.refresh_token; userId = login.user.user_id
        userName = login.user.full_name; stationId = login.user.station_id; stationCode = login.user.station_code
    }
    fun clear() { prefs.edit().remove("access_token").remove("refresh_token").remove("user_id").remove("user_name").remove("station_id").remove("station_code").apply() }
}

fun normalizeBaseUrl(raw: String): String {
    val trimmed = raw.trim()
    if (trimmed.isEmpty()) return ""
    val parsed = URL(trimmed)
    require(parsed.protocol == "https" || parsed.protocol == "http") { "API address must start with https:// or http://" }
    require(parsed.host.isNotBlank()) { "Enter a valid server host or address." }
    return if (trimmed.endsWith('/')) trimmed else "$trimmed/"
}

class FieldApiFactory(private val session: SessionStore) {
    private val moshi = Moshi.Builder().addLast(KotlinJsonAdapterFactory()).build()
    fun create(): FieldApi {
        val baseUrl = normalizeBaseUrl(session.endpoint)
        require(baseUrl.isNotBlank()) { "Set the backend address in Settings first." }
        val http = OkHttpClient.Builder().connectTimeout(10, TimeUnit.SECONDS).readTimeout(25, TimeUnit.SECONDS)
            .addInterceptor { chain ->
                val request = chain.request().newBuilder().apply { session.accessToken?.let { header("Authorization", "Bearer $it") } }.build()
                chain.proceed(request)
            }
            .authenticator(object : Authenticator {
                override fun authenticate(route: Route?, response: Response): Request? {
                    if (responseCount(response) >= 2) return null
                    synchronized(session) {
                        val refresh = session.refreshToken ?: return null
                        val requestBody = okhttp3.RequestBody.create("application/json".toMediaType(), "{\"refresh_token\":\"$refresh\"}")
                        val refreshResponse = OkHttpClient().newCall(Request.Builder().url("${baseUrl}auth/refresh").post(requestBody).build()).execute()
                        refreshResponse.use { result ->
                            if (!result.isSuccessful) { session.clear(); return null }
                            val body = result.body?.string() ?: return null
                            val tokens = JSONObject(body)
                            val access = tokens.optString("access_token").takeIf { it.isNotBlank() } ?: return null
                            val rotated = tokens.optString("refresh_token").takeIf { it.isNotBlank() } ?: return null
                            session.accessToken = access; session.refreshToken = rotated
                            return response.request.newBuilder().header("Authorization", "Bearer $access").build()
                        }
                    }
                }
            }).build()
        return Retrofit.Builder().baseUrl(baseUrl).client(http).addConverterFactory(MoshiConverterFactory.create(moshi)).build().create(FieldApi::class.java)
    }
    private fun responseCount(response: Response): Int { var count = 1; var prior = response.priorResponse; while (prior != null) { count++; prior = prior.priorResponse }; return count }
}
